export type QueueStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

export type WhatsappTemplateParams = {
  nombre_tenant: string;
  nombre_usuario: string;
  cupon?: string;
  fecha_vencimiento?: string;
  mes_cumpleanos?: string;
  regalo_usuario?: string;
};

export interface WhatsappQueueRow {
  id: string;
  tenantId: string;
  qrCampaignId: string;
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
