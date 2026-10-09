import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import type { Config } from '../src/config.js';
import { normalizeDatabaseUrl } from '../src/config.js';
import { QueueRepository } from '../src/db/queue.js';

// Solo Docker local: el reclaim afecta a toda fila PROCESSING vieja de la base.
const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL?.trim() ?? '');
const isLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(databaseUrl);

const ROW_PREFIX = 'test-054-reclaim-';
const freshId = `${ROW_PREFIX}fresh-${Date.now()}`;
const staleId = `${ROW_PREFIX}stale-${Date.now()}`;

describe('reclaimStaleProcessing (Postgres local)', { skip: !isLocal && 'DATABASE_URL no es local' }, () => {
  let pool: Pool;
  let queue: QueueRepository;

  before(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    queue = new QueueRepository({ databaseUrl, databaseSsl: false } as Config);

    const tenant = await pool.query<{ id: string }>('SELECT id FROM "Tenant" LIMIT 1');
    assert.ok(tenant.rows[0], 'La base local necesita al menos un Tenant (npm run db:bootstrap)');
    const tenantId = tenant.rows[0].id;

    for (const [id, minutesAgo] of [
      [freshId, 1],
      [staleId, 16],
    ] as const) {
      await pool.query(
        `
        INSERT INTO "WhatsappQueue"
          (id, "tenantId", "userPhone", "userName", "templateName", status, "createdAt", "updatedAt")
        VALUES
          ($1, $2, '570000000000', 'Prueba 054', 'recordatorio_suscripcion_hoy', 'PROCESSING',
           NOW() - make_interval(mins => $3), NOW() - make_interval(mins => $3))
        `,
        [id, tenantId, minutesAgo],
      );
    }
  });

  after(async () => {
    await pool.query('DELETE FROM "WhatsappQueue" WHERE id = ANY($1)', [[freshId, staleId]]);
    await pool.end();
    await queue.close();
  });

  it('devuelve a PENDING la de hace 16 minutos y no toca la de hace 1', async () => {
    const reclaimed = await queue.reclaimStaleProcessing();

    const rows = await pool.query<{ id: string; status: string }>(
      'SELECT id, status FROM "WhatsappQueue" WHERE id = ANY($1)',
      [[freshId, staleId]],
    );
    const status = Object.fromEntries(rows.rows.map((r) => [r.id, r.status]));

    assert.ok(reclaimed >= 1);
    assert.equal(status[staleId], 'PENDING');
    assert.equal(status[freshId], 'PROCESSING');
  });
});
