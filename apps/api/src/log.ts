// 데모용 단계별 로그 헬퍼
// 형식: [HH:MM:SS] [scope] message {...meta}
export function log(scope: string, message: string, meta?: unknown): void {
  const ts = new Date().toISOString().slice(11, 19);
  if (meta !== undefined) {
    console.log(`[${ts}] [${scope}] ${message}`, meta);
  } else {
    console.log(`[${ts}] [${scope}] ${message}`);
  }
}

// 에러용 — stderr로 보내서 일반 로그와 구분
export function logError(scope: string, message: string, err?: unknown): void {
  const ts = new Date().toISOString().slice(11, 19);
  const detail = err instanceof Error ? err.message : err;
  console.error(`[${ts}] [${scope}] ✗ ${message}`, detail ?? '');
}
