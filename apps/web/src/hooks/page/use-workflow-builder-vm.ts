import { useNavigate } from '@tanstack/react-router';
import { decodeEventLog, keccak256, toHex, type Address } from 'viem';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';

import {
  type CreateWorkflowRequest,
  type Intent,
  useCreateWorkflow,
  useConfirmMarketplaceListing,
  useExtractIntent,
  useInvalidateMarketplace,
  usePublishToMarketplace,
} from '@/api';
import { agentTag } from '@/hooks/page/use-agent-profile-vm';
import { CURRENT_AGENT_ID, DEFAULT_PUBLISH_PRICING } from '@/lib/constants';
import { protocolFromTemplateId } from '@/lib/view-models';
import { DEFAULT_CHAIN_ID } from '@/lib/wagmi';
import { useDraftStore } from '@/store/draft-store';
import { toast } from '@/store/toast-store';

export const promptExamples = [
  'Every Friday, deposit 100 USDC into Aave',
  'Buy 0.05 ETH each Monday with USDC on Uniswap',
  'Stake 1 ETH into Lido and compound stETH monthly',
];

export interface WorkflowBuilderVM {
  prompt: string;
  intent: Intent | null;
  resolvedParameters: Record<string, unknown>;
  isCompiling: boolean;
  isDeploying: boolean;
  isWalletConnected: boolean;
  examples: string[];
  handlers: {
    onCompile: (value: string) => void;
    onDeploy: () => void;
    onParamChange: (key: string, value: string) => void;
    onReset: () => void;
  };
}

export function useWorkflowBuilderVM(): WorkflowBuilderVM {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: chainId ?? DEFAULT_CHAIN_ID });

  const registryAddress = import.meta.env.VITE_MARKETPLACE_REGISTRY_ADDRESS as Address | undefined;

  const marketplaceRegistryAbi = [
    {
      type: 'function',
      name: 'register',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'contentHash', type: 'bytes32' },
        { name: 'uri', type: 'string' },
      ],
      outputs: [{ name: 'id', type: 'uint256' }],
    },
    {
      type: 'event',
      name: 'ListingCreated',
      inputs: [
        { name: 'id', type: 'uint256', indexed: true },
        { name: 'author', type: 'address', indexed: true },
        { name: 'contentHash', type: 'bytes32', indexed: false },
        { name: 'uri', type: 'string', indexed: false },
      ],
      anonymous: false,
    },
  ] as const;

  const prompt = useDraftStore((s) => s.prompt);
  const intent = useDraftStore((s) => s.intent);
  const overrides = useDraftStore((s) => s.overrides);
  const setPrompt = useDraftStore((s) => s.setPrompt);
  const setIntent = useDraftStore((s) => s.setIntent);
  const setOverride = useDraftStore((s) => s.setOverride);
  const reset = useDraftStore((s) => s.reset);

  const extract = useExtractIntent({
    onSuccess: ({ intent: extracted }) => setIntent(extracted),
    onError: (err) => toast.error('Could not extract intent', err.message),
  });

  const invalidateMarketplace = useInvalidateMarketplace();
  const confirmListing = useConfirmMarketplaceListing();
  const publish = usePublishToMarketplace({
    onSuccess: async (listing) => {
      toast.success('Published to marketplace', listing.id.slice(0, 8));
      await invalidateMarketplace();
      navigate({ to: '/marketplace' });
    },
    onError: (err, vars) => {
      toast.error('Publish failed', err.message);
      navigate({ to: '/workflows/$id', params: { id: vars.workflowId } });
    },
  });

  const create = useCreateWorkflow<CreateWorkflowRequest>({
    onSuccess: async (workflow) => {
      toast.success('Workflow deployed', `Job ${workflow.id.slice(0, 8)} on KeeperHub`);

      // 백엔드 스키마대로 marketplace publish 연결 (기본 free)
      // agent:<id> 태그를 함께 붙여 agent profile 페이지 필터에 잡히게 함
      if (address) {
        const protocol = protocolFromTemplateId(workflow.templateId);
        const workflowUri = `${window.location.origin}/workflows/${workflow.id}`;
        const contentHash = keccak256(toHex(JSON.stringify(workflow)));
        let txHash: `0x${string}` | undefined;
        let registryListingId: number | undefined;

        if (registryAddress && walletClient && publicClient) {
          try {
            txHash = await walletClient.writeContract({
              address: registryAddress,
              abi: marketplaceRegistryAbi,
              functionName: 'register',
              args: [contentHash, workflowUri],
              chain: publicClient.chain,
              account: address,
            });
            toast.success('Onchain listing submitted', txHash.slice(0, 10));
          } catch (err) {
            const message = err instanceof Error ? err.message : 'wallet transaction rejected';
            toast.error('Onchain register failed', message);
            navigate({ to: '/workflows/$id', params: { id: workflow.id } });
            return;
          }
        } else {
          toast.warning(
            'Onchain register skipped',
            'Missing registry address or wallet client (check env + wallet).',
          );
        }

        const listing = await publish.mutateAsync({
          workflowId: workflow.id,
          author: address,
          tags: [protocol, workflow.templateId, agentTag(CURRENT_AGENT_ID)],
          pricing: DEFAULT_PUBLISH_PRICING,
          ...(txHash
            ? {
                onchain: {
                  status: 'pending',
                  txHash,
                  contentHash,
                  uri: workflowUri,
                },
              }
            : {}),
        });

        if (txHash && publicClient) {
          try {
            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
            const createdLog = receipt.logs.find((log) => {
              try {
                const decoded = decodeEventLog({
                  abi: marketplaceRegistryAbi,
                  data: log.data,
                  topics: log.topics,
                });
                return decoded.eventName === 'ListingCreated';
              } catch {
                return false;
              }
            });
            if (createdLog) {
              const decoded = decodeEventLog({
                abi: marketplaceRegistryAbi,
                data: createdLog.data,
                topics: createdLog.topics,
              });
              if (decoded.eventName === 'ListingCreated') {
                registryListingId = Number(decoded.args.id);
              }
            }

            await confirmListing.mutateAsync({
              id: listing.id,
              body: {
                registryListingId,
                confirmedAt: Date.now(),
              },
            });
            await invalidateMarketplace();
            toast.success('Onchain listing confirmed');
          } catch (err) {
            const message = err instanceof Error ? err.message : 'could not confirm receipt';
            toast.warning('Listing pending confirmation', message);
          }
        }
      }

      reset();

      // publish 실패/미실행(주소 없음) 시에도 최소한 상세 페이지로 이동은 유지
      if (!address) {
        navigate({ to: '/workflows/$id', params: { id: workflow.id } });
      }
    },
    onError: (err) => toast.error('Deploy failed', err.message),
  });

  const onCompile = (value: string) => {
    setPrompt(value);
    extract.mutate({ prompt: value });
  };

  const onDeploy = () => {
    if (!isConnected || !address) {
      toast.warning('Connect a wallet first', 'Workflows are owned by your wallet address.');
      return;
    }
    if (!prompt) return;
    create.mutate({
      prompt,
      owner: address,
      chainId: chainId ?? DEFAULT_CHAIN_ID,
    });
  };

  return {
    prompt,
    intent,
    resolvedParameters: { ...(intent?.parameters ?? {}), ...overrides },
    isCompiling: extract.isPending,
    isDeploying: create.isPending,
    isWalletConnected: isConnected,
    examples: promptExamples,
    handlers: {
      onCompile,
      onDeploy,
      onParamChange: setOverride,
      onReset: reset,
    },
  };
}
