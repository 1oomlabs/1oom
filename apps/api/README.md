# loomlabs API

> 자연어로 DeFi 워크플로우를 만들고, KeeperHub에 자동 배포하는 백엔드.
> ETHGlobal 해커톤 — Person B (Backend + LLM) 영역

자연어 한 줄로 자동화 워크플로우를 만들고, KeeperHub로 실제 cron/조건부 실행을 맡기고, 마켓플레이스에서 공유까지 한 번에 처리하는 API 서버. Anthropic Claude Haiku로 의도를 추출하고, Zod 스키마로 런타임 검증한 뒤, KeeperHub HTTP API로 등록한다. 워크플로우/listing/agent는 **Postgres(Supabase) + Prisma**로 영속 저장 — 서버 재시작에도 휘발 X.

---

## 1. 아키텍처

### 1-1. 자연어 → 배포까지의 흐름

<img src="./docs/architecture.png" alt="architecture" width="720">

사용자가 자연어로 입력하면 프론트(A)가 `POST /api/workflows`로 백엔드(B)에 전달한다. 백엔드 안에서 LLM이 의도를 추출하고, 템플릿과 합쳐 워크플로우 객체로 빌드·검증, **Postgres(Supabase)에 영속 저장**, KeeperHub에 등록까지 한 번에 처리해서 `keeperJobId`를 받아온다.

### 1-2. α + β 통합 — 워크플로우 생성 + 마켓 + 에이전트

영역별 라벨: ★ = B 영역 (이 패키지), C/D는 별도 영역.

```
                    ┌──────────────────────┐
                    │  사용자 (자연어 입력)  │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
           [α 경로]                        [β 경로]
   "내가 직접 워크플로우 만들거"        "다른 사람 거 사고팔거"
                │                             │
                ▼                             ▼
   ┌──────────────────────────┐  ┌──────────────────────────┐
   │ ★ B 영역                 │  │ ★ B 영역                 │
   │ POST /api/workflows      │  │ GET  /api/marketplace    │
   │ → LLM intent             │  │ POST /api/marketplace    │
   │ → compile                │  │                          │
   │ → KeeperHub deploy       │  │ (결제: D의 AXL 영역)       │
   │ → keeperJobId 받음        │  │                          │
   └──────────────────────────┘  └──────────────────────────┘
                ▲                             │
                │                             │
                │      [β 또 다른 진입]          │
                │                             │
                │   ┌──────────────────────┐  │
                │   │ C 영역                │  │
                └───┤ ElizaOS plugin        │◄─┘
                    │ · @loomlabs/llm import │
                    │ · B의 LLM 직접 호출    │
                    └──────────────────────┘
```

### 1-3. 패키지 구성

```
apps/api/                          # ← 이 README의 대상
├── prisma/
│   ├── schema.prisma              # Workflow / MarketplaceListing / Agent 모델 (Postgres)
│   ├── seed.ts                    # 기본 Loomlabs 에이전트 시드
│   └── migrations/                # 자동 생성된 마이그레이션 SQL 이력 (Git 커밋)
├── src/
│   ├── index.ts                   # Hono 서버 부트스트랩, 라우터 마운트, 에러 핸들러
│   ├── env.ts                     # 환경변수 zod 검증 (CORS_ORIGIN 다중 origin 지원)
│   ├── db.ts                      # Prisma client 싱글톤 (hot reload 시 누수 방지)
│   ├── store.ts                   # Workflow CRUD (Prisma)
│   ├── marketplaceStore.ts        # MarketplaceListing CRUD (Prisma)
│   ├── keeperhub.ts               # KeeperHubClient 싱글톤
│   ├── log.ts                     # 단계별 로그 헬퍼
│   ├── errors.ts                  # 친절 에러 매퍼
│   ├── validate.ts                # zValidator wrapper (친절 에러 통일)
│   ├── services/
│   │   └── compile.ts             # intent → Workflow 변환 + 검증
│   └── routes/
│       ├── llm.ts                 # /api/llm/*
│       ├── workflows.ts           # /api/workflows/*
│       ├── marketplace.ts         # /api/marketplace/* (protocol 필터, limit 지원)
│       ├── agents.ts              # /api/agents/* (DB 조회)
│       └── templates.ts           # /api/templates/* (정적 카탈로그 노출)
├── demo.http                      # REST Client 시연 시나리오 (자동 ID 체이닝)
└── README.md                      # 이 파일

# 외부 패키지 (이 API가 의존)
packages/llm/                      # extractWorkflowIntent (Anthropic 호출)
packages/keeperhub-client/         # KeeperHub HTTP wrapper
packages/schema/                   # workflow/template/marketplace 스키마
packages/templates/                # 3개 템플릿 (Aave/Uniswap/Lido)
```

