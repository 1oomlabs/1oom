# Loomlabs Dry-run Integration Guide

## 목적

이 문서는 현재 구현된 `packages/templates`와 `plugins/elizaos`의 dry-run 통합 계약을 정리합니다. 다른 팀은 이 문서를 기준으로 템플릿 조회, Sepolia metadata 조회, ElizaOS action 호출, marketplace 표시 연동을 진행하면 됩니다.

기본 범위는 **dry-run demo first**입니다. 기본 설정에서는 실제 private key,
KeeperHub deploy, API 호출을 수행하지 않습니다.
단, `CREATE_WORKFLOW_LIVE`는 host가 signer/read adapter를 명시적으로 주입한 경우에만 Sepolia
transaction을 실행할 수 있는 opt-in 경로를 제공합니다. 또한 `live-run`으로 전환하면
ElizaOS agent가 실제 Loomlabs API의 marketplace/workflow endpoint를 호출할 수 있습니다.

## 공통 원칙

- 기존 `Template` 객체에는 chain metadata를 넣지 않습니다.
- Sepolia 주소, ABI, runtime placeholder는 `sepoliaTemplateMetadata`에서 별도로 조회합니다.
- 모든 ElizaOS action 응답은 `ActionResult` 형태입니다.
- 기본 실행 응답은 `executionMode: 'dry-run-only'`를 포함해야 합니다.
- live execution은 `CREATE_WORKFLOW_LIVE`에서만 가능하며 feature flag, confirmation, signer,
  reader가 모두 필요합니다.
- app API 연동은 `LOOM_ELIZAOS_EXECUTION_MODE=live-run`에서만 동작합니다.
- `LOOM_API_BASE_URL` 없이는 live-run API 호출이 차단됩니다.

## Template ID

아래 ID를 고정 값으로 사용합니다.

```ts
'aave-recurring-deposit'
'uniswap-dca'
'lido-stake'
```

## `@loomlabs/templates` 사용 위치

### Web / Marketplace UI

사용 대상:

```ts
import { findTemplatesByKeyword, getTemplateById, templates } from '@loomlabs/templates';
```

사용 방식:

- 목록 화면: `templates`
- 상세 화면: `getTemplateById(templateId)`
- 검색/필터: `findTemplatesByKeyword(keyword)`

사용해야 하는 기본 필드:

```ts
template.id
template.name
template.description
template.protocol
template.category
template.intentKeywords
template.parameters
template.trigger
template.actions
```

주의:

- Web UI는 `Template` 객체에 `sepolia`, `chainId`, `abi`, `contracts` 필드가 있다고 가정하면 안 됩니다.
- Sepolia 정보가 필요하면 아래 metadata API를 별도로 사용합니다.

### API / Backend

사용 대상:

```ts
import {
  getSepoliaTemplateMetadata,
  getTemplateById,
  validateTemplatesForSepolia,
} from '@loomlabs/templates';
```

사용 방식:

- 템플릿 기본 정보: `getTemplateById(templateId)`
- Sepolia 주소/ABI 조회: `getSepoliaTemplateMetadata(templateId)`
- 서버 시작 또는 CI 검증: `validateTemplatesForSepolia()`

주의:

- 현재 metadata는 transaction 생성용이 아니라 demo 검증용입니다.
- API에서 KeeperHub deploy 또는 live transaction을 호출하면 안 됩니다.

### Template / Validation 작업

사용 대상:

```ts
import {
  getSepoliaTemplateMetadata,
  sepoliaTemplateMetadata,
  validateTemplatesForSepolia,
} from '@loomlabs/templates';
```

검증 대상:

- template schema 통과
- template ID 중복 없음
- action placeholder coverage
- Sepolia metadata coverage
- ABI fragment shape
- unresolved confirmation 상태
- dry-run safety boundary

## Sepolia metadata 사용법

```ts
const template = getTemplateById('lido-stake');
const metadata = getSepoliaTemplateMetadata('lido-stake');
```

주요 필드:

```ts
metadata.chainId; // 11155111
metadata.network; // 'sepolia'
metadata.executionMode; // 'dry-run-only'
metadata.demoOnly; // true
metadata.contracts;
metadata.runtimePlaceholders;
metadata.runtimePlaceholderValues;
metadata.demoParameters;
metadata.unsupportedOperations;
```

### Aave

- Template ID: `aave-recurring-deposit`
- 주요 runtime placeholder: `$AAVE_POOL`, `$user`
- Sepolia Pool:

```text
0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951
```

### Uniswap

- Template ID: `uniswap-dca`
- 주요 runtime placeholder: `$UNISWAP_ROUTER`, `$user`
- Sepolia SwapRouter02:

