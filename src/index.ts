import { loadConfig } from './config.js';
import { QueueRepository } from './db/queue.js';
import { WhatsappClient } from './services/whatsapp.js';
import type { WhatsappQueueRow } from './types.js';

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

async function processRow(
  row: WhatsappQueueRow,
  whatsapp: WhatsappClient,
  queue: QueueRepository,
): Promise<void> {
  log('info', 'Procesando mensaje', {
    queueId: row.id,
    tenantId: row.tenantId,
    campaignId: row.qrCampaignId,
    userPhone: row.userPhone,
    userName: row.userName,
    templateName: row.templateName,
  });

  const result = await whatsapp.sendTemplateMessage(row);

  if (result.ok) {
    await queue.markSent(row.id);
    log('info', 'Mensaje enviado', {
      queueId: row.id,
      messageId: result.messageId,
      statusCode: result.statusCode,
    });
    return;
  }

  const errorLog = result.error ?? 'Error desconocido al enviar mensaje';
  await queue.markFailed(row.id, errorLog);

  log('error', 'Fallo al enviar mensaje', {
    queueId: row.id,
    statusCode: result.statusCode,
    error: errorLog,
  });
}

async function processBatch(
  queue: QueueRepository,
  whatsapp: WhatsappClient,
  batchSize: number,
): Promise<number> {
  const rows = await queue.claimPendingBatch(batchSize);

  if (rows.length === 0) {
    log('info', 'No hay mensajes PENDING en la cola');
    return 0;
  }

  log('info', 'Lote reclamado', { count: rows.length });

  for (const row of rows) {
    await processRow(row, whatsapp, queue);
  }

  return rows.length;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const queue = new QueueRepository(config);
  const whatsapp = new WhatsappClient(config);

  let running = true;
  let inFlight = false;

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

  await queue.ping();
  log('info', 'Worker iniciado', {
    pollIntervalMs: config.pollIntervalMs,
    batchSize: config.batchSize,
    phoneId: config.whatsappPhoneId,
    accountId: config.whatsappAccountId,
  });

  while (running) {
    inFlight = true;

    try {
      await processBatch(queue, whatsapp, config.batchSize);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', 'Error en ciclo de polling', { error: message });
    } finally {
      inFlight = false;
    }

    if (!running) {
      break;
    }

    await sleep(config.pollIntervalMs);
  }

  await queue.close();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', message }));
  process.exit(1);
});