---

## 2. 빠른 시작

### 2-1. 환경 요구사항

- **Node** ≥ 20.18.1 (`.nvmrc` 참고)
- **pnpm** 9.x
- **데모 체인**: Sepolia (chainId `11155111`)
- **포트**: 8787

### 2-2. 환경변수 (`apps/api/.env`)

```env
NODE_ENV=development
PORT=8787

# CORS — 다중 origin은 콤마(,) 구분 (예: 로컬 + staging + prod)
CORS_ORIGIN=http://localhost:3000

# Anthropic (LLM) — 필수
ANTHROPIC_API_KEY=sk-ant-...

# KeeperHub — 필수
KEEPERHUB_API_URL=https://app.keeperhub.com/api
KEEPERHUB_API_KEY=kh_...

# Database (Supabase Postgres) — 필수
# Supabase Dashboard → Connect → ORM → Prisma 탭에서 복사
# DATABASE_URL = pooled (port 6543, 평소 쿼리)
# DIRECT_URL   = direct (port 5432, prisma migrate 전용)
DATABASE_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"
```

> 키 발급:
> - Anthropic: https://console.anthropic.com → API Keys (Workspace + spend limit 권장)
> - KeeperHub: app.keeperhub.com → Settings → API Keys → Organisation 탭 (`kh_` 프리픽스)
> - Supabase: https://supabase.com → New project → Region `Northeast Asia (Seoul)` → Project Settings → Database

### 2-3. 설치 및 실행

```bash
# 모노레포 루트에서
pnpm install

# DB 마이그레이션 (테이블 생성) — 첫 셋업 또는 git pull 후
pnpm --filter @loomlabs/api prisma migrate dev

# 기본 에이전트 시드 (Loomlabs 1개)
pnpm --filter @loomlabs/api prisma db seed

# API 서버만 띄우기
pnpm --filter @loomlabs/api dev

# 또는 모든 앱 동시 (web + api)
pnpm dev
```

서버 정상 기동 확인:

```bash
curl http://localhost:8787/health
# → {"status":"ok","ts":...}
```

### 2-4. 빌드/검증 명령어

```bash
pnpm --filter @loomlabs/api typecheck       # tsc --noEmit
pnpm --filter @loomlabs/api build           # tsc 빌드
pnpm lint                                    # 전체 lint

# DB 관련
pnpm --filter @loomlabs/api db:migrate      # schema 변경 후 새 마이그레이션 생성+적용
pnpm --filter @loomlabs/api db:studio       # GUI(Prisma Studio)로 DB 데이터 확인
pnpm --filter @loomlabs/api db:reset        # DB 다 지우고 처음부터 (시드 자동 재실행)
pnpm --filter @loomlabs/api db:generate     # Prisma Client 코드 재생성
```

---

## 3. API 레퍼런스

총 19개 endpoint. 모든 응답은 JSON. 에러는 표준 shape (섹션 3-7 참고).

### 3-1. Health

#### `GET /health`

서버 상태 확인.

```json
{ "status": "ok", "ts": 1777283506097 }
```

---

### 3-2. LLM

#### `POST /api/llm/extract`

