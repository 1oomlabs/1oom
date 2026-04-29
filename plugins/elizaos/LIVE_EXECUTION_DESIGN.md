# ElizaOS Live Execution Design

## 상태

제안 문서입니다. 이 문서는 실제 실행 구현 전에 필요한 경계와 인터페이스를 정의합니다. 현재 브랜치에서는 코드 실행 경로, RPC 호출, signer 접근, transaction 생성, broadcast를 구현하지 않습니다.

## 목표

현재 `dry-run-only` ElizaOS plugin을 유지하면서, 추후 승인된 별도 단계에서 Sepolia live execution을 안전하게 붙일 수 있는 설계를 확정합니다.

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

별도 승인 후 추가할 명시적 모드입니다.

필수 조건:

- `chainId === 11155111`
- `executionMode === 'live-run'`
- `confirmLiveExecution === true`
- live feature flag 활성화
- signer adapter 주입 완료
- public client 또는 read adapter 주입 완료
- 모든 template parameter 확정
- 모든 contract metadata가 `HUMAN_CONFIRMED`

## 제안 인터페이스

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
  sendTransaction(input: PreparedTransaction): Promise<`0x${string}`>;
};

type LiveReadAdapter = {
  readContract(input: ReadContractCall): Promise<unknown>;
  waitForReceipt(hash: `0x${string}`): Promise<TransactionReceiptSummary>;
};

type LiveExecutionPolicy = {
  maxSlippageBps: number;
  deadlineSeconds: number;
  requireAllowanceCheck: true;
  requireBalanceCheck: true;
  requireReceipt: true;
};
```

`viem` 또는 `ethers`를 plugin package에 직접 추가하는 방식은 `package.json`과 `pnpm-lock.yaml` 변경이 필요하므로 별도 사람 승인이 필요합니다.

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
   - signer adapter로만 전송
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

## Feature flag

제안 환경값:

```text
LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION=false
```

규칙:

- 기본값은 `false`
- test와 CI에서는 기본적으로 `false`
- `true`여도 `confirmLiveExecution !== true`면 실행 불가
- live test는 별도 opt-in 명령으로만 실행

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

1. live type과 disabled-by-default guard 추가
2. live request validation test 추가
3. transaction plan builder 추가
4. preflight checker 추가
5. signer/read adapter interface 추가
6. Aave live executor 추가
7. Lido mock live executor 추가
8. Uniswap live executor 추가
9. opt-in Sepolia live test 추가
10. API/KeeperHub 연동 여부 별도 결정

## 승인 필요 사항

- `viem` 또는 다른 chain library를 plugin package에 추가할지 여부
- live action 이름과 외부 API 계약
- signer adapter를 Web wallet, ElizaOS runtime, API 중 어디서 주입할지 여부
- Uniswap quote source
- live Sepolia 테스트 실행 권한과 지갑 자금 관리 방식
- KeeperHub deploy와 live transaction broadcast를 같은 UX에 묶을지 여부

## 현재 결론

현재 구현은 `dry-run-only` 유지가 맞습니다. 다음 구현 단계에서는 live execution을 기존 action에 섞지 말고, feature flag와 명시적 confirm gate가 있는 별도 live executor로 추가해야 합니다.
