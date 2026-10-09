import { formatError } from './lib/errors.js';

export interface BatchOutcome {
  processed: number;
  busy: boolean;
}

export interface BatchRunner {
  /** Lanza si el lote falla; nunca encadena un segundo lote en la misma llamada. */
  run(): Promise<BatchOutcome>;
  isRunning(): boolean;
}

function log(level: 'info' | 'error', message: string, meta?: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta }));
}

export function createBatchRunner(processBatch: () => Promise<number>): BatchRunner {
  let inFlight = false;

  return {
    async run() {
      if (inFlight) {
        log('info', 'Procesamiento omitido: ya hay un lote en curso');
        return { processed: 0, busy: true };
      }

      inFlight = true;
      try {
        const processed = await processBatch();
        log('info', 'Ciclo de procesamiento finalizado', { processed });
        return { processed, busy: false };
      } catch (error) {
        log('error', 'Error en ciclo de procesamiento', { error: formatError(error) });
        throw error;
      } finally {
        inFlight = false;
      }
    },
    isRunning: () => inFlight,
  };
}
