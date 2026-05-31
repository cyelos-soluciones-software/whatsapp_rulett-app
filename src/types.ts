export type QueueStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface WhatsappQueueRow {
  id: string;
  tenantId: string;
  qrCampaignId: string;
  userPhone: string;
  userName: string;
  templateName: string;
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
