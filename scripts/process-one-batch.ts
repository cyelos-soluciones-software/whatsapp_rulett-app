/**
 * Procesa un lote PENDING (útil para validar plantillas sin esperar Render).
 * Uso: DATABASE_URL="<neon>" DATABASE_SSL=true npx tsx scripts/process-one-batch.ts
 */
import 'dotenv/config';
import { loadConfig } from '../src/config.js';
import { QueueRepository } from '../src/db/queue.js';
import { processBatch } from '../src/processor.js';
import { WhatsappClient } from '../src/services/whatsapp.js';

async function main() {
  const config = loadConfig();
  const queue = new QueueRepository(config);
  const whatsapp = new WhatsappClient(config);

  try {
    const count = await processBatch(queue, whatsapp, config.batchSize);
    console.log(`Procesados: ${count}`);
  } finally {
    await queue.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
