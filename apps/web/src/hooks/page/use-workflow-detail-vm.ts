import { useParams } from '@tanstack/react-router';

import {
  type ApiError,
  type Execution,
  type Workflow,
  type WorkflowStatus,
  useForkWorkflow,
  useMarketplaceList,
  usePauseWorkflow,
  useResumeWorkflow,
  useRunWorkflow,
  useWorkflow,
  useWorkflowExecutions,
  useWorkflowStatus,
} from '@/api';
import type { BadgeProps } from '@/components/ui/badge';
import { explorerAddressUrl, explorerTxUrl } from '@/lib/constants';
import { protocolFromTemplateId } from '@/lib/view-models';
import { toast } from '@/store/toast-store';

export interface WorkflowOnchain {
  status: 'pending' | 'confirmed';
  txHash: string;
  txExplorerUrl: string;
  contentHash: string;
  uri: string;
  registryListingId: number | undefined;
  confirmedAt: number | undefined;
  registryAddress: string | undefined;
  registryExplorerUrl: string | undefined;
}

type StatusBadge = NonNullable<BadgeProps['variant']>;

const statusBadgeMap: Record<Workflow['status'], StatusBadge> = {
  deployed: 'success',
  completed: 'success',
  paused: 'warning',
  error: 'destructive',
  draft: 'ghost',
};

const STATUS_POLL_MS = 5_000;
const EXECUTIONS_POLL_MS = 10_000;

export interface WorkflowDetailVM {
  id: string;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | null;
  refetch: () => void;
  workflow: Workflow | undefined;
  protocol: 'aave' | 'uniswap' | 'lido' | 'custom' | undefined;
  protocolLabel: string | undefined;
  statusBadgeVariant: StatusBadge | undefined;
  isDeployed: boolean;
  isPaused: boolean;
  canRun: boolean;
  liveStatus: WorkflowStatus | undefined;
  liveStatusLoading: boolean;
  executions: Execution[];
  executionsLoading: boolean;
  onchain: WorkflowOnchain | undefined;
  onchainLoading: boolean;
  mutations: {
    run: { trigger: () => void; isPending: boolean };
    pause: { trigger: () => void; isPending: boolean };
    resume: { trigger: () => void; isPending: boolean };
    fork: { trigger: () => void; isPending: boolean };
  };
}

export function useWorkflowDetailVM(): WorkflowDetailVM {
  const { id } = useParams({ from: '/workflows/$id' });
  const {
    data: workflow,
    isLoading,
    isError,
    error,
    refetch,
  } = useWorkflow(id, { refetchInterval: STATUS_POLL_MS });

  const canPollExternal = !!workflow?.keeperJobId;

  const { data: liveStatus, isLoading: liveStatusLoading } = useWorkflowStatus(id, {
    enabled: canPollExternal,
    refetchInterval: STATUS_POLL_MS,
  });

  const { data: executions = [], isLoading: executionsLoading } = useWorkflowExecutions(id, {
    refetchInterval: EXECUTIONS_POLL_MS,
  });

  const { data: listings = [], isLoading: listingsLoading } = useMarketplaceList(
    { workflowId: id, limit: 1 },
    { refetchInterval: STATUS_POLL_MS, enabled: Boolean(id) },
  );
  const listing = listings[0];
  const registryAddress = import.meta.env.VITE_MARKETPLACE_REGISTRY_ADDRESS as string | undefined;
  const onchain: WorkflowOnchain | undefined = listing?.stats.onchain
    ? {
        status: listing.stats.onchain.status,
        txHash: listing.stats.onchain.txHash,
        txExplorerUrl: explorerTxUrl(listing.stats.onchain.txHash, listing.workflow.chainId),
        contentHash: listing.stats.onchain.contentHash,
        uri: listing.stats.onchain.uri,
        registryListingId: listing.stats.onchain.registryListingId,
        confirmedAt: listing.stats.onchain.confirmedAt,
        registryAddress,
        registryExplorerUrl: registryAddress
          ? explorerAddressUrl(registryAddress, listing.workflow.chainId)
          : undefined,
      }
    : undefined;

  const runM = useRunWorkflow({
    onSuccess: ({ execution }) =>
      toast.success('Run triggered', `Execution ${execution.executionId}`),
    onError: (e) => toast.error('Run failed', e.message),
  });
  const pauseM = usePauseWorkflow({
    onSuccess: () => toast.info('Workflow paused'),
    onError: (e) => toast.error('Pause failed', e.message),
  });
  const resumeM = useResumeWorkflow({
    onSuccess: () => toast.success('Workflow resumed'),
    onError: (e) => toast.error('Resume failed', e.message),
  });
  const forkM = useForkWorkflow({
    onSuccess: (forked) => toast.success('Forked', `New id: ${forked.id.slice(0, 8)}`),
    onError: (e) => toast.error('Fork failed', e.message),
  });

  const protocol = workflow ? protocolFromTemplateId(workflow.templateId) : undefined;
  const protocolLabel = protocol ? protocol.charAt(0).toUpperCase() + protocol.slice(1) : undefined;
  const statusBadgeVariant = workflow ? statusBadgeMap[workflow.status] : undefined;
  const isDeployed = workflow?.status === 'deployed';
  const isPaused = workflow?.status === 'paused';
  const canRun = isDeployed && !!workflow?.keeperJobId;

  return {
    id,
    isLoading,
    isError,
    error: error ?? null,
    refetch: () => {
      void refetch();
    },
    workflow,
    protocol,
    protocolLabel,
    statusBadgeVariant,
    isDeployed,
    isPaused,
    canRun,
    liveStatus,
    liveStatusLoading,
    executions,
    executionsLoading,
    onchain,
    onchainLoading: listingsLoading,
    mutations: {
      run: {
        trigger: () => workflow && runM.mutate(workflow.id),
        isPending: runM.isPending,
      },
      pause: {
        trigger: () => workflow && pauseM.mutate(workflow.id),
        isPending: pauseM.isPending,
      },
      resume: {
        trigger: () => workflow && resumeM.mutate(workflow.id),
        isPending: resumeM.isPending,
      },
      fork: {
        trigger: () => workflow && forkM.mutate(workflow.id),
        isPending: forkM.isPending,
      },
    },
  };
}
