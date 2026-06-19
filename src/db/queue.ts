import { Pool } from 'pg';
import type { Config } from '../config.js';
import type { QueueStatus, WhatsappTemplateParams, WhatsappQueueRow } from '../types.js';

const RETURNING_COLUMNS = `
  q.id,
  q."tenantId",
  q."qrCampaignId",
  q."userPhone",
  q."userName",
  q."templateName",
  q."templateParams",
  q."languageCode",
  q.status,
  q."errorLog",
  q."createdAt",
  q."updatedAt",
  q."sentAt"
`;

function parseTemplateParams(raw: unknown): WhatsappTemplateParams | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return parseTemplateParams(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.nombre_tenant !== 'string' || typeof o.nombre_usuario !== 'string') {
    return null;
  }
  return {
    nombre_tenant: o.nombre_tenant,
    nombre_usuario: o.nombre_usuario,
    cupon: typeof o.cupon === 'string' ? o.cupon : undefined,
    fecha_vencimiento: typeof o.fecha_vencimiento === 'string' ? o.fecha_vencimiento : undefined,
    mes_cumpleanos: typeof o.mes_cumpleanos === 'string' ? o.mes_cumpleanos : undefined,
    regalo_usuario: typeof o.regalo_usuario === 'string' ? o.regalo_usuario : undefined,
    nombre_evento: typeof o.nombre_evento === 'string' ? o.nombre_evento : undefined,
    fecha_evento: typeof o.fecha_evento === 'string' ? o.fecha_evento : undefined,
    fecha_limite: typeof o.fecha_limite === 'string' ? o.fecha_limite : undefined,
    descuento_promo: typeof o.descuento_promo === 'string' ? o.descuento_promo : undefined,
    producto_servicio: typeof o.producto_servicio === 'string' ? o.producto_servicio : undefined,
  };
}

function mapRow(row: Record<string, unknown>): WhatsappQueueRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenantId),
    qrCampaignId: String(row.qrCampaignId),
    userPhone: String(row.userPhone),
    userName: String(row.userName),
    templateName: String(row.templateName),
    templateParams: parseTemplateParams(row.templateParams),
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
        RETURNING ${RETURNING_COLUMNS}
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
