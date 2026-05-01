# ElizaOS Plugin Guide

## 목적

`plugins/elizaos`는 Loomlabs 템플릿을 ElizaOS agent action으로 노출합니다.
기본값은 안전한 dry-run이며, 환경변수와 host adapter를 명시적으로 설정한 경우에만 Sepolia live transaction을 실행합니다.

## 주요 action

- `BROWSE_TEMPLATES`: 로컬 템플릿과 Sepolia metadata 조회
- `DESCRIBE_TEMPLATE`: 특정 템플릿 상세 조회
- `CREATE_WORKFLOW_DEMO`: 자연어 입력을 dry-run workflow 후보로 변환
- `CREATE_WORKFLOW`: 환경변수에 따라 dry-run 또는 live-run 선택
- `CREATE_WORKFLOW_LIVE`: 명시적 Sepolia live-run 실행 경로

## 기본 dry-run 설정

아무 환경변수를 설정하지 않으면 dry-run으로 동작합니다.

```bash
LOOM_ELIZAOS_EXECUTION_MODE=dry-run-only
LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION=false
LOOM_CONFIRM_SEPOLIA_LIVE_EXECUTION=false
```

이 모드에서는 signer, RPC, wallet, private key가 필요하지 않고 transaction을 전송하지 않습니다.

## live-run 설정

`CREATE_WORKFLOW`를 실제 Sepolia 실행 경로로 전환하려면 아래 값을 설정합니다.

```bash
LOOM_ELIZAOS_EXECUTION_MODE=live-run
LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION=true
LOOM_CONFIRM_SEPOLIA_LIVE_EXECUTION=true
```

추가로 ElizaOS host/runtime에서 handler options로 다음 값을 주입해야 합니다.

- `signer`: `sendTransaction()`을 가진 host-injected signer adapter
- `reader`: `readContract()`와 `waitForReceipt()`를 가진 read adapter
- `account`: 실행 계정 주소
- `parameters`: 템플릿별 token, amount, feeTier 등 실행 파라미터

주의: plugin은 private key나 RPC URL을 직접 읽지 않습니다. private key/RPC 관리는 host adapter 책임입니다.

## live-run 안전 조건

실제 tx는 아래 조건을 모두 만족해야 실행됩니다.

- `chainId === 11155111`
- `LOOM_ENABLE_SEPOLIA_LIVE_EXECUTION=true`
- `LOOM_CONFIRM_SEPOLIA_LIVE_EXECUTION=true` 또는 `confirmLiveExecution=true`
- signer adapter 주입
- reader adapter 주입
- metadata가 `HUMAN_CONFIRMED`
- Uniswap은 `amountOutMinimum > 0`

조건이 하나라도 빠지면 transaction은 준비·전송되지 않고 차단 응답을 반환합니다.

## 예시 handler options

```ts
{
  parameters: {
    signer,
    reader,
    account: '0x...',
    parameters: {
      token: '0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5',
      amount: '1000000000000000'
    }
  }
}
```

## 검증 명령

```bash
pnpm --filter @loomlabs/plugin-elizaos typecheck
pnpm --filter @loomlabs/plugin-elizaos test
```
