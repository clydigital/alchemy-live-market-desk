export class IntelligenceDatabaseError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Intelligence database request failed (${status}): ${detail.slice(0, 800)}`);
    this.name = "IntelligenceDatabaseError";
    this.status = status;
    this.detail = detail;
  }
}

export function isIntelligenceDatabaseConflict(error: unknown) {
  return error instanceof IntelligenceDatabaseError && error.status === 409;
}