```text
0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
```

### Lido mock

- Template ID: `lido-stake`
- 실제 Lido Sepolia가 아니라 mock flow입니다.
- 주요 runtime placeholder: `$MOCK_WSTETH`

```text
MockLido:  0x800AB7B237F8Bf9639c0E9127756a5b9049D0C73
MockStETH: 0xE1264e5AADb69A27bE594aaafc502D654FFbaC97
MockWstETH: 0xc4936b9baA6E09a5Aa39dCE7001d24aAE84E97fF
```

## `@loomlabs/plugin-elizaos` 사용 위치

### ElizaOS Agent / Plugin loading

사용 대상:

```ts
import loomPlugin from '@loomlabs/plugin-elizaos';
```

Plugin은 `@elizaos/core`의 `Plugin` / `Action` / `ActionResult` 형태에 맞춰져 있습니다.

현재 action 목록:

```ts
CREATE_WORKFLOW
BROWSE_MARKETPLACE
BROWSE_TEMPLATES
DESCRIBE_TEMPLATE
CREATE_WORKFLOW_DEMO
CREATE_WORKFLOW_LIVE
```

모든 action은 다음을 보장합니다.

- `validate()` 제공
- `handler()` 제공
- `ActionResult` 반환
- `success`, `text`, `data` 포함
- 실제 transaction 실행 없음

## App API 연동 계약

ElizaOS 담당 영역에서 app API를 호출할 때는 `plugins/elizaos`만 수정합니다.
`apps/api` endpoint 계약은 읽기 전용으로 사용합니다.
별도 API 전용 모드는 두지 않고 `dry-run` / `live-run` 두 모드만 사용합니다.

### Marketplace 조회

환경변수:

```bash
LOOM_ELIZAOS_EXECUTION_MODE=live-run
LOOM_API_BASE_URL=http://localhost:8787
```

호출:

```ts
BROWSE_MARKETPLACE
```

실제 요청:

```txt
GET /api/marketplace?tag=&author=&protocol=&sort=&limit=
```

응답은 그대로 `data.items`, `data.total`, `data.source: 'api'`로 노출합니다.
`dry-run` 기본값은 계속 `local-demo-registry`입니다.

### Workflow 생성

환경변수:

```bash
LOOM_ELIZAOS_EXECUTION_MODE=live-run
LOOM_API_BASE_URL=http://localhost:8787
```

호출:

```ts
CREATE_WORKFLOW
```

handler options:

```ts
{
  parameters: {
    owner: '0x...',
    chainId: 11155111
  }
}
```

실제 요청:

```txt
POST /api/workflows
```

body:

```json
{
  "prompt": "deposit LINK to Aave",
  "owner": "0x...",
  "chainId": 11155111
}
```

### Marketplace 게시

자동 게시가 필요하면 아래 값을 켭니다.

```bash
LOOM_ELIZAOS_AUTO_PUBLISH=true
```

`CREATE_WORKFLOW`가 `POST /api/workflows` 성공 후 `workflow.id`를 사용해 다음 요청을 보냅니다.

```txt
POST /api/marketplace
```

body:

```json
{
  "workflowId": "workflow-id",
  "author": "0x...",
  "tags": ["agent-created"],
  "pricing": { "type": "free" }
}
```

`author`, `tags`, `pricing`은 handler options의 `parameters`에서 전달합니다.

## Gensyn AXL dry-run flow

현재 AXL 연동은 **additive-only dry-run metadata**입니다. 기존 API,
contracts, schema를 호출하거나 변경하지 않고, ElizaOS action 응답에 후속 AXL
전송/발견 단계가 참고할 수 있는 draft를 추가합니다.

공식 AXL node는 local HTTP API를 통해 P2P mesh에 접근합니다. 이 plugin은
해당 API를 호출하지 않고, 아래 endpoint에 대응되는 envelope shape만 만듭니다.

```ts
GET /topology
POST /send
GET /recv
POST /mcp/{peer_id}/{service}
POST /a2a/{peer_id}
```

추가 응답 필드:

```ts
data.axlFlow
data.axlDryRun
data.registryHints
data.onchainPublishDraft
data.axlEnvelopeDraft
```

의미:

- `axlFlow`: AXL transport와 dry-run 차단 사유
- `axlDryRun`: 기존 workflow action을 API step으로 투영한 MCP/A2A request preview
- `registryHints`: `MarketplaceRegistry.register(bytes32,string)`와 curator flow 힌트
- `onchainPublishDraft`: canonical workflow JSON의 `keccak256` hash와 registry URI
- `axlEnvelopeDraft`: AXL `/send` raw message로 보낼 수 있는 draft envelope

