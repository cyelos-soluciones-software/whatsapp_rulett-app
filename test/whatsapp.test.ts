import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { Config } from '../src/config.js';
import { parseTemplateParams } from '../src/db/queue.js';
import { WhatsappClient } from '../src/services/whatsapp.js';
import type { WhatsappQueueRow } from '../src/types.js';
import { CONTRACT_TENANT_ID, V2_CONTRACT } from './fixtures/v2-contract.js';

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
  whatsappV2ButtonIndex: '1',
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

describe('sendTemplateMessage — plantillas v2 con botón (contrato 056)', () => {
  for (const contract of V2_CONTRACT) {
    it(`${contract.templateName}: header + body + botón con el tenantId`, async () => {
      const client = new WhatsappClient(config);
      const result = await client.sendTemplateMessage(
        buildRow(contract.templateName, contract.templateParams),
      );

      assert.equal(result.ok, true);
      assert.equal(fetchMock.mock.callCount(), 1);
      assert.deepEqual(sentBody(), {
        messaging_product: 'whatsapp',
        to: '573001234567',
        type: 'template',
        template: {
          name: contract.templateName,
          language: { code: 'es_CO' },
          components: contract.components,
        },
      });
    });

    it(`${contract.templateName}: el fixture sobrevive al viaje como texto JSON`, async () => {
      const client = new WhatsappClient(config);
      await client.sendTemplateMessage(
        buildRow(contract.templateName, JSON.stringify(contract.templateParams)),
      );

      assert.deepEqual(sentComponents(), contract.components);
    });
  }

  it('el botón no lleva parameter_name si WHATSAPP_V2_BUTTON_PARAM_NAME no está definida', async () => {
    const [contract] = V2_CONTRACT;
    const client = new WhatsappClient(config);
    await client.sendTemplateMessage(buildRow(contract.templateName, contract.templateParams));

    const buttonComponent = (sentComponents() as Array<Record<string, unknown>>)[2];
    const [parameter] = buttonComponent.parameters as Array<Record<string, unknown>>;
    assert.equal('parameter_name' in parameter, false);
  });

  it('con WHATSAPP_V2_BUTTON_PARAM_NAME el botón lleva parameter_name', async () => {
    const [contract] = V2_CONTRACT;
    const client = new WhatsappClient({ ...config, whatsappV2ButtonParamName: 'boton_comercio' });
    await client.sendTemplateMessage(buildRow(contract.templateName, contract.templateParams));

    assert.deepEqual((sentComponents() as unknown[])[2], {
      type: 'button',
      sub_type: 'url',
      index: '1',
      parameters: [{ type: 'text', parameter_name: 'boton_comercio', text: CONTRACT_TENANT_ID }],
    });
  });

  it('WHATSAPP_V2_BUTTON_INDEX personalizado se manda como índice del botón', async () => {
    const [contract] = V2_CONTRACT;
    const client = new WhatsappClient({ ...config, whatsappV2ButtonIndex: '0' });
    await client.sendTemplateMessage(buildRow(contract.templateName, contract.templateParams));

    assert.equal(((sentComponents() as unknown[])[2] as { index: string }).index, '0');
  });

  it('las claves desconocidas no viajan a Meta', async () => {
    const [contract] = V2_CONTRACT;
    const client = new WhatsappClient(config);
    await client.sendTemplateMessage(
      buildRow(contract.templateName, { ...contract.templateParams, nombre_evento: 'otro', extra: 'x' }),
    );

    assert.deepEqual(sentComponents(), contract.components);
  });

  it('una plantilla v1 no lleva botón aunque la fila traiga boton_comercio', async () => {
    const client = new WhatsappClient(config);
    await client.sendTemplateMessage(
      buildRow('recordatorio_cupon_vencer', { ...tenantParams, boton_comercio: CONTRACT_TENANT_ID }),
    );

    const components = sentComponents() as Array<{ type: string }>;
    assert.deepEqual(
      components.map((component) => component.type),
      ['header', 'body'],
    );
  });
});

describe('sendTemplateMessage — v2 con params incompletos fallan sin llamar a Meta', () => {
  const [recordatorio] = V2_CONTRACT;
  const without = (key: string) => {
    const copy: Record<string, string> = { ...recordatorio.templateParams };
    delete copy[key];
    return copy;
  };
  const cases: Array<[string, Record<string, unknown>]> = [
    ['sin boton_comercio', without('boton_comercio')],
    ['boton_comercio vacío', { ...recordatorio.templateParams, boton_comercio: '' }],
    ['boton_comercio que no es UUID', { ...recordatorio.templateParams, boton_comercio: 'tenant-1' }],
    ['boton_comercio con ruta', { ...recordatorio.templateParams, boton_comercio: `${CONTRACT_TENANT_ID}/../x` }],
    ['boton_comercio con texto antes', { ...recordatorio.templateParams, boton_comercio: `x${CONTRACT_TENANT_ID}` }],
    ['boton_comercio numérico', { ...recordatorio.templateParams, boton_comercio: 123 }],
    ['sin cantidad_cupones', without('cantidad_cupones')],
    ['cupon vacío', { ...recordatorio.templateParams, cupon: '  ' }],
    ['sin nombre_tenant', without('nombre_tenant')],
  ];

  for (const [label, params] of cases) {
    it(label, async () => {
      const client = new WhatsappClient(config);
      const result = await client.sendTemplateMessage(buildRow(recordatorio.templateName, params));

      assert.deepEqual(result, { ok: false, error: EMPTY_PARAMS_ERROR });
      assert.equal(fetchMock.mock.callCount(), 0);
    });
  }

  it('el UUID en mayúsculas es válido', async () => {
    const client = new WhatsappClient(config);
    const result = await client.sendTemplateMessage(
      buildRow(recordatorio.templateName, {
        ...recordatorio.templateParams,
        boton_comercio: CONTRACT_TENANT_ID.toUpperCase(),
      }),
    );

    assert.equal(result.ok, true);
  });
});
