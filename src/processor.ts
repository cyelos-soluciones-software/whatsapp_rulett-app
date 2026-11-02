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

/**
 * 068 W-05 (WD-3): los logs nunca llevan el nombre ni el teléfono del destinatario, para ninguna plantilla.
 * Quedan el id de la fila, el comercio, la campaña, la plantilla, el estado y el código de Meta.
 */
async function processRow(
  row: WhatsappQueueRow,
  whatsapp: WhatsappClient,
  queue: QueueRepository,
): Promise<void> {
  log('info', 'Procesando mensaje', {
    queueId: row.id,
    tenantId: row.tenantId,
    campaignId: row.qrCampaignId,
    templateName: row.templateName,
  });

  const result = await whatsapp.sendTemplateMessage(row);

  if (result.ok) {
    await queue.markSent(row.id);
    log('info', 'Mensaje enviado', {
      queueId: row.id,
      templateName: row.templateName,
      status: 'SENT',
      messageId: result.messageId,
      statusCode: result.statusCode,
    });
    return;
  }

  const errorLog = result.error ?? 'Error desconocido al enviar mensaje';
  await queue.markFailed(row.id, errorLog);

  log('error', 'Fallo al enviar mensaje', {
    queueId: row.id,
    templateName: row.templateName,
    status: 'FAILED',
    statusCode: result.statusCode,
    error: errorLog,
  });
}

export async function processBatch(
  queue: QueueRepository,
  whatsapp: WhatsappClient,
  batchSize: number,
): Promise<number> {
  const reclaimed = await queue.reclaimStaleProcessing();
  if (reclaimed > 0) {
    log('warn', 'Filas PROCESSING abandonadas devueltas a PENDING', { count: reclaimed });
  }

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