### MCP / A2A request preview

`axlDryRun`은 실제 AXL node를 호출하지 않고, 실제 배포 환경이라면
`localhost:9002`로 보낼 요청을 미리 보여줍니다.

```ts
data.axlDryRun.axlModeNotice ===
  '현재는 AXL dry-run mode이며 실제 배포에서는 localhost:9002의 AXL node를 호출한다.'
```

MCP preview는 workflow의 API step을 MCP tool처럼 취급합니다.

```ts
data.axlDryRun.protocol === 'MCP'
data.axlDryRun.generatedAxlRequestPreview.method === 'POST'
data.axlDryRun.generatedAxlRequestPreview.url ===
  'http://127.0.0.1:9002/mcp/{peer_id}/{service}'
data.axlDryRun.generatedAxlRequestPreview.body.method === 'tools/list'
```

MCP tool registry는 실제 MCP server 없이 `tools/list` 응답에 해당하는 metadata를
제공합니다.

```ts
data.axlDryRun.mcpToolRegistry.tools.map((tool) => tool.name)
// ['quote', 'riskCheck', 'simulate', 'buildUnsignedTx']

data.axlDryRun.globalMcpTools.map((tool) => tool.name)
// ['browse_marketplace', 'create_workflow']

data.axlDryRun.globalMcpTools.find((tool) => tool.name === 'create_workflow')
  .wouldCall === 'POST /api/workflows'
```

A2A preview는 workflow 전체를 agent/skill처럼 취급합니다.

```ts
data.axlDryRun.protocol === 'A2A'
data.axlDryRun.generatedAxlRequestPreview.method === 'POST'
data.axlDryRun.generatedAxlRequestPreview.url ===
  'http://127.0.0.1:9002/a2a/{peer_id}'
data.axlDryRun.generatedAxlRequestPreview.body.method === 'message/send'
```

A2A agent card는 실제 A2A server 없이 workflow 전체를 agent skill metadata로
노출합니다.

```ts
data.axlDryRun.a2aAgentCard.protocol === 'A2A'
data.axlDryRun.a2aAgentCard.skills[0].mappedWorkflowId === data.templateId
data.axlDryRun.a2aAgentCard.skills[0].mappedApiStepIds.length === 4
```

공통 safety contract:

```ts
data.axlDryRun.safety.signing === false
data.axlDryRun.safety.broadcast === false
data.axlDryRun.safety.requiresUserApproval === true
data.axlDryRun.safety.dryRunOnly === true
```

주의:

- 실제 AXL node 실행, peer discovery, `/send` 호출은 하지 않습니다.
- 실제 `MarketplaceRegistry` transaction broadcast는 하지 않습니다.

안전 경계:

- 기존 dry-run action은 계속 external fetch 없이 동작합니다.
- AXL action은 명시적으로 호출될 때만 `/topology`, `/send`, `/recv`를 사용합니다.
- `EXECUTE_RECEIVED_AXL_WORKFLOW`는 수신 envelope의 `contentHash`를 재계산해
  검증한 뒤에만 `LOOM_API_URL/api/workflows`로 넘깁니다.
- plugin은 private key, RPC URL, KeeperHub API key를 보관하거나 응답에 노출하지
  않습니다.

현재 검증된 범위:

- `@elizaos/core` `AgentRuntime` + `InMemoryDatabaseAdapter` 기반 local fixture에서 plugin loading 성공
- runtime action discovery에 Loomlabs action 6개 노출 확인
- `BROWSE_TEMPLATES`, `DESCRIBE_TEMPLATE`, `CREATE_WORKFLOW_DEMO`가 실제 `AgentRuntime`을 통해 실행됨
- `CREATE_WORKFLOW_LIVE`는 발견 가능하지만 기본값에서 `LIVE_EXECUTION_DISABLED`로 차단됨
- fixture의 external fetch 호출 수는 `0`

주의:

- 이 검증은 local in-memory runtime loading 검증입니다.
- 실제 장기 실행 ElizaOS project/agent 배포 환경은 별도 확인 전까지 `INTEGRATION_RISK`를 유지합니다.

## ElizaOS action별 계약

### `BROWSE_TEMPLATES`

사용 위치:

- Agent가 사용 가능한 로컬 DeFi template 목록을 조회할 때
- Web/API 없이 ElizaOS 안에서 template catalog를 설명할 때

입력 예시:

```text
Browse available DeFi templates
```

응답 요약:

```ts
{
  success: true,
  data: {
    ok: true,
    executionMode: 'dry-run-only',
    templates: [
      {
        id: 'aave-recurring-deposit',
        sepolia: { executionMode: 'dry-run-only' }
      }
    ]
  }
}
```

