/**
 * Fixture de contrato 056 (design §3.1): el JSON exacto que `rulett-app` escribe en
 * `WhatsappQueue.templateParams` para cada plantilla v2 y los `components` que el worker debe
 * mandar a Meta. Se replica tal cual en `rulett-app` (T-14) para que los dos lados no se separen.
 *
 * Botón posicional en el índice por defecto («1»): `parameters: [{ type: 'text', text: tenantId }]`.
 */
export const CONTRACT_TENANT_ID = '7f3c2b1a-9d4e-4f6a-8b5c-1e2d3f4a5b6c';

const text = (parameterName: string, value: string) => ({
  type: 'text',
  parameter_name: parameterName,
  text: value,
});

const header = {
  type: 'header',
  parameters: [text('nombre_tenant', 'Café Central')],
};

const button = {
  type: 'button',
  sub_type: 'url',
  index: '1',
  parameters: [{ type: 'text', text: CONTRACT_TENANT_ID }],
};

export type V2ContractCase = {
  templateName: string;
  templateParams: Record<string, string>;
  components: unknown[];
};

export const V2_CONTRACT: V2ContractCase[] = [
  {
    templateName: 'recordatorio_cupones_vencer_v2',
    templateParams: {
      nombre_tenant: 'Café Central',
      nombre_usuario: 'Ana',
      cantidad_cupones: '3',
      cupon: 'Postre gratis',
      fecha_vencimiento: '15/10/2026',
      boton_comercio: CONTRACT_TENANT_ID,
    },
    components: [
      header,
      {
        type: 'body',
        parameters: [
          text('nombre_usuario', 'Ana'),
          text('cantidad_cupones', '3'),
          text('cupon', 'Postre gratis'),
          text('fecha_vencimiento', '15/10/2026'),
        ],
      },
      button,
    ],
  },
  {
    templateName: 'cumpleanos_regalo_tenant_v2',
    templateParams: {
      nombre_tenant: 'Café Central',
      nombre_usuario: 'Ana',
      mes_cumpleanos: 'Octubre',
      regalo_usuario: 'Postre gratis',
      boton_comercio: CONTRACT_TENANT_ID,
    },
    components: [
      header,
      {
        type: 'body',
        parameters: [
          text('nombre_usuario', 'Ana'),
          text('mes_cumpleanos', 'Octubre'),
          text('regalo_usuario', 'Postre gratis'),
        ],
      },
      button,
    ],
  },
  {
    templateName: 'invitacion_evento_exclusivo_v2',
    templateParams: {
      nombre_tenant: 'Café Central',
      nombre_usuario: 'Ana',
      nombre_evento: 'Noche de catas',
      fecha_evento: '20/10/2026',
      boton_comercio: CONTRACT_TENANT_ID,
    },
    components: [
      header,
      {
        type: 'body',
        parameters: [
          text('nombre_usuario', 'Ana'),
          text('nombre_evento', 'Noche de catas'),
          text('fecha_evento', '20/10/2026'),
        ],
      },
      button,
    ],
  },
  {
    templateName: 'promocion_relampago_v2',
    templateParams: {
      nombre_tenant: 'Café Central',
      nombre_usuario: 'Ana',
      fecha_limite: '20/10/2026',
      descuento_promo: '30 %',
      producto_servicio: 'hamburguesas',
      boton_comercio: CONTRACT_TENANT_ID,
    },
    components: [
      header,
      {
        type: 'body',
        parameters: [
          text('nombre_usuario', 'Ana'),
          text('fecha_limite', '20/10/2026'),
          text('descuento_promo', '30 %'),
          text('producto_servicio', 'hamburguesas'),
        ],
      },
      button,
    ],
  },
];
