import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import type { QueueRepository } from '../src/db/queue.js';
import { maskPhone } from '../src/lib/mask-phone.js';
import { processBatch } from '../src/processor.js';
import type { WhatsappClient } from '../src/services/whatsapp.js';
import type { WhatsappQueueRow, WhatsappSendResult } from '../src/types.js';

describe('maskPhone', () => {
  it('deja solo los últimos 4 dígitos', () => {
    assert.equal(maskPhone('573001234567'), '***4567');
  });

  it('ignora símbolos y espacios', () => {
    assert.equal(maskPhone('+57 300 123 4567'), '***4567');
  });

  it('no revela números de 4 dígitos o menos', () => {
    assert.equal(maskPhone('4567'), '***');
    assert.equal(maskPhone(''), '***');
  });
});

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

function fakeQueue(rows: WhatsappQueueRow[]) {
  const calls = { sent: [] as string[], failed: [] as Array<[string, string]> };
  const queue = {
    claimPendingBatch: async () => rows,
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
  it('envía una fila de plataforma sin campaña y loguea el teléfono enmascarado', async () => {
    const logs = captureLogs();
    const { queue, calls } = fakeQueue([platformRow]);

    const count = await processBatch(queue, fakeWhatsapp({ ok: true, messageId: 'wamid.1' }), 50);

    assert.equal(count, 1);
    assert.deepEqual(calls.sent, ['q-1']);
    const processing = logs.find((e) => e.message === 'Procesando mensaje');
    assert.ok(processing);
    assert.equal(processing.userPhone, '***4567');
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
});
