import { useNavigate } from '@tanstack/react-router';
import { useAccount, useChainId } from 'wagmi';

import {
  type CreateWorkflowRequest,
  type Intent,
  useCreateWorkflow,
  useExtractIntent,
  useInvalidateMarketplace,
  usePublishToMarketplace,
} from '@/api';
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
    onSuccess: (workflow) => {
      toast.success('Workflow deployed', `Job ${workflow.id.slice(0, 8)} on KeeperHub`);

      // 백엔드 스키마대로 marketplace publish 연결 (기본 free)
      if (address) {
        const protocol = protocolFromTemplateId(workflow.templateId);
        publish.mutate({
          workflowId: workflow.id,
          author: address,
          tags: [protocol, workflow.templateId],
          pricing: { type: 'free' },
        });
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
