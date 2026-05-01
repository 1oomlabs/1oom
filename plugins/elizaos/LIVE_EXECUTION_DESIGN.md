# ElizaOS Live Execution Design

## 상태

구현 문서입니다. 현재 브랜치에는 disabled-by-default live gate와 adapter 기반 실행 경로가 포함됩니다.
기본 action은 계속 dry-run이며, live 실행은 host가 signer/read adapter를 명시적으로 주입하고
`LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION`과 `confirmLiveExecution`을 모두 켠 경우에만 동작합니다.

## 목표

현재 `dry-run-only` ElizaOS plugin을 유지하면서, 승인된 host runtime에서 Sepolia live execution을
안전하게 호출할 수 있는 최소 실행 경로를 제공합니다.

대상 템플릿:

- `aave-recurring-deposit`
- `uniswap-dca`
- `lido-stake` with Sepolia mock contracts

## 기본 결정

- 기존 `CREATE_WORKFLOW`, `CREATE_WORKFLOW_DEMO`, `BROWSE_TEMPLATES`, `DESCRIBE_TEMPLATE`는 계속 `dry-run-only`로 둡니다.
- live 실행은 기존 action을 암묵적으로 확장하지 않고 별도 opt-in action 또는 별도 executor로 추가합니다.
- live 실행 기본값은 항상 비활성화입니다.
- private key는 plugin에 전달하지 않습니다.
- signer/RPC는 host runtime이 주입한 adapter로만 접근합니다.
- `apps/api`, `packages/keeperhub-client`, `packages/llm` 호출은 live transaction executor와 분리합니다.

## 모드 분리

```ts
type ExecutionMode = 'dry-run-only' | 'live-run';
```

### `dry-run-only`

현재 기본 모드입니다.

- signer 없음
- RPC 없음
- wallet 없음
- API key 없음
- KeeperHub deploy 없음
- transaction 생성 없음

### `live-run`

별도 action인 `CREATE_WORKFLOW_LIVE`로만 호출되는 명시적 모드입니다.

필수 조건:

- `chainId === 11155111`
- `executionMode === 'live-run'`
- `confirmLiveExecution === true`
- live feature flag 활성화
- signer adapter 주입 완료
- public client 또는 read adapter 주입 완료
- 모든 template parameter 확정
- 모든 contract metadata가 `HUMAN_CONFIRMED`

## 구현 인터페이스

새 의존성을 추가하지 않는 최소 경로는 host가 adapter를 주입하는 방식입니다.

```ts
type LiveExecutionContext = {
  mode: 'live-run';
  chainId: 11155111;
  account: `0x${string}`;
  signer: LiveSignerAdapter;
  reader: LiveReadAdapter;
  policy: LiveExecutionPolicy;
};

type LiveSignerAdapter = {
  account?: `0x${string}`;
  sendTransaction(input: PreparedTransaction): Promise<`0x${string}`>;
};

type LiveReadAdapter = {
  readContract(input: ReadContractCall): Promise<unknown>;
  waitForReceipt(hash: `0x${string}`): Promise<TransactionReceiptSummary>;
  getNativeBalance?(account: `0x${string}`): Promise<bigint>;
};

type LiveExecutionPolicy = {
  maxSlippageBps: number;
  deadlineSeconds: number;
  requireAllowanceCheck: true;
  requireBalanceCheck: true;
  requireReceipt: true;
};
```

현재 구현은 `plugins/elizaos`에 이미 존재하는 `viem` 의존성으로 ABI encoding만 수행합니다.
private key, RPC URL, wallet client는 plugin이 직접 생성하지 않습니다.

## Transaction lifecycle

live 실행은 아래 단계를 분리해야 합니다.

1. `validateLiveRequest`
   - chain, account, mode, feature flag 확인
   - unresolved metadata 차단
   - required parameter 확인
2. `prepareTransactions`
   - template action을 contract call plan으로 변환
   - 주소, ABI fragment, args resolve
   - 아직 서명이나 broadcast 없음
3. `preflightChecks`
   - token balance 확인
   - allowance 확인
   - native ETH balance 확인
   - slippage/deadline 정책 확인
