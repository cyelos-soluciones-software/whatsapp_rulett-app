import { Pool } from 'pg';
import type { Config } from '../config.js';
import type { QueueStatus, WhatsappQueueRow } from '../types.js';

const QUEUE_COLUMNS = `
  id,
  "tenantId",
  "qrCampaignId",
  "userPhone",
  "userName",
  "templateName",
  "languageCode",
  status,
  "errorLog",
  "createdAt",
  "updatedAt",
  "sentAt"
`;

function mapRow(row: Record<string, unknown>): WhatsappQueueRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenantId),
    qrCampaignId: String(row.qrCampaignId),
    userPhone: String(row.userPhone),
    userName: String(row.userName),
    templateName: String(row.templateName),
    languageCode: String(row.languageCode ?? 'es_CO'),
    status: row.status as QueueStatus,
    errorLog: row.errorLog == null ? null : String(row.errorLog),
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
    sentAt: row.sentAt == null ? null : new Date(String(row.sentAt)),
  };
}

export class QueueRepository {
  private readonly pool: Pool;

  constructor(config: Config) {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    this.pool.on('error', (error) => {
      console.error('[db] Error inesperado en el pool de conexiones:', error);
    });
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  /**
   * Reclama un lote con bloqueo optimista usando FOR UPDATE SKIP LOCKED.
   * Seguro para múltiples réplicas del worker.
   */
  async claimPendingBatch(limit: number): Promise<WhatsappQueueRow[]> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const claimed = await client.query<Record<string, unknown>>(
        `
        UPDATE "WhatsappQueue" AS q
        SET
          status = 'PROCESSING',
          "updatedAt" = NOW()
        FROM (
          SELECT id
          FROM "WhatsappQueue"
          WHERE status = 'PENDING'
          ORDER BY "createdAt" ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        ) AS pending
        WHERE q.id = pending.id
        RETURNING ${QUEUE_COLUMNS}
        `,
        [limit],
      );

      await client.query('COMMIT');
      return claimed.rows.map(mapRow);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markSent(id: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE "WhatsappQueue"
      SET
        status = 'SENT',
        "errorLog" = NULL,
        "sentAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = $1
      `,
      [id],
    );
  }

  async markFailed(id: string, errorLog: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE "WhatsappQueue"
      SET
        status = 'FAILED',
        "errorLog" = $2,
        "updatedAt" = NOW()
      WHERE id = $1
      `,
      [id, errorLog.slice(0, 4000)],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
