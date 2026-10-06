export class OperationTimeoutError extends Error {
  readonly label: string;
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "OperationTimeoutError";
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

export async function withinTimeout<T>(
  label: string,
  work: () => PromiseLike<T>,
  timeoutMs: number,
): Promise<T> {
  const boundedTimeoutMs = Math.max(1, Math.trunc(timeoutMs));
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Promise.resolve().then(() => work()),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new OperationTimeoutError(label, boundedTimeoutMs)),
          boundedTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
