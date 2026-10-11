export type QueueStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

export const SUBSCRIPTION_REMINDER_7D_TEMPLATE = 'recordatorio_suscripcion_7d';
export const SUBSCRIPTION_REMINDER_DUE_DAY_TEMPLATE = 'recordatorio_suscripcion_hoy';

export type SubscriptionReminderTemplateParams = {
  nombre_comercio: string;
  dias?: string;
};

/**
 * Plantillas v2 (056): mismo contenido que las v1 más el botón «Información del comercio».
 * Cada una lista las variables de su cuerpo, en el orden aprobado en Meta (design §3.1).
 * `nombre_tenant` va solo en el encabezado y `boton_comercio` solo en el botón.
 */
export const V2_TEMPLATE_BODY_PARAMS = {
  recordatorio_cupones_vencer_v2: [
    'nombre_usuario',
    'cantidad_cupones',
    'cupon',
    'fecha_vencimiento',
  ],
  cumpleanos_regalo_tenant_v2: ['nombre_usuario', 'mes_cumpleanos', 'regalo_usuario'],
  invitacion_evento_exclusivo_v2: ['nombre_usuario', 'nombre_evento', 'fecha_evento'],
  promocion_relampago_v2: ['nombre_usuario', 'fecha_limite', 'descuento_promo', 'producto_servicio'],
} as const;

export type V2TemplateName = keyof typeof V2_TEMPLATE_BODY_PARAMS;

export function isV2Template(templateName: string): templateName is V2TemplateName {
  return Object.hasOwn(V2_TEMPLATE_BODY_PARAMS, templateName);
}

export type TenantTemplateParams = {
  nombre_tenant: string;
  nombre_usuario: string;
  cupon?: string;
  cantidad_cupones?: string;
  /** `tenantId` (UUID): parámetro del botón URL dinámico de las plantillas v2. */
  boton_comercio?: string;
  fecha_vencimiento?: string;
  mes_cumpleanos?: string;
  regalo_usuario?: string;
  nombre_evento?: string;
  fecha_evento?: string;
  fecha_limite?: string;
  descuento_promo?: string;
  producto_servicio?: string;
};

export type WhatsappTemplateParams = TenantTemplateParams | SubscriptionReminderTemplateParams;

export interface WhatsappQueueRow {
  id: string;
  tenantId: string;
  qrCampaignId: string | null;
  userPhone: string;
  userName: string;
  templateName: string;
  templateParams: WhatsappTemplateParams | null;
  languageCode: string;
  status: QueueStatus;
  errorLog: string | null;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
}

export interface WhatsappSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}
