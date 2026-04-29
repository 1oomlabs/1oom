# Loomlabs Dry-run Integration Guide

## 목적

이 문서는 현재 구현된 `packages/templates`와 `plugins/elizaos`의 dry-run 통합 계약을 정리합니다. 다른 팀은 이 문서를 기준으로 템플릿 조회, Sepolia metadata 조회, ElizaOS action 호출, marketplace 표시 연동을 진행하면 됩니다.

현재 범위는 **dry-run demo only**입니다. 실제 signer, RPC, wallet, private key, KeeperHub deploy, Sepolia transaction broadcast는 지원하지 않습니다.

## 공통 원칙

- 기존 `Template` 객체에는 chain metadata를 넣지 않습니다.
- Sepolia 주소, ABI, runtime placeholder는 `sepoliaTemplateMetadata`에서 별도로 조회합니다.
- 모든 ElizaOS action 응답은 `ActionResult` 형태입니다.
- 모든 실행 응답은 `executionMode: 'dry-run-only'`를 포함해야 합니다.
- live execution은 별도 설계와 승인 전까지 구현하지 않습니다.

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
MockWstETH: 0x657e385278B022Bd4cCC980C71fe9Feb3Ea60f08
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
```

모든 action은 다음을 보장합니다.

- `validate()` 제공
- `handler()` 제공
- `ActionResult` 반환
- `success`, `text`, `data` 포함
- 실제 transaction 실행 없음

현재 검증된 범위:

- `@elizaos/core` `AgentRuntime` + `InMemoryDatabaseAdapter` 기반 local fixture에서 plugin loading 성공
- runtime action discovery에 Loomlabs action 5개 노출 확인
- `BROWSE_TEMPLATES`, `DESCRIBE_TEMPLATE`, `CREATE_WORKFLOW_DEMO`가 실제 `AgentRuntime`을 통해 실행됨
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

### `CREATE_WORKFLOW_DEMO`

사용 위치:

- 자연어 입력을 template 후보로 매핑
- 실제 workflow deploy 전 dry-run payload 생성

입력 예시:

```text
deposit DAI to Aave
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

다른 팀이 실제 실행을 붙이려면 먼저 live execution 설계를 별도 문서로 확정해야 합니다.

## 금지된 가정

다음 가정은 하면 안 됩니다.

- `Template` 객체에 Sepolia metadata가 들어 있다.
- ElizaOS action이 실제 transaction을 실행한다.
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

## Live execution 전 필요한 추가 명세

live 작업 전에는 아래 내용을 별도 명세로 확정해야 합니다.

- signer 주입 방식
- RPC 주입 방식
- dry-run/live-run mode 분리
- tx construction / tx broadcast 분리
- balance / allowance check
- slippage / deadline / gas 정책
- receipt / error 응답 구조
- 환경변수 목록
- live test opt-in 방식
