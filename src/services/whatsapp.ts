import type { Config } from '../config.js';
import {
  isV2Template,
  SUBSCRIPTION_REMINDER_7D_TEMPLATE,
  V2_TEMPLATE_BODY_PARAMS,
} from '../types.js';
import type {
  SubscriptionReminderTemplateParams,
  TenantTemplateParams,
  WhatsappQueueRow,
  WhatsappSendResult,
  WhatsappTemplateParams,
} from '../types.js';

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

/** Parámetro del botón URL dinámico: posicional salvo que Meta lo registre con nombre. */
type TemplateButtonParameter = {
  type: 'text';
  parameter_name?: string;
  text: string;
};

type TemplateComponent =
  | { type: 'header' | 'body'; parameters: TemplateTextParameter[] }
  | {
      type: 'button';
      sub_type: 'url';
      index: string;
      parameters: TemplateButtonParameter[];
    };

export type ButtonOptions = { index: string; paramName?: string };

const DEFAULT_BUTTON_OPTIONS: ButtonOptions = { index: '1' };

function textParam(parameterName: string, value: string): TemplateTextParameter {
  return {
    type: 'text',
    parameter_name: parameterName,
    text: value,
  };
}

function buildSubscriptionReminderComponents(
  templateName: string,
  params: SubscriptionReminderTemplateParams,
): TemplateComponent[] {
  const parameters = [textParam('nombre_comercio', params.nombre_comercio)];
  if (templateName === SUBSCRIPTION_REMINDER_7D_TEMPLATE) {
    parameters.push(textParam('dias', params.dias ?? ''));
  }
  return [{ type: 'body', parameters }];
}

function buildV2Components(
  templateName: keyof typeof V2_TEMPLATE_BODY_PARAMS,
  params: TenantTemplateParams,
  button: ButtonOptions,
): TemplateComponent[] {
  const buttonParameter: TemplateButtonParameter = {
    type: 'text',
    text: params.boton_comercio ?? '',
  };
  if (button.paramName) buttonParameter.parameter_name = button.paramName;

  return [
    { type: 'header', parameters: [textParam('nombre_tenant', params.nombre_tenant)] },
    {
      type: 'body',
      parameters: V2_TEMPLATE_BODY_PARAMS[templateName].map((name) =>
        textParam(name, params[name] ?? ''),
      ),
    },
    { type: 'button', sub_type: 'url', index: button.index, parameters: [buttonParameter] },
  ];
}

function buildTemplateComponents(
  templateName: string,
  params: WhatsappTemplateParams,
  button: ButtonOptions = DEFAULT_BUTTON_OPTIONS,
): TemplateComponent[] {
  if ('nombre_comercio' in params) {
    return buildSubscriptionReminderComponents(templateName, params);
  }

  if (isV2Template(templateName)) {
    return buildV2Components(templateName, params, button);
  }

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
      header,
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

  if (templateName === 'promocion_relampago') {
    return [
      header,
      {
        type: 'body',
        parameters: [
          textParam('nombre_tenant', params.nombre_tenant),
          textParam('nombre_usuario', params.nombre_usuario),
          textParam('fecha_limite', params.fecha_limite ?? ''),
          textParam('descuento_promo', params.descuento_promo ?? ''),
          textParam('producto_servicio', params.producto_servicio ?? ''),
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
  private readonly button: ButtonOptions;

  constructor(config: Config) {
    this.token = config.whatsappToken;
    this.phoneId = config.whatsappPhoneId;
    this.accountId = config.whatsappAccountId;
    this.defaultLanguageCode = config.whatsappLanguageCode;
    this.button = {
      index: config.whatsappV2ButtonIndex,
      paramName: config.whatsappV2ButtonParamName,
    };
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
      components: buildTemplateComponents(row.templateName, row.templateParams, this.button),
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