자연어 → intent 추출만 (워크플로우 안 만듦, 디버깅/프리뷰용).

**Request**:
```json
{ "prompt": "Stake 1 ETH on Lido" }
```

**Response 200**:
```json
{
  "prompt": "Stake 1 ETH on Lido",
  "intent": {
    "templateId": "lido-stake",
    "confidence": 0.95,
    "parameters": { "amount": "1000000000000000000" },
    "reasoning": "..."
  }
}
```

---

### 3-3. Workflows (8개)

#### `POST /api/workflows` — 풀 lifecycle 생성

자연어 → intent → compile → store → KeeperHub deploy → 응답.

**Request**:
```json
{
  "prompt": "Deposit 100 USDC into Aave every Monday at 9am",
  "owner": "0xabc1234567890abcdef1234567890abcdef12345",
  "chainId": 11155111
}
```

**Response 201**:
```json
{
  "workflow": {
    "id": "uuid-...",
    "templateId": "aave-recurring-deposit",
    "owner": "0xabc...",
    "name": "Deposit 100 USDC into Aave every Monday at 9am",
    "description": "(LLM reasoning)",
    "chainId": 11155111,
    "parameters": { "token": "0xA0b8...", "amount": "100000000", "interval": "7d", "maxIterations": 52 },
    "trigger": { "type": "cron", "expression": "@interval" },
    "actions": [...],
    "createdAt": 1777285295253,
    "status": "deployed",
    "keeperJobId": "abc...xyz"
  },
  "intent": { "templateId": "aave-recurring-deposit", "confidence": 0.95, ... }
}
```

#### `GET /api/workflows` — 리스트

```json
{ "workflows": [ { ... }, ... ] }
```

#### `GET /api/workflows/:id` — 단건

```json
{ "workflow": { ... } }
```

#### `POST /api/workflows/:id/run` — KeeperHub 즉시 실행

```json
{
  "workflow": { ... },
  "execution": { "executionId": "563qrbj...", "status": "running" }
}
```

조건: `keeperJobId` 있어야 함. 없으면 409.

#### `POST /api/workflows/:id/pause` — 일시정지

`status: 'paused'`로 마킹. KeeperHub native pause 부재로 store-only.

```json
{ "workflow": { "status": "paused", ... } }
```

#### `POST /api/workflows/:id/resume` — 재개

`status: 'deployed'`로 복귀.

#### `POST /api/workflows/:id/fork` — 복제

같은 파라미터로 새 워크플로우 + 새 keeperJobId 발급.

```json
{
  "workflow": { "id": "new-uuid", "name": "... (fork)", "keeperJobId": "new-id", ... },
  "forkedFrom": "원본-id"
}
```

#### `DELETE /api/workflows/:id` — 삭제

store에서만 제거 (KeeperHub 워크플로우는 보존).

```json
{ "deleted": true }
```

---

### 3-4. Marketplace (4개)

#### `POST /api/marketplace` — 게시

기존 워크플로우를 마켓에 listing으로 스냅샷.

**Request**:
```json
{
  "workflowId": "uuid-...",
  "author": "0xabc...",
  "tags": ["defi", "aave"],
  "pricing": { "type": "free" }
}
```

`pricing`은 두 가지:
- `{ "type": "free" }` — 무료
- `{ "type": "x402", "amount": "5000000", "token": "USDC" }` — 유료 (D의 AXL이 결제)

**Response 201**:
```json
{ "listing": { "id": "uuid", "workflow": {...}, "author": "0x...", "tags": [...], "pricing": {...}, "stats": { "installs": 0, "runs": 0 }, "createdAt": ... } }
```

#### `GET /api/marketplace` — 리스트 + 필터/정렬

쿼리 파라미터:
- `?tag=defi` — 태그 필터
- `?author=0xabc...` — 작성자 필터
- `?protocol=aave` — 프로토콜 필터 (templateId → template.protocol 매핑)
- `?sort=popular` — runs 통계 기준 정렬 (기본은 `newest`)
- `?limit=20` — 페이지 사이즈 (기본 20, 최대 100)
- `?cursor=...` — (운영 단계 추가 예정) 진짜 페이지네이션 커서

