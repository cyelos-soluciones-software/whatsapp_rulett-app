export type QueueStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

export const SUBSCRIPTION_REMINDER_7D_TEMPLATE = 'recordatorio_suscripcion_7d';
export const SUBSCRIPTION_REMINDER_DUE_DAY_TEMPLATE = 'recordatorio_suscripcion_hoy';

export type SubscriptionReminderTemplateParams = {
  nombre_comercio: string;
  dias?: string;
};

export type TenantTemplateParams = {
  nombre_tenant: string;
  nombre_usuario: string;
  cupon?: string;
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
