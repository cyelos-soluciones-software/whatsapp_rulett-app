export function formatError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.trim()) {
      return error.message;
    }

    const withCode = error as NodeJS.ErrnoException;
    if (withCode.code) {
      return `${withCode.code}${withCode.stack ? `: ${withCode.stack.split('\n')[0]}` : ''}`;
    }

    return error.name || 'Error sin mensaje';
  }

  if (typeof error === 'string') {
    return error.trim() || '(cadena vacía)';
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function logFatalError(error: unknown, context?: string): void {
  const formatted = formatError(error);
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level: 'error',
    message: context ? `${context}: ${formatted}` : formatted,
  };

  if (error instanceof Error) {
    if (error.stack) {
      entry.stack = error.stack;
    }

    const withCode = error as NodeJS.ErrnoException;
    if (withCode.code) {
      entry.code = withCode.code;
    }

    if (error.cause) {
      entry.cause = formatError(error.cause);
    }
  }

  console.error(JSON.stringify(entry));
}
