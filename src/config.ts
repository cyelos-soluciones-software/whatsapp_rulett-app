import 'dotenv/config';

export interface Config {
  databaseUrl: string;
  databaseSsl: boolean;
  pollIntervalMs: number;
  batchSize: number;
  whatsappToken: string;
  whatsappPhoneId: string;
  whatsappAccountId: string;
  whatsappLanguageCode: string;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variable de entorno requerida no definida: ${name}`);
  }
  return value;
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} debe ser un entero positivo. Valor recibido: ${raw}`);
  }

  return parsed;
}

function parseBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) {
    return fallback;
  }

  if (['true', '1', 'yes'].includes(raw)) {
    return true;
  }
  if (['false', '0', 'no'].includes(raw)) {
    return false;
  }

  throw new Error(`${name} debe ser true o false. Valor recibido: ${raw}`);
}

export function loadConfig(): Config {
  const databaseUrl = requireEnv('DATABASE_URL');
  const isLocalhost = /localhost|127\.0\.0\.1/.test(databaseUrl);

  return {
    databaseUrl,
    databaseSsl: parseBoolean('DATABASE_SSL', !isLocalhost),
    pollIntervalMs: parsePositiveInt('POLL_INTERVAL_MS', 60_000),
    batchSize: parsePositiveInt('BATCH_SIZE', 50),
    whatsappToken: requireEnv('WHATSAPP_TOKEN'),
    whatsappPhoneId: requireEnv('WHATSAPP_PHONE_ID'),
    whatsappAccountId: requireEnv('WHATSAPP_ACCOUNT_ID'),
    whatsappLanguageCode: process.env.WHATSAPP_LANGUAGE_CODE?.trim() || 'es_CO',
  };
}
