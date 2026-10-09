import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { Config } from '../src/config.js';
import { parseTemplateParams } from '../src/db/queue.js';
import { WhatsappClient } from '../src/services/whatsapp.js';
import type { WhatsappQueueRow } from '../src/types.js';

const config: Config = {
  databaseUrl: 'postgresql://localhost/test',
  databaseSsl: false,
  batchSize: 50,
  httpPort: 8080,
  workerApiKey: 'test-key',
  whatsappToken: 'test-token',
  whatsappPhoneId: '123456',
  whatsappAccountId: 'acc-1',
  whatsappLanguageCode: 'es_CO',
};

const EMPTY_PARAMS_ERROR = 'templateParams vacío: no se puede enviar plantilla con variables';

function buildRow(templateName: string, rawParams: unknown): WhatsappQueueRow {
  return {
    id: 'q-1',
    tenantId: 't-1',
    qrCampaignId: null,
    userPhone: '573001234567',
    userName: 'Café Central',
    templateName,
    templateParams: parseTemplateParams(rawParams, templateName),
    languageCode: 'es_CO',
    status: 'PROCESSING',
    errorLog: null,
    createdAt: new Date('2026-10-01T13:00:00Z'),
    updatedAt: new Date('2026-10-01T13:00:00Z'),
    sentAt: null,
  };
}

const tenantParams = {
  nombre_tenant: 'Café Central',
  nombre_usuario: 'Ana',
  cupon: '2x1 en café',
  fecha_vencimiento: '15 de octubre',
  mes_cumpleanos: 'octubre',
  regalo_usuario: 'Postre gratis',
  nombre_evento: 'Noche de jazz',
  fecha_evento: '20 de octubre',
  fecha_limite: '31 de octubre',
  descuento_promo: '30%',
  producto_servicio: 'Brunch',
};

const tenantHeader = {
  type: 'header',
  parameters: [{ type: 'text', parameter_name: 'nombre_tenant', text: 'Café Central' }],
};

function text(parameterName: string, value: string) {
  return { type: 'text', parameter_name: parameterName, text: value };
}

let fetchMock: ReturnType<typeof mock.method>;

function sentBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls[0];
  assert.ok(call, 'se esperaba una llamada a fetch');
  const init = call.arguments[1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

function sentComponents(): unknown {
  return (sentBody().template as Record<string, unknown>).components;
}

beforeEach(() => {
  fetchMock = mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), { status: 200 }),
  );
});

afterEach(() => {
  mock.restoreAll();
});

describe('sendTemplateMessage — aviso de suscripción', () => {
  it('recordatorio_suscripcion_7d manda solo body con nombre_comercio y dias', async () => {
    const client = new WhatsappClient(config);
    const result = await client.sendTemplateMessage(
      buildRow('recordatorio_suscripcion_7d', { nombre_comercio: 'Café Central', dias: '7' }),
    );

    assert.equal(result.ok, true);
    assert.equal(result.messageId, 'wamid.test');
    assert.equal(fetchMock.mock.callCount(), 1);
    assert.equal(
      fetchMock.mock.calls[0]?.arguments[0],
      'https://graph.facebook.com/v25.0/123456/messages',
    );
    assert.deepEqual(sentBody(), {
      messaging_product: 'whatsapp',
      to: '573001234567',
      type: 'template',
      template: {
        name: 'recordatorio_suscripcion_7d',
        language: { code: 'es_CO' },
        components: [
          {
            type: 'body',
            parameters: [text('nombre_comercio', 'Café Central'), text('dias', '7')],
          },
        ],
      },
    });
  });

  it('recordatorio_suscripcion_hoy manda solo body con nombre_comercio', async () => {
    const client = new WhatsappClient(config);
    const result = await client.sendTemplateMessage(
      buildRow('recordatorio_suscripcion_hoy', { nombre_comercio: 'Café Central' }),
    );

    assert.equal(result.ok, true);
    assert.deepEqual(sentComponents(), [
      { type: 'body', parameters: [text('nombre_comercio', 'Café Central')] },
    ]);
  });

  it('recordatorio_suscripcion_hoy ignora dias si llega', async () => {
    const client = new WhatsappClient(config);
    await client.sendTemplateMessage(
      buildRow('recordatorio_suscripcion_hoy', { nombre_comercio: 'Café Central', dias: '7' }),
    );

    assert.deepEqual(sentComponents(), [
      { type: 'body', parameters: [text('nombre_comercio', 'Café Central')] },
    ]);
  });

  it('acepta templateParams como texto JSON', async () => {
    const client = new WhatsappClient(config);
    const result = await client.sendTemplateMessage(
      buildRow(
        'recordatorio_suscripcion_7d',
        JSON.stringify({ nombre_comercio: 'Café Central', dias: '7' }),
      ),
    );

    assert.equal(result.ok, true);
    assert.equal(fetchMock.mock.callCount(), 1);
  });
});

