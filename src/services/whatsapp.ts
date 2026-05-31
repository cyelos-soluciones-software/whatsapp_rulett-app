import type { Config } from '../config.js';
import type { WhatsappQueueRow, WhatsappSendResult } from '../types.js';

const GRAPH_API_VERSION = 'v25.0';

interface GraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

interface GraphSuccessBody {
  messages?: Array<{ id: string }>;
}

export class WhatsappClient {
  private readonly token: string;
  private readonly phoneId: string;
  private readonly accountId: string;
  private readonly defaultLanguageCode: string;

  constructor(config: Config) {
    this.token = config.whatsappToken;
    this.phoneId = config.whatsappPhoneId;
    this.accountId = config.whatsappAccountId;
    this.defaultLanguageCode = config.whatsappLanguageCode;
  }

  private endpoint(): string {
    return `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneId}/messages`;
  }

  async sendTemplateMessage(row: WhatsappQueueRow): Promise<WhatsappSendResult> {
    const languageCode = row.languageCode || this.defaultLanguageCode;

    const body = {
      messaging_product: 'whatsapp',
      to: row.userPhone,
      type: 'template',
      template: {
        name: row.templateName,
        language: { code: languageCode },
      },
    };

    try {
      const response = await fetch(this.endpoint(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as GraphSuccessBody & GraphErrorBody;

      if (!response.ok) {
        const apiMessage =
          payload.error?.message ??
          `HTTP ${response.status} al enviar mensaje (account=${this.accountId})`;

        return {
          ok: false,
          statusCode: response.status,
          error: apiMessage,
        };
      }

      return {
        ok: true,
        messageId: payload.messages?.[0]?.id,
        statusCode: response.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: message,
      };
    }
  }
}
