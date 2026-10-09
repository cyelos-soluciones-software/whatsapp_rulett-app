import { createBatchRunner } from './batch-runner.js';
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
    batchSize: config.batchSize,
    httpPort: config.httpPort,
    edgeSecretConfigured: config.edgeSharedSecret !== '',
  });

  const queue = new QueueRepository(config);
  const whatsapp = new WhatsappClient(config);
  const runner = createBatchRunner(() => processBatch(queue, whatsapp, config.batchSize));

  const shutdown = async (signal: string): Promise<void> => {
    log('info', 'Señal de apagado recibida, deteniendo worker...', { signal });

    while (runner.isRunning()) {
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

  // Sin sondeo: cada lote lo dispara /api/trigger (cron de rulett-app vía Cloudflare).
  startTriggerServer({
    port: config.httpPort,
    apiKey: config.workerApiKey,
    edgeSecret: config.edgeSharedSecret,
    onTrigger: () => runner.run(),
  });

  log('info', 'Worker iniciado', {
    batchSize: config.batchSize,
    phoneId: config.whatsappPhoneId,
    accountId: config.whatsappAccountId,
  });
}

main().catch((error) => {
  logFatalError(error, 'Fallo fatal al iniciar el worker');
  process.exit(1);
});
