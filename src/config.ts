import 'dotenv/config';

export interface Config {
  databaseUrl: string;
  databaseSsl: boolean;
  pollIntervalMs: number;
  batchSize: number;
  httpPort: number;
  workerApiKey: string;
  whatsappToken: string;
  whatsappPhoneId: string;
  whatsappAccountId: string;
  whatsappLanguageCode: string;
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

  const httpPortRaw = process.env.PORT?.trim();
  const httpPort = httpPortRaw ? Number.parseInt(httpPortRaw, 10) : 8080;
  if (!Number.isFinite(httpPort) || httpPort <= 0) {
    throw new Error(`PORT debe ser un entero positivo. Valor recibido: ${httpPortRaw}`);
  }

  return {
    databaseUrl,
    databaseSsl,
    pollIntervalMs: parsePositiveInt('POLL_INTERVAL_MS', 60_000),
    batchSize: parsePositiveInt('BATCH_SIZE', 50),
    httpPort,
    workerApiKey: requireEnv('WORKER_API_KEY'),
    whatsappToken: requireEnv('WHATSAPP_TOKEN'),
    whatsappPhoneId: requireEnv('WHATSAPP_PHONE_ID'),
    whatsappAccountId: requireEnv('WHATSAPP_ACCOUNT_ID'),
    whatsappLanguageCode: process.env.WHATSAPP_LANGUAGE_CODE?.trim() || 'es_CO',
  };
}