```json
{ "items": [ ... ], "total": 2 }
```

#### `GET /api/marketplace/:id` — 단건

```json
{ "listing": { ... } }
```

#### `DELETE /api/marketplace/:id` — 언퍼블리시

```json
{ "deleted": true }
```

---

### 3-5. Templates (2개)

코드 정적 카탈로그 노출 (DB 아님). 새 템플릿은 C(`packages/templates/src/`)가 추가하면 자동 노출.

#### `GET /api/templates` — 전체 카탈로그

```json
{
  "templates": [
    { "id": "aave-recurring-deposit", "name": "Aave Recurring Deposit", "protocol": "aave", "category": "yield", ... },
    { "id": "uniswap-dca", ... },
    { "id": "lido-stake", ... }
  ],
  "total": 3
}
```

#### `GET /api/templates/:id` — 단건 + Sepolia 메타데이터

```json
{
  "template": { "id": "aave-recurring-deposit", "parameters": [...], "actions": [...], ... },
  "sepolia": {
    "chainId": 11155111,
    "executionMode": "dry-run-only",
    "contracts": [...],
    "runtimePlaceholderValues": [...]
  }
}
```

Lido는 mock 컨트랙트(`MockLido` 등)를 D가 Sepolia에 배포해서 사용 (Lido 공식 Sepolia 부재).

---

### 3-6. Agents (3개)

#### `GET /api/agents` — 리스트

```json
{
  "agents": [
    { "id": "loomlabs", "name": "Loomlabs Agent", "description": "...", "actions": ["CREATE_WORKFLOW_INTENT"] }
  ]
}
```

#### `GET /api/agents/:id` — 단건

```json
{ "agent": { ... } }
```

#### `POST /api/agents/:id/intent` — 자연어 → intent

LLM을 에이전트 인터페이스로 노출. C의 ElizaOS 플러그인과 호환.

**Request**:
```json
{ "message": "Stake 2 ETH on Lido" }
```

**Response 200**:
```json
{
  "agent": "loomlabs",
  "message": "Stake 2 ETH on Lido",
  "intent": { "templateId": "lido-stake", "confidence": 0.95, ... }
}
```

---

### 3-7. 에러 응답 형식

모든 에러는 통일된 shape:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "입력 형식이 올바르지 않아요.",
  "details": "prompt: Required, owner: Required"
}
```

| code | HTTP | 의미 |
|---|:-:|---|
| `VALIDATION_FAILED` | 400 | 요청 body가 zod 스키마 검증 실패 |
| `TEMPLATE_NOT_FOUND` | 422 | LLM이 카탈로그에 없는 templateId 만든 경우 |
| `PARAMETER_MISSING` | 422 | 템플릿 필수 파라미터를 LLM이 못 채움 |
| `LLM_UNAVAILABLE` | 503 | Anthropic API 키 누락/만료/네트워크 |
| `KEEPERHUB_AUTH_FAILED` | 503 | KeeperHub 401 (키 만료/잘못됨) |
| `KEEPERHUB_ERROR` | 502 | KeeperHub 4xx/5xx/네트워크 |
| `INTERNAL_ERROR` | 500 | 분류되지 않은 모든 에러 |

단순 404 (워크플로우/listing/agent 없음)는 짧은 형식:
```json
{ "error": "workflow not found" }
```

---

## 4. 테스트

### 4-1. demo.http

`apps/api/demo.http`에 18개 endpoint 시연 시나리오 미리 작성됨. VS Code에서 한 번에 실행 가능.

**셋업**:
1. VS Code → `Cmd+Shift+X` → "REST Client" by Huachao Mao 설치
2. 설치 직후 자동 활성화 (별도 켜는 거 없음)
3. `apps/api/demo.http` 열기
4. 각 `### 제목` 위에 회색 글씨로 **"Send Request"** 가 자동으로 나타남
5. 클릭 → 우측에 응답 패널 열림
6. 단축키: 요청 위에 커서 두고 `Cmd+Alt+R`