### `DESCRIBE_TEMPLATE`

사용 위치:

- 특정 template 상세 설명
- parameter, trigger, action, Sepolia metadata 확인

입력 예시:

```text
templateId=lido-stake
```

응답 요약:

```ts
{
  success: true,
  data: {
    ok: true,
    executionMode: 'dry-run-only',
    template: {
      id: 'lido-stake',
      actions: [],
      sepolia: {
        contracts: [],
        runtimePlaceholderValues: []
      }
    }
  }
}
```

### 환경변수로 dry-run / live-run 전환

`CREATE_WORKFLOW`는 아래 환경변수를 읽어 기본 경로를 선택합니다.

```text
LOOM_ELIZAOS_EXECUTION_MODE=dry-run-only
LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION=false
LOOM_CONFIRM_SEPOLIA_LIVE_EXECUTION=false
```

- `dry-run-only`: 기본값이며 transaction을 만들지 않습니다.
- `live-run`: `CREATE_WORKFLOW`가 live executor를 호출합니다.
- 실제 broadcast에는 `LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION=true`와 `LOOM_CONFIRM_SEPOLIA_LIVE_EXECUTION=true` 또는 handler option `confirmLiveExecution=true`가 필요합니다.
- env를 live로 바꿔도 signer/read adapter가 없으면 차단됩니다.
- `CREATE_WORKFLOW_DEMO`는 env와 무관하게 항상 dry-run입니다.

### `CREATE_WORKFLOW_LIVE`

사용 위치:

- live 실행 요청 UI 또는 agent flow가 잘못 dry-run action을 우회하지 않는지 확인할 때
- Sepolia live-run을 host-injected signer/read adapter로 실행할 때

현재 상태:

- 기본값은 항상 차단됩니다.
- `LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION=true`
- `confirmLiveExecution=true`
- `chainId=11155111`
- signer adapter와 reader adapter 주입
- metadata `HUMAN_CONFIRMED`
- 위 조건을 모두 만족하면 adapter를 통해 transaction을 생성, 전송, receipt 확인합니다.
- 조건이 하나라도 빠지면 차단 응답을 반환하고 transaction을 준비하지 않습니다.

차단 코드:

```ts
LIVE_EXECUTION_DISABLED
LIVE_CONFIRMATION_REQUIRED
UNSUPPORTED_CHAIN
MISSING_SIGNER
MISSING_READER
UNCONFIRMED_METADATA
INVALID_PARAMETERS
INSUFFICIENT_BALANCE
SLIPPAGE_POLICY_VIOLATION
TRANSACTION_REVERTED
POST_CHECK_FAILED
```

주의:

- private key나 RPC URL은 plugin에 직접 전달하지 않습니다.
- signer/read adapter는 host runtime 책임입니다.
- 성공 시 tx hash와 receipt summary를 반환할 수 있습니다.
- KeeperHub deploy 또는 API workflow 등록은 수행하지 않습니다.

### `CREATE_WORKFLOW_DEMO`

사용 위치:

- 자연어 입력을 template 후보로 매핑
- 실제 workflow deploy 전 dry-run payload 생성

입력 예시:

```text
deposit LINK to Aave
DCA USDC to WETH
stake ETH with Lido
```

응답 요약:

```ts
{
  success: true,
  text: 'Selected lido-stake (Lido ETH Stake) for lido/staking. Mode: dry-run-only on sepolia. Execution is unavailable because api-deploy, contract-deployment, keeperhub-deploy. No transaction was executed.',
  data: {
    ok: true,
    executionMode: 'dry-run-only',
    templateId: 'lido-stake',
    templateName: 'Lido ETH Stake',
    protocol: 'lido',
    category: 'staking',
    chainId: 11155111,
    network: 'sepolia',
    parameters: {},
    actions: [],
    runtimePlaceholderValues: [],
    contracts: [],
    safety: {
      callsKeeperHub: false,
      callsExternalLlm: false,
      callsAppApi: false,
      requiresApiKey: false,
      requiresSigner: false,
      requiresRpc: false
    },
    intent: {
      templateId: 'lido-stake',
      confidence: 0.85,
      parameters: {}
    },
    workflowDraft: {
      templateId: 'lido-stake',
      chainId: 11155111,
      network: 'sepolia',
      executionMode: 'dry-run-only',
      parameters: {},
      actions: [],
      runtimePlaceholderValues: [],
      contracts: [],
      unsupportedOperations: [
        'api-deploy',
        'keeperhub-deploy',
        'real-transaction-execution'
      ],
      deployStatus: 'dry-run-not-submitted',
      deployBlockedBy: [
        'keeperhub-deploy',
        'api-deploy',
        'real-transaction-execution'
      ]
    },
    templateCandidates: [],
    unsupportedOperations: [
      'real-transaction-execution',
      'signer-required',
      'keeperhub-deploy',
      'api-deploy'
    ]
  }
}
```

