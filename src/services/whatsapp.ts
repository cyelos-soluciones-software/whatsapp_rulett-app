import type { Config } from '../config.js';
import type { WhatsappQueueRow, WhatsappSendResult, WhatsappTemplateParams } from '../types.js';

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

type TemplateTextParameter = {
  type: 'text';
  parameter_name: string;
  text: string;
};

type TemplateComponent = {
  type: 'header' | 'body';
  parameters: TemplateTextParameter[];
};

function textParam(parameterName: string, value: string): TemplateTextParameter {
  return {
    type: 'text',
    parameter_name: parameterName,
    text: value,
  };
}

function buildTemplateComponents(
  templateName: string,
  params: WhatsappTemplateParams,
): TemplateComponent[] {
  const header: TemplateComponent = {
    type: 'header',
    parameters: [textParam('nombre_tenant', params.nombre_tenant)],
  };

  if (templateName === 'recordatorio_cupon_vencer') {
    return [
      header,
      {
        type: 'body',
        parameters: [
          textParam('nombre_usuario', params.nombre_usuario),
          textParam('cupon', params.cupon ?? ''),
          textParam('nombre_tenant', params.nombre_tenant),
          textParam('fecha_vencimiento', params.fecha_vencimiento ?? ''),
        ],
      },
    ];
  }

  if (templateName === 'cumpleanos_regalo_tenant') {
    return [
      header,
      {
        type: 'body',
        parameters: [
          textParam('nombre_usuario', params.nombre_usuario),
          textParam('mes_cumpleanos', params.mes_cumpleanos ?? ''),
          textParam('regalo_usuario', params.regalo_usuario ?? ''),
        ],
      },
    ];
  }

  if (templateName === 'invitacion_evento_exclusivo') {
    return [
      {
        type: 'body',
        parameters: [
          textParam('nombre_usuario', params.nombre_usuario),
          textParam('nombre_tenant', params.nombre_tenant),
          textParam('nombre_evento', params.nombre_evento ?? ''),
          textParam('fecha_evento', params.fecha_evento ?? ''),
        ],
      },
    ];
  }

  return [header];
}

function formatGraphError(payload: GraphErrorBody, status: number, accountId: string): string {
  const parts: string[] = [];
  const err = payload.error;
  if (err?.message) parts.push(err.message);
  if (err?.code != null) parts.push(`code=${err.code}`);
  if (err?.error_subcode != null) parts.push(`subcode=${err.error_subcode}`);
  if (err?.fbtrace_id) parts.push(`trace=${err.fbtrace_id}`);
  if (parts.length === 0) {
    parts.push(`HTTP ${status} al enviar mensaje (account=${accountId})`);
  }
  return parts.join(' | ');
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

    if (!row.templateParams) {
      return {
        ok: false,
        error: 'templateParams vacío: no se puede enviar plantilla con variables',
      };
    }

    const template: Record<string, unknown> = {
      name: row.templateName,
      language: { code: languageCode },
      components: buildTemplateComponents(row.templateName, row.templateParams),
    };

    const body = {
      messaging_product: 'whatsapp',
      to: row.userPhone,
      type: 'template',
      template,
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
        return {
          ok: false,
          statusCode: response.status,
          error: formatGraphError(payload, response.status, this.accountId),
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