**시나리오 구조** (6개 섹션):
- 섹션 0: 헬스체크
- 섹션 1: LLM intent 미리보기 (Aave/Lido/Uniswap)
- 섹션 2: 워크플로우 풀 라이프사이클 (자동 ID 체이닝, 8단계)
- 섹션 3: 마켓플레이스 (8개, protocol/limit 필터 검증 포함)
- 섹션 4: 템플릿 카탈로그 (정적 데이터, 4개)
- 섹션 5: 에이전트 (3개, 시드된 loomlabs)
- 섹션 6: 친절 에러 검증 (의도적 잘못된 입력)

**자동 ID 체이닝**: REST Client의 `# @name` 기능으로 응답에서 id를 자동 추출 → 다음 요청에 자동 주입. 수동 복붙 X.

### 4-2. curl 단발 호출

```bash
# 풀 lifecycle (자연어 → 배포)
curl -X POST http://localhost:8787/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Stake 1 ETH on Lido",
    "owner": "0xabc1234567890abcdef1234567890abcdef12345",
    "chainId": 11155111
  }'

# 리스트 조회
curl http://localhost:8787/api/workflows

# 일시정지
curl -X POST http://localhost:8787/api/workflows/<id>/pause
```

### 4-3. 단계별 로그 (백엔드 콘솔)

`pnpm dev` 띄운 터미널에서 요청마다 단계별 로그가 찍힘:

```
[10:32:45] [workflows] ▶ request received { prompt: '...', owner: '...', chainId: 11155111 }
[10:32:46] [llm] intent extracted { templateId: 'lido-stake', confidence: 0.95 }
[10:32:46] [compile] assembled workflow { name: 'Stake 1 ETH on Lido' }
[10:32:46] [store] saved as draft { id: 'uuid-...' }
[10:32:47] [keeperhub] deployed { keeperJobId: 'abc...' }
[10:32:47] [workflows] ✓ lifecycle complete { workflowId: 'uuid-...', status: 'deployed' }
```

(데모 영상 활용 고민)

---

## 5. 심사 기준 대응

ETHGlobal 심사 4기준 ↔ 이 API의 구현 매핑.

### ① Does it work? — 작동 안정성

- 18개 endpoint 라이브 검증 완료 (정상 + 에러 케이스 둘 다)
- 풀 lifecycle (자연어 → KeeperHub 등록) 1초 이내 응답
- 친절 에러 + 단계별 로그로 실패 원인 즉시 추적 가능
- typecheck 통과, 패키지 간 타입 안전

### ② Would someone actually use it? — 실질 유틸

- "Deposit 100 USDC into Aave every Monday" 한 줄로 워크플로우 자동 생성
- 코드 한 줄 안 짜고 DCA / 예치 / 스테이킹 자동화
- 마켓플레이스로 자기 워크플로우 공유/판매 (free 또는 x402 유료)
- 에이전트 인터페이스로 외부 LLM 통합 가능 (C의 ElizaOS 등)

### ③ Depth of KeeperHub integration — 통합 깊이

- 라이브 호출: `deployWorkflow` / `executeWorkflow` / `getJobStatus`
- 응답 wrapper 유연 파싱 (`{data: ...}` 와 bare object 둘 다)
- pause/resume은 KeeperHub native 부재 → store status flag 우회 (의도된 결정)
- nodes/edges 스키마 미문서화 이슈 — 빈 배열 우회법 검증해서 해소
- 실제 KeeperHub 측에 워크플로우 등록 → 대시보드에서 확인 가능

### ④ Mergeable quality — 코드 품질 + 운영 + 문서

