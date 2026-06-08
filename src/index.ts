import { loadConfig, maskDatabaseUrl } from './config.js';
import { QueueRepository } from './db/queue.js';
import { formatError, logFatalError } from './lib/errors.js';
import { processBatch } from './processor.js';
import { startTriggerServer } from './server.js';
import { WhatsappClient } from './services/whatsapp.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}

async function main(): Promise<void> {
  log('info', 'Iniciando worker de WhatsApp...');

  const config = loadConfig();
  log('info', 'Configuración cargada', {
    databaseHost: maskDatabaseUrl(config.databaseUrl),
    databaseSsl: config.databaseSsl,
    pollIntervalMs: config.pollIntervalMs,
    batchSize: config.batchSize,
    httpPort: config.httpPort,
  });

  const queue = new QueueRepository(config);
  const whatsapp = new WhatsappClient(config);

  let running = true;
  let inFlight = false;

  const runBatch = async (source: 'poll' | 'trigger'): Promise<void> => {
    if (inFlight) {
      log('info', 'Procesamiento omitido: ya hay un lote en curso', { source });
      return;
    }

    inFlight = true;
    try {
      const count = await processBatch(queue, whatsapp, config.batchSize);
      log('info', 'Ciclo de procesamiento finalizado', { source, processed: count });
    } catch (error) {
      log('error', 'Error en ciclo de procesamiento', {
        source,
        error: formatError(error),
      });
    } finally {
      inFlight = false;
    }
  };

  const shutdown = async (signal: string): Promise<void> => {
    log('info', 'Señal de apagado recibida, deteniendo worker...', { signal });
    running = false;

    while (inFlight) {
      await sleep(250);
    }

    await queue.close();
    log('info', 'Worker detenido correctamente');
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  try {
    await queue.ping();
  } catch (error) {
    throw new Error(
      `No se pudo conectar a PostgreSQL (${maskDatabaseUrl(config.databaseUrl)}, ssl=${config.databaseSsl}): ${formatError(error)}`,
      { cause: error },
    );
  }

  log('info', 'Conexión a PostgreSQL verificada');

  startTriggerServer({
    port: config.httpPort,
    apiKey: config.workerApiKey,
    onTrigger: () => {
      void runBatch('trigger');
    },
  });

  log('info', 'Worker iniciado', {
    pollIntervalMs: config.pollIntervalMs,
    batchSize: config.batchSize,
    phoneId: config.whatsappPhoneId,
    accountId: config.whatsappAccountId,
  });

  while (running) {
    await runBatch('poll');

    if (!running) {
      break;
    }

    await sleep(config.pollIntervalMs);
  }

  await queue.close();
}

main().catch((error) => {
  logFatalError(error, 'Fallo fatal al iniciar el worker');
  process.exit(1);
});
