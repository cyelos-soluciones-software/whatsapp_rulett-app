import 'dotenv/config';

export interface Config {
  databaseUrl: string;
  databaseSsl: boolean;
  batchSize: number;
  httpPort: number;
  workerApiKey: string;
  whatsappToken: string;
  whatsappPhoneId: string;
  whatsappAccountId: string;
  whatsappLanguageCode: string;
  /** Posición del botón «Información del comercio» en las plantillas v2 (índice base 0, como texto). */
  whatsappV2ButtonIndex: string;
  /** Si está definido, el parámetro del botón se envía con este `parameter_name`; si no, va posicional. */
  whatsappV2ButtonParamName?: string;
}

const PRISMA_ONLY_QUERY_PARAMS = [
  'schema',
  'connection_limit',
  'pool_timeout',
  'pgbouncer',
  'connect_timeout',
];

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
    throw new Error(`${name} debe ser un entero positivo.`);
  }

  return parsed;
}

/** Entero ≥ 0 como texto. Un valor inválido hace fallar el arranque, igual que `BATCH_SIZE`. */
function parseNonNegativeIntText(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} debe ser un entero mayor o igual a 0.`);
  }

  return String(Number.parseInt(raw, 10));
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

  throw new Error(`${name} debe ser true o false.`);
}

/**
 * Elimina parámetros de Prisma (?schema=public) que pg no necesita.
 */
export function normalizeDatabaseUrl(url: string): string {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return url;
  }

  const base = url.slice(0, queryIndex);
  const params = new URLSearchParams(url.slice(queryIndex + 1));

  for (const param of PRISMA_ONLY_QUERY_PARAMS) {
    params.delete(param);
  }

  const rest = params.toString();
  return rest ? `${base}?${rest}` : base;
}

function inferDatabaseSsl(databaseUrl: string): boolean {
  if (/neon\.tech|neon\.database/.test(databaseUrl)) {
    return true;
  }

  return !/localhost|127\.0\.0\.1/.test(databaseUrl);
}

export function maskDatabaseUrl(url: string): string {
  try {
    const normalized = normalizeDatabaseUrl(url);
    const parsed = new URL(normalized.replace(/^postgresql:/, 'http:'));
    parsed.password = parsed.password ? '***' : '';
    parsed.username = parsed.username ? '***' : '';
    return parsed.toString().replace(/^http:/, 'postgresql:');
  } catch {
    return '(url inválida)';
  }
}

export function loadConfig(): Config {
  const databaseUrl = normalizeDatabaseUrl(requireEnv('DATABASE_URL'));
  const databaseSsl = parseBoolean('DATABASE_SSL', inferDatabaseSsl(databaseUrl));

  return {
    databaseUrl,
    databaseSsl,
    batchSize: parsePositiveInt('BATCH_SIZE', 50),
    httpPort: parsePositiveInt('PORT', 8080),
    workerApiKey: requireEnv('WORKER_API_KEY'),
    whatsappToken: requireEnv('WHATSAPP_TOKEN'),
    whatsappPhoneId: requireEnv('WHATSAPP_PHONE_ID'),
    whatsappAccountId: requireEnv('WHATSAPP_ACCOUNT_ID'),
    whatsappLanguageCode: process.env.WHATSAPP_LANGUAGE_CODE?.trim() || 'es_CO',
    whatsappV2ButtonIndex: parseNonNegativeIntText('WHATSAPP_V2_BUTTON_INDEX', '1'),
    whatsappV2ButtonParamName: process.env.WHATSAPP_V2_BUTTON_PARAM_NAME?.trim() || undefined,
  };
}