- 패키지별 typecheck 통과 (api / keeperhub-client)
- `demo.http` 시나리오로 심사위원이 동일 시연 가능 (자동 ID 체이닝)
- `workflowSchema.parse()` 런타임 검증으로 타입 안전 보장
- 단계별 로그 + 친절 에러 + 통일된 에러 shape
- 이 README로 API 전체 자체 문서화
- **Postgres + Prisma**로 DB 영속성 + 마이그레이션 시스템 (팀 + 배포 환경 동기화)
- **인메모리 → DB 전환** 후에도 API 스펙 100% 유지 (프론트 영향 0)
- **CORS 다중 origin** 지원 (Vercel preview / staging / prod URL 동시 허용)

---

## 6. 다른 영역과의 의존성

### 6-1. A (Frontend, `apps/web`)가 호출

A는 HTTP로만 통신. 코드 import 없음.
- `POST /api/workflows` — 자연어 입력 후 호출
- `GET /api/workflows`, `GET /api/workflows/:id` — 대시보드 표시
- `POST /api/workflows/:id/run|pause|resume|fork`, `DELETE /api/workflows/:id` — 액션 버튼
- `GET /api/marketplace`, `POST /api/marketplace` — 마켓 페이지
- `GET /api/agents`, `POST /api/agents/:id/intent` — 에이전트 페이지

### 6-2. C (Templates + ElizaOS)와의 관계

**C가 B에 의존**:
- `plugins/elizaos/src/index.ts` 가 `@loomlabs/llm`의 `extractWorkflowIntent` 직접 import
- → C는 자기 에이전트에서 같은 LLM 인터페이스 그대로 사용

**B가 C에 의존**:
- `packages/templates`의 3개 템플릿(Aave/Uniswap/Lido)을 LLM 카탈로그로 활용
- C가 템플릿의 컨트랙트 주소/ABI를 실제 Sepolia 값으로 채워야 cron 트리거 시 진짜 트랜잭션 발생

→ **인터페이스 안정**: B의 export(`extractWorkflowIntent` 시그니처, `intentSchema`)는 변경 시 슬랙 합의 필수.

### 6-3. D (Contracts + AXL)와의 통합 지점

- 마켓 listing의 `pricing.type === 'x402'`이면 D의 결제 컨트랙트가 처리
- B는 `pricing` 필드만 노출, USDC 송금/AXL 통신은 D가 담당

### 6-4. 공유 스키마

`packages/schema`는 모든 영역이 import. **변경 시 전 영역 영향 → 합의 후에만 수정**.

---

## 7. 환경 / 모델 / DB / 비용

- **LLM 모델**: `claude-haiku-4-5-20251001` (`packages/llm/src/index.ts` 참고)
  - 입력 $1 / 출력 $5 per 1M tokens
  - 해커톤 전체 ~300 호출 = 예상 $0.30
- **Anthropic Workspace**: spend limit $5 권장 (악용 방지)
- **KeeperHub**: 100 req/min rate limit (인증 시), 무료 tier로 데모 충분
- **DB 호스팅**: Supabase 무료 티어 (Asia Pacific 2 — Seoul, ap-northeast-2)
  - Postgres 17, 0.5GB 무료, 카드 등록 X
  - DATABASE_URL(pooled, 6543) + DIRECT_URL(direct, 5432) 둘 다 필요 — Prisma + Supabase 조합 필수
- **DB 영속성**: 서버 재시작/배포에도 워크플로우/listing/agent 모두 살아있음 (인메모리 시절 휘발 문제 해결)
- **마이그레이션 동기화**: 팀원이 `git pull` 후 `pnpm prisma migrate dev` 한 번이면 자동 동기화

---

## 8. 참고

- 모노레포 루트 `README.md` — 브랜치 룰 / 전체 셋업
- `docs/approach.md` — ETHGlobal 심사 기준
- `docs/api-hooks.md` — A 프론트가 호출할 endpoint 모양 (frontend-setting 브랜치)
- KeeperHub 공식 문서: https://docs.keeperhub.com/api