후속 시스템은 우선 아래 top-level 필드를 사용하면 됩니다.

```ts
data.templateId
data.chainId
data.parameters
data.actions
data.runtimePlaceholderValues
data.contracts
data.unsupportedOperations
data.safety
```

`data.workflowDraft`는 위 필드를 묶은 dry-run 제출 후보이며, 실제 제출 상태는 아닙니다.

### `BROWSE_MARKETPLACE`

사용 위치:

- ElizaOS demo agent가 local demo marketplace처럼 template 목록을 보여줄 때
- 실제 marketplace API 호출 없이 local registry 기반 listing이 필요할 때

응답 특징:

- `source: 'local-demo-registry'`
- `pricing.type: 'free'`
- template 기본 필드 유지
- top-level `axlFlow`, `registryHints`, `axlEnvelopeDraft` 제공
- 각 item에 `registryHints`, `onchainPublishDraft`, `axlEnvelopeDraft` 제공

### `CREATE_WORKFLOW`

사용 위치:

- 기존 호환 action
- 현재는 `CREATE_WORKFLOW_DEMO`와 동일하게 dry-run 후보만 생성

주의:

- 이름은 workflow 생성이지만 실제 deploy는 하지 않습니다.

## KeeperHub / LLM / API 경계

현재 ElizaOS plugin은 아래 작업을 하지 않습니다.

- `keeperhub-client` deploy 호출
- `packages/llm` 외부 LLM API 호출
- `apps/api` 호출
- RPC 호출
- signer/wallet 접근
- transaction 생성/서명/전송

응답의 `data.safety`는 아래 값을 명시합니다.

```ts
{
  callsKeeperHub: false,
  callsExternalLlm: false,
  callsAppApi: false,
  requiresApiKey: false,
  requiresSigner: false,
  requiresRpc: false
}
```

응답의 `workflowDraft`는 후속 시스템이 참고할 수 있는 dry-run draft입니다. 이 값은 deploy-ready 형태를 지향하지만, 실제 submit 상태가 아닙니다.

```ts
workflowDraft.deployStatus === 'dry-run-not-submitted'
```

AXL 관련 draft도 같은 원칙을 따릅니다.

```ts
onchainPublishDraft.expectedStatus === 'Pending'
onchainPublishDraft.author === 'runtime-signer-required'
axlEnvelopeDraft.transport === 'axl.raw'
```

다른 팀이 실제 UI/API 실행 버튼을 붙이려면 `CREATE_WORKFLOW_LIVE`에 signer/read adapter를 주입하는
host 계층을 별도로 구현해야 합니다.

## 금지된 가정

다음 가정은 하면 안 됩니다.

- `Template` 객체에 Sepolia metadata가 들어 있다.
- 기본 ElizaOS dry-run action이 실제 transaction을 실행한다.
- Lido가 실제 Lido Sepolia contract를 사용한다.
- `CREATE_WORKFLOW`가 KeeperHub에 deploy한다.
- dry-run 응답에 있는 ABI/address가 곧바로 broadcast용 tx 생성을 의미한다.

## 검증 명령

현재 통합 검증은 아래 명령으로 확인합니다.

```bash
pnpm --filter @loomlabs/templates typecheck
pnpm --filter @loomlabs/plugin-elizaos typecheck
pnpm --filter @loomlabs/plugin-elizaos test
pnpm lint
pnpm test
```

`pnpm --filter @loomlabs/plugin-elizaos test`는 local smoke test와 실제 `@elizaos/core` `AgentRuntime` loading fixture를 함께 실행합니다.

전체 monorepo typecheck/build는 다른 scope의 상태에 영향을 받을 수 있습니다. Person C 변경 검증은 위 명령을 우선 기준으로 봅니다.

## Live execution 남은 추가 명세

adapter 기반 실행기는 구현되어 있습니다. 실제 Sepolia 운영 전에는 아래 내용을 확정해야 합니다.

- signer 주입 방식
- RPC/read adapter 주입 방식
- Uniswap quote source
- slippage / gas 정책
- 환경변수 목록
- live test opt-in 방식

현재 설계와 구현 상태는 `plugins/elizaos/LIVE_EXECUTION_DESIGN.md`에 정리되어 있습니다.
