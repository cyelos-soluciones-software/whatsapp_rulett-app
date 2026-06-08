import type { QueueRepository } from './db/queue.js';
import type { WhatsappClient } from './services/whatsapp.js';
import type { WhatsappQueueRow } from './types.js';

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

export async function processBatch(
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
