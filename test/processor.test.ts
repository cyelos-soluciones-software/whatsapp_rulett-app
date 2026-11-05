import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import type { QueueRepository } from '../src/db/queue.js';
import { processBatch } from '../src/processor.js';
import type { WhatsappClient } from '../src/services/whatsapp.js';
import type { WhatsappQueueRow, WhatsappSendResult } from '../src/types.js';

const platformRow: WhatsappQueueRow = {
  id: 'q-1',
  tenantId: 't-1',
  qrCampaignId: null,
  userPhone: '573001234567',
  userName: 'Café Central',
  templateName: 'recordatorio_suscripcion_hoy',
  templateParams: { nombre_comercio: 'Café Central' },
  languageCode: 'es_CO',
  status: 'PROCESSING',
  errorLog: null,
  createdAt: new Date('2026-10-01T13:00:00Z'),
  updatedAt: new Date('2026-10-01T13:00:00Z'),
  sentAt: null,
};

function fakeQueue(rows: WhatsappQueueRow[], reclaimed = 0) {
  const calls = {
    sent: [] as string[],
    failed: [] as Array<[string, string]>,
    order: [] as string[],
  };
  const queue = {
    reclaimStaleProcessing: async () => {
      calls.order.push('reclaim');
      return reclaimed;
    },
    claimPendingBatch: async () => {
      calls.order.push('claim');
      return rows;
    },
    markSent: async (id: string) => {
      calls.sent.push(id);
    },
    markFailed: async (id: string, errorLog: string) => {
      calls.failed.push([id, errorLog]);
    },
  } as unknown as QueueRepository;
  return { queue, calls };
}

function fakeWhatsapp(result: WhatsappSendResult): WhatsappClient {
  return { sendTemplateMessage: async () => result } as unknown as WhatsappClient;
}

function captureLogs(): Array<Record<string, unknown>> {
  const entries: Array<Record<string, unknown>> = [];
  mock.method(console, 'log', (line: string) => {
    entries.push(JSON.parse(line) as Record<string, unknown>);
  });
  return entries;
}

afterEach(() => {
  mock.restoreAll();
});

describe('processBatch', () => {
  it('envía una fila de plataforma sin campaña y no loguea el teléfono (068 W-05)', async () => {
    const logs = captureLogs();
    const { queue, calls } = fakeQueue([platformRow]);

    const count = await processBatch(queue, fakeWhatsapp({ ok: true, messageId: 'wamid.1' }), 50);

    assert.equal(count, 1);
    assert.deepEqual(calls.sent, ['q-1']);
    const processing = logs.find((e) => e.message === 'Procesando mensaje');
    assert.ok(processing);
    assert.equal('userPhone' in processing, false);
    assert.equal(processing.campaignId, null);
    assert.ok(!JSON.stringify(logs).includes('573001234567'));
  });

  it('marca FAILED con el error del cliente', async () => {
    captureLogs();
    const { queue, calls } = fakeQueue([platformRow]);

    await processBatch(queue, fakeWhatsapp({ ok: false, error: 'templateParams vacío' }), 50);

    assert.deepEqual(calls.failed, [['q-1', 'templateParams vacío']]);
  });

  it('sin filas no procesa nada', async () => {
    captureLogs();
    const { queue, calls } = fakeQueue([]);

    assert.equal(await processBatch(queue, fakeWhatsapp({ ok: true }), 50), 0);
    assert.deepEqual(calls.sent, []);
  });

  it('devuelve las filas PROCESSING abandonadas antes de reclamar y loguea el conteo sin teléfono', async () => {
    const logs = captureLogs();
    const { queue, calls } = fakeQueue([platformRow], 3);

    await processBatch(queue, fakeWhatsapp({ ok: true }), 50);

    assert.deepEqual(calls.order, ['reclaim', 'claim']);
    const reclaimLog = logs.find((e) => e.message === 'Filas PROCESSING abandonadas devueltas a PENDING');
    assert.ok(reclaimLog);
    assert.equal(reclaimLog.count, 3);
    assert.ok(!JSON.stringify(reclaimLog).includes('573001234567'));
  });

  it('sin filas abandonadas no loguea reclaim', async () => {
    const logs = captureLogs();
    const { queue } = fakeQueue([], 0);

    await processBatch(queue, fakeWhatsapp({ ok: true }), 50);

    assert.ok(!logs.some((e) => e.message === 'Filas PROCESSING abandonadas devueltas a PENDING'));
  });
});

describe('processBatch — logs sin datos personales (068 W-05, WD-3)', () => {
  const customerRow: WhatsappQueueRow = {
    ...platformRow,
    id: 'q-9',
    qrCampaignId: null,
    userPhone: '573109876543',
    userName: 'Ana María Pérez',
    templateName: 'calificar_pedido',
    templateParams: {
      nombre_tenant: 'La Previa',
      nombre_usuario: 'Ana',
      numero_pedido: '128',
      nombre_sede: 'Sede Centro',
      fecha_pedido: '1 nov 2026',
      boton_calificacion: 'AbCdEfGhIjKlMnOpQrStUv0123456789abcdEF',
    },
  };

  function assertNoPersonalData(logs: Array<Record<string, unknown>>) {
    const text = JSON.stringify(logs);
    for (const leaked of ['573109876543', '9876543', '6543', 'Ana María', 'Pérez']) {
      assert.ok(!text.includes(leaked), `el log incluye ${leaked}`);
    }
    for (const entry of logs) {
      assert.equal('userName' in entry, false);
      assert.equal('userPhone' in entry, false);
    }
  }

  it('envío exitoso: id de fila, plantilla y estado SENT, sin nombre ni teléfono', async () => {
    const logs = captureLogs();
    const { queue } = fakeQueue([customerRow]);

    await processBatch(queue, fakeWhatsapp({ ok: true, messageId: 'wamid.9', statusCode: 200 }), 50);

    assertNoPersonalData(logs);
    assert.deepEqual(
      logs.find((e) => e.message === 'Mensaje enviado'),
      {
        ts: logs.find((e) => e.message === 'Mensaje enviado')?.ts,
        level: 'info',
        message: 'Mensaje enviado',
        queueId: 'q-9',
        templateName: 'calificar_pedido',
        status: 'SENT',
        messageId: 'wamid.9',
        statusCode: 200,
      },
    );
  });

  it('envío fallido: id de fila, plantilla, estado FAILED y código de Meta, sin nombre ni teléfono', async () => {
    const logs = captureLogs();
    const { queue } = fakeQueue([customerRow]);

    await processBatch(
      queue,
      fakeWhatsapp({ ok: false, statusCode: 400, error: '(#132000) Number of parameters does not match | code=132000' }),
      50,
    );

    assertNoPersonalData(logs);
    const failed = logs.find((e) => e.message === 'Fallo al enviar mensaje');
    assert.ok(failed);
    assert.equal(failed.queueId, 'q-9');
    assert.equal(failed.templateName, 'calificar_pedido');
    assert.equal(failed.status, 'FAILED');
    assert.equal(failed.statusCode, 400);
    assert.match(String(failed.error), /code=132000/);
  });
});

