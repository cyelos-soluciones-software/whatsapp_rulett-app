import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapRow } from '../src/db/queue.js';
import { CONTRACT_TENANT_ID, V2_CONTRACT } from './fixtures/v2-contract.js';

const baseRow = {
  id: 'q-1',
  tenantId: 't-1',
  userPhone: '573001234567',
  userName: 'Café Central',
  status: 'PENDING',
  errorLog: null,
  createdAt: '2026-10-01T13:00:00.000Z',
  updatedAt: '2026-10-01T13:00:00.000Z',
  sentAt: null,
};

describe('mapRow', () => {
  it('conserva qrCampaignId null en una fila de plataforma', () => {
    const row = mapRow({
      ...baseRow,
      qrCampaignId: null,
      templateName: 'recordatorio_suscripcion_7d',
      templateParams: { nombre_comercio: 'Café Central', dias: '7' },
      languageCode: 'es_CO',
    });

    assert.equal(row.qrCampaignId, null);
    assert.deepEqual(row.templateParams, { nombre_comercio: 'Café Central', dias: '7' });
  });

  it('trata qrCampaignId ausente como null', () => {
    const row = mapRow({
      ...baseRow,
      templateName: 'recordatorio_suscripcion_hoy',
      templateParams: { nombre_comercio: 'Café Central' },
    });

    assert.equal(row.qrCampaignId, null);
    assert.equal(row.languageCode, 'es_CO');
  });

  it('mantiene la campaña de una fila de comercio', () => {
    const row = mapRow({
      ...baseRow,
      qrCampaignId: 'camp-1',
      templateName: 'recordatorio_cupon_vencer',
      templateParams: { nombre_tenant: 'Café Central', nombre_usuario: 'Ana', cupon: '2x1' },
      languageCode: 'es_CO',
      errorLog: 'previo',
      sentAt: '2026-10-01T14:00:00.000Z',
    });

    assert.equal(row.qrCampaignId, 'camp-1');
    assert.equal(row.errorLog, 'previo');
    assert.ok(row.sentAt instanceof Date);
    assert.deepEqual(row.templateParams, {
      nombre_tenant: 'Café Central',
      nombre_usuario: 'Ana',
      cupon: '2x1',
      fecha_vencimiento: undefined,
      mes_cumpleanos: undefined,
      regalo_usuario: undefined,
      nombre_evento: undefined,
      fecha_evento: undefined,
      fecha_limite: undefined,
      descuento_promo: undefined,
      producto_servicio: undefined,
    });
  });

  it('valida templateParams según la plantilla de la fila', () => {
    const row = mapRow({
      ...baseRow,
      qrCampaignId: null,
      templateName: 'recordatorio_suscripcion_7d',
      templateParams: { nombre_tenant: 'Café Central', nombre_usuario: 'Ana' },
      languageCode: 'es_CO',
    });

    assert.equal(row.templateParams, null);
  });
});

describe('mapRow — plantillas v2', () => {
  const v2Row = (templateParams: unknown, templateName = 'recordatorio_cupones_vencer_v2') => ({
    ...baseRow,
    qrCampaignId: 'c-1',
    templateName,
    templateParams,
    languageCode: 'es_CO',
  });

  it('parsea cada fixture del contrato con todos sus params', () => {
    for (const contract of V2_CONTRACT) {
      const row = mapRow(v2Row(contract.templateParams, contract.templateName));
      assert.deepEqual(row.templateParams, contract.templateParams, contract.templateName);
    }
  });

  it('descarta las claves desconocidas y las de otras plantillas', () => {
    const [contract] = V2_CONTRACT;
    const row = mapRow(
      v2Row({ ...contract.templateParams, extra: 'x', nombre_evento: 'otro' }, contract.templateName),
    );

    assert.deepEqual(row.templateParams, contract.templateParams);
  });

  it('boton_comercio ausente → params incompletos', () => {
    const [contract] = V2_CONTRACT;
    const { boton_comercio: _omit, ...rest } = contract.templateParams;
    assert.equal(mapRow(v2Row(rest, contract.templateName)).templateParams, null);
  });

  it('boton_comercio inválido → params incompletos', () => {
    const [contract] = V2_CONTRACT;
    for (const invalid of ['', 'abc', 'g'.repeat(36), `${CONTRACT_TENANT_ID}?x=1`, null, 7]) {
      const row = mapRow(v2Row({ ...contract.templateParams, boton_comercio: invalid }, contract.templateName));
      assert.equal(row.templateParams, null, String(invalid));
    }
  });

  it('una variable obligatoria vacía → params incompletos', () => {
    for (const contract of V2_CONTRACT) {
      for (const key of Object.keys(contract.templateParams)) {
        const row = mapRow(v2Row({ ...contract.templateParams, [key]: '' }, contract.templateName));
        assert.equal(row.templateParams, null, `${contract.templateName}.${key}`);
      }
    }
  });

  it('las v1 siguen siendo permisivas: un opcional ausente no invalida', () => {
    const row = mapRow({
      ...baseRow,
      qrCampaignId: 'c-1',
      templateName: 'recordatorio_cupon_vencer',
      templateParams: { nombre_tenant: 'Café Central', nombre_usuario: 'Ana' },
      languageCode: 'es_CO',
    });

    assert.deepEqual(row.templateParams?.nombre_usuario, 'Ana');
  });
});