4. `broadcastTransactions`
   - host-injected signer adapter로만 전송
   - 단계별 tx hash 기록
5. `confirmReceipts`
   - receipt 확인
   - 실패 시 후속 action 중단
6. `postExecutionVerification`
   - Aave aToken balance
   - Uniswap tokenOut balance 변화
   - Lido mock stETH/wstETH balance consistency

## Template별 live plan

### Aave deposit

흐름:

```text
ERC20.balanceOf(user)
ERC20.allowance(user, AAVE_POOL)
ERC20.approve(AAVE_POOL, amount) if needed
AavePool.supply(asset, amount, user, 0)
AaveAToken.balanceOf(user)
```

현재 Sepolia live 검증 자산:

- `LINK`: `0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5`
- `aLINK`: `0x3FfAf50D4F4E96eB78f2407c090b72e86eCaed24`
- 기존 DAI 경로는 Aave Pool이 `51`로 거절했습니다. Aave V3 오류 `51`은 `SUPPLY_CAP_EXCEEDED`라서 데모 live 검증 자산을 LINK로 전환했습니다.

정책:

- allowance가 충분하면 approve 생략 가능
- supply 전 token balance 부족 시 중단
- supply receipt 실패 시 aToken 검증 실행 금지

### Uniswap DCA

흐름:

```text
ERC20.balanceOf(user)
ERC20.allowance(user, UNISWAP_ROUTER)
ERC20.approve(UNISWAP_ROUTER, amountIn) if needed
UniswapRouter.exactInputSingle(params)
ERC20(tokenOut).balanceOf(user)
```

정책:

- live 실행에서 `amountOutMinimum = 0` 기본값 금지
- `amountOutMinimum`은 quote adapter 또는 사용자 승인 값으로만 설정
- deadline은 현재 시각 기준 `policy.deadlineSeconds`로 생성
- slippage는 `policy.maxSlippageBps`를 초과할 수 없음

### Lido mock stake

흐름:

```text
MockLido.submit(referral) with ETH value
MockStETH.balanceOf(user)
MockStETH.approve(MockWstETH, amount)
MockWstETH.wrap(amount)
MockWstETH.balanceOf(user)
```

정책:

- 실제 Lido가 아니라 Sepolia mock contract만 사용
- native ETH balance 부족 시 중단
- mock 주소는 `packages/templates` metadata의 `HUMAN_CONFIRMED` 값만 사용

## 실패 처리

모든 실패는 구조화된 결과로 반환합니다.

```ts
type LiveExecutionErrorCode =
  | 'LIVE_EXECUTION_DISABLED'
  | 'UNSUPPORTED_CHAIN'
  | 'MISSING_SIGNER'
  | 'MISSING_READER'
  | 'UNCONFIRMED_METADATA'
  | 'INVALID_PARAMETERS'
  | 'INSUFFICIENT_BALANCE'
  | 'INSUFFICIENT_ALLOWANCE'
  | 'SLIPPAGE_POLICY_VIOLATION'
  | 'TRANSACTION_REVERTED'
  | 'RECEIPT_TIMEOUT'
  | 'POST_CHECK_FAILED';
```

부분 성공이 가능한 경우에는 성공한 tx hash와 중단된 단계가 모두 필요합니다.

## 환경변수 전환

지원 환경값:

```text
LOOM_ELIZAOS_EXECUTION_MODE=dry-run-only
LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION=false
LOOM_CONFIRM_SEPOLIA_LIVE_EXECUTION=false
```

규칙:

- `LOOM_ELIZAOS_EXECUTION_MODE` 기본값은 `dry-run-only`입니다.
- `LOOM_ELIZAOS_EXECUTION_MODE=live-run`이면 `CREATE_WORKFLOW`가 `CREATE_WORKFLOW_LIVE`와 같은 live 경로를 사용합니다.
- `CREATE_WORKFLOW_DEMO`는 항상 dry-run 전용입니다.
- `CREATE_WORKFLOW_LIVE`는 action 이름 자체가 live 경로라서 execution mode env 없이도 live guard를 평가합니다.
- 실제 broadcast에는 `LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION=true`가 필요합니다.
- 실제 broadcast에는 `confirmLiveExecution=true` 옵션 또는 `LOOM_CONFIRM_SEPOLIA_LIVE_EXECUTION=true`가 필요합니다.
- env가 모두 live 상태여도 signer/read adapter가 없으면 실행되지 않습니다.
- private key와 RPC URL은 plugin env로 읽지 않고 host adapter가 책임집니다.
- test와 CI에서는 기본적으로 `dry-run-only` / feature flag off 상태를 유지합니다.
- live test는 별도 opt-in 명령으로만 실행합니다.