describe('sendTemplateMessage — params incompletos fallan sin llamar a Meta', () => {
  const cases: Array<[string, string, unknown]> = [
    ['7d sin dias', 'recordatorio_suscripcion_7d', { nombre_comercio: 'Café Central' }],
    ['7d con dias numérico', 'recordatorio_suscripcion_7d', { nombre_comercio: 'Café', dias: 7 }],
    ['7d con dias vacío', 'recordatorio_suscripcion_7d', { nombre_comercio: 'Café', dias: ' ' }],
    [
      '7d con el JSON de comercio',
      'recordatorio_suscripcion_7d',
      { nombre_tenant: 'Café', nombre_usuario: 'Ana' },
    ],
    ['hoy sin nombre_comercio', 'recordatorio_suscripcion_hoy', {}],
    ['hoy con nombre_comercio vacío', 'recordatorio_suscripcion_hoy', { nombre_comercio: '  ' }],
    [
      'plantilla actual sin nombre_usuario',
      'recordatorio_cupon_vencer',
      { nombre_tenant: 'Café' },
    ],
    [
      'plantilla actual con el JSON del aviso',
      'cumpleanos_regalo_tenant',
      { nombre_comercio: 'Café', dias: '7' },
    ],
    ['plantilla desconocida sin nombre_tenant', 'plantilla_nueva', { nombre_comercio: 'Café' }],
    ['templateParams null', 'recordatorio_suscripcion_hoy', null],
    ['templateParams no objeto', 'recordatorio_suscripcion_hoy', 42],
    ['texto JSON inválido', 'recordatorio_suscripcion_hoy', '{no-json'],
  ];

  for (const [label, templateName, raw] of cases) {
    it(label, async () => {
      const client = new WhatsappClient(config);
      const result = await client.sendTemplateMessage(buildRow(templateName, raw));

      assert.deepEqual(result, { ok: false, error: EMPTY_PARAMS_ERROR });
      assert.equal(fetchMock.mock.callCount(), 0);
    });
  }
});

describe('sendTemplateMessage — plantillas actuales sin cambios', () => {
  it('recordatorio_cupon_vencer', async () => {
    const client = new WhatsappClient(config);
    await client.sendTemplateMessage(buildRow('recordatorio_cupon_vencer', tenantParams));

    assert.deepEqual(sentComponents(), [
      tenantHeader,
      {
        type: 'body',
        parameters: [
          text('nombre_usuario', 'Ana'),
          text('cupon', '2x1 en café'),
          text('nombre_tenant', 'Café Central'),
          text('fecha_vencimiento', '15 de octubre'),
        ],
      },
    ]);
  });

  it('cumpleanos_regalo_tenant', async () => {
    const client = new WhatsappClient(config);
    await client.sendTemplateMessage(buildRow('cumpleanos_regalo_tenant', tenantParams));

    assert.deepEqual(sentComponents(), [
      tenantHeader,
      {
        type: 'body',
        parameters: [
          text('nombre_usuario', 'Ana'),
          text('mes_cumpleanos', 'octubre'),
          text('regalo_usuario', 'Postre gratis'),
        ],
      },
    ]);
  });

  it('invitacion_evento_exclusivo', async () => {
    const client = new WhatsappClient(config);
    await client.sendTemplateMessage(buildRow('invitacion_evento_exclusivo', tenantParams));

    assert.deepEqual(sentComponents(), [
      tenantHeader,
      {
        type: 'body',
        parameters: [
          text('nombre_usuario', 'Ana'),
          text('nombre_tenant', 'Café Central'),
          text('nombre_evento', 'Noche de jazz'),
          text('fecha_evento', '20 de octubre'),
        ],
      },
    ]);
  });

  it('promocion_relampago', async () => {
    const client = new WhatsappClient(config);
    await client.sendTemplateMessage(buildRow('promocion_relampago', tenantParams));

    assert.deepEqual(sentComponents(), [
      tenantHeader,
      {
        type: 'body',
        parameters: [
          text('nombre_tenant', 'Café Central'),
          text('nombre_usuario', 'Ana'),
          text('fecha_limite', '31 de octubre'),
          text('descuento_promo', '30%'),
          text('producto_servicio', 'Brunch'),
        ],
      },
    ]);
  });

  it('opcionales ausentes viajan como texto vacío', async () => {
    const client = new WhatsappClient(config);
    await client.sendTemplateMessage(
      buildRow('recordatorio_cupon_vencer', { nombre_tenant: 'Café Central', nombre_usuario: 'Ana' }),
    );

    assert.deepEqual(sentComponents(), [
      tenantHeader,
      {
        type: 'body',
        parameters: [
          text('nombre_usuario', 'Ana'),
          text('cupon', ''),
          text('nombre_tenant', 'Café Central'),
          text('fecha_vencimiento', ''),
        ],
      },
    ]);
  });

  it('plantilla desconocida sigue cayendo al header nombre_tenant', async () => {
    const client = new WhatsappClient(config);
    await client.sendTemplateMessage(buildRow('plantilla_nueva', tenantParams));

    assert.deepEqual(sentComponents(), [tenantHeader]);
  });
});

describe('sendTemplateMessage — respuesta de Meta', () => {
  it('error de Graph devuelve el detalle y el status', async () => {
    fetchMock.mock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          error: { message: 'Template mismatch', code: 132000, error_subcode: 1, fbtrace_id: 'abc' },
        }),
        { status: 400 },
      ),
    );
    const client = new WhatsappClient(config);
    const result = await client.sendTemplateMessage(
      buildRow('recordatorio_suscripcion_hoy', { nombre_comercio: 'Café Central' }),
    );

    assert.deepEqual(result, {
      ok: false,
      statusCode: 400,
      error: 'Template mismatch | code=132000 | subcode=1 | trace=abc',
    });
  });

  it('fallo de red devuelve el mensaje', async () => {
    fetchMock.mock.mockImplementation(async () => {
      throw new Error('ECONNRESET');
    });
    const client = new WhatsappClient(config);
    const result = await client.sendTemplateMessage(
      buildRow('recordatorio_suscripcion_hoy', { nombre_comercio: 'Café Central' }),
    );

    assert.deepEqual(result, { ok: false, error: 'ECONNRESET' });
  });
});
