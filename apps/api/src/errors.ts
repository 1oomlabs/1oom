// 내부 throw 메시지를 사용자 친화 응답으로 변환
// 데모 영상에서 에러도 깔끔하게 보이도록

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: string;
};

// Hono c.json()이 status code literal을 요구해서 명시적 union으로 좁힘
export type ApiErrorStatus = 400 | 422 | 500 | 502 | 503;

export function mapError(err: unknown): { status: ApiErrorStatus; body: ApiErrorBody } {
  const msg = err instanceof Error ? err.message : String(err);

  // LLM 측 — Anthropic 키 누락/만료/네트워크
  if (msg.includes('Anthropic API key') || msg.toLowerCase().includes('anthropic')) {
    return {
      status: 503,
      body: {
        code: 'LLM_UNAVAILABLE',
        message: 'AI 서비스를 사용할 수 없어요. 잠시 후 다시 시도해주세요.',
        details: msg,
      },
    };
  }

  // KeeperHub 인증 실패
  if (msg.includes('[keeperhub] 401')) {
    return {
      status: 503,
      body: {
        code: 'KEEPERHUB_AUTH_FAILED',
        message: 'KeeperHub 인증에 실패했어요. 관리자에게 문의해주세요.',
        details: msg,
      },
    };
  }

  // KeeperHub 그 외 (4xx/5xx, 네트워크 등)
  if (msg.includes('[keeperhub]')) {
    return {
      status: 502,
      body: {
        code: 'KEEPERHUB_ERROR',
        message: 'KeeperHub와 통신 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.',
        details: msg,
      },
    };
  }

  // 템플릿 매칭 실패 — LLM이 카탈로그에 없는 id 만든 경우
  if (msg.startsWith('Template not found')) {
    return {
      status: 422,
      body: {
        code: 'TEMPLATE_NOT_FOUND',
        message: '요청하신 작업과 맞는 템플릿을 찾지 못했어요. 다른 표현으로 시도해주세요.',
        details: msg,
      },
    };
  }

  // 필수 파라미터 누락
  if (msg.startsWith('Required parameter')) {
    return {
      status: 422,
      body: {
        code: 'PARAMETER_MISSING',
        message: '필수 정보가 누락됐어요. 입력을 더 구체적으로 작성해주세요.',
        details: msg,
      },
    };
  }

  // Zod 검증 실패 (zValidator가 잡지 못한 곳)
  if (err instanceof Error && err.name === 'ZodError') {
    return {
      status: 400,
      body: {
        code: 'VALIDATION_FAILED',
        message: '입력 형식이 올바르지 않아요.',
        details: msg,
      },
    };
  }

  // 그 외 — 5xx, 메시지는 details로만 노출
  return {
    status: 500,
    body: {
      code: 'INTERNAL_ERROR',
      message: '예상치 못한 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
      details: msg,
    },
  };
}