## 테스트 전략

기본 테스트는 계속 RPC/signer 없이 실행되어야 합니다.

필수 테스트:

- `dry-run-only` action이 live adapter 없이 계속 통과
- feature flag off이면 live 실행 거부
- signer 누락이면 live 실행 거부
- RPC/read adapter 누락이면 live 실행 거부
- unconfirmed metadata가 있으면 live 실행 거부
- Uniswap `amountOutMinimum = 0` 거부
- transaction prepare와 broadcast 분리 확인
- receipt 실패 시 후속 action 중단 확인

live Sepolia 테스트는 별도 승인 후 수동 또는 opt-in CI로만 실행합니다.

## KeeperHub / API 경계

live transaction executor는 KeeperHub deploy와 같은 책임을 갖지 않습니다.

- KeeperHub workflow deploy는 `apps/api`와 `packages/keeperhub-client` 책임입니다.
- ElizaOS plugin은 현재처럼 template 후보와 dry-run/live 실행 계획을 반환합니다.
- live-run transaction broadcast를 붙이더라도 KeeperHub deploy를 자동 호출하지 않습니다.
- API 연동이 필요하면 별도 API 계약과 사람 승인이 필요합니다.

## 구현 순서 제안

1. [x] live type과 disabled-by-default guard 추가
2. [x] live request validation test 추가
3. [x] transaction plan builder 추가
4. [x] preflight checker 추가
5. [x] signer/read adapter interface 추가
6. [x] Aave live executor 추가
7. [x] Lido mock live executor 추가
8. [x] Uniswap live executor 추가
9. [ ] opt-in Sepolia live test 추가
10. [ ] API/KeeperHub 연동 여부 별도 결정

## 수동 Sepolia live 검증 기록

- `lido-stake`: MockLido `submit`, MockStETH `approve`, MockWstETH `wrap` 성공
- `uniswap-dca`: WETH -> USDC `approve`와 `exactInputSingle` 성공
- `aave-recurring-deposit`: DAI는 `SUPPLY_CAP_EXCEEDED`로 실패, LINK로 전환 후 `supply` 성공

## 현재 구현 상태

현재 구현된 범위:

- `CREATE_WORKFLOW_LIVE` action 추가
- `evaluateLiveExecutionRequest()` guard 추가
- `executeLiveExecutionRequest()` adapter 기반 실행기 추가
- feature flag off 차단
- Sepolia 외 chain 차단
- 명시적 live confirmation 누락 차단
- signer/reader adapter 누락 차단
- unconfirmed metadata 차단
- Uniswap `amountOutMinimum = 0` 차단
- Aave `approve -> supply`
- Uniswap `approve -> exactInputSingle`
- Lido mock `submit -> approve -> wrap`
- balance / allowance / native ETH preflight
- tx hash / receipt 확인
- post-check read call

아직 구현하지 않은 범위:

- 실제 Sepolia 지갑/RPC adapter
- 실제 Sepolia live test
- Uniswap quote source
- gas 정책
- API/KeeperHub 연동

## 승인 필요 사항

- 실제 Sepolia 테스트 실행 여부
- signer adapter를 Web wallet, ElizaOS runtime, API 중 어디서 주입할지 여부
- Uniswap quote source
- live Sepolia 테스트 실행 권한과 지갑 자금 관리 방식
- KeeperHub deploy와 live transaction broadcast를 같은 UX에 묶을지 여부

## 현재 결론

기본 사용자 흐름은 계속 `dry-run-only`가 맞습니다. live 실행은 별도 `CREATE_WORKFLOW_LIVE`
action에서만 가능하며, host가 signer/read adapter를 주입하지 않으면 실행되지 않습니다.
