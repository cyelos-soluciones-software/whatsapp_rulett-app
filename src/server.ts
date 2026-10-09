import { createHash, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { BatchOutcome } from './batch-runner.js';

type TriggerHandler = () => Promise<BatchOutcome>;

const EDGE_SECRET_HEADER = 'x-rulett-edge-secret';

function readBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization?.trim();
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim() || null;
}

function readEdgeSecret(req: IncomingMessage): string | null {
  const value = req.headers[EDGE_SECRET_HEADER];
  return typeof value === 'string' && value !== '' ? value : null;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/** Tiempo constante y sin revelar la longitud del secreto: compara digests de igual tamaño. */
export function secretsMatch(received: string | null, expected: string): boolean {
  const matches = timingSafeEqual(sha256(received ?? ''), sha256(expected));
  return matches && received !== null && expected !== '';
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function logError(message: string): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'error', message }));
}

async function handleTrigger(
  req: IncomingMessage,
  res: ServerResponse,
  options: { apiKey: string; edgeSecret: string; onTrigger: TriggerHandler },
): Promise<void> {
  if (!secretsMatch(readBearerToken(req), options.apiKey)) {
    sendJson(res, 401, { error: 'No autorizado.' });
    return;
  }

  if (options.edgeSecret === '') {
    sendJson(res, 503, { error: 'No configurado.' });
    return;
  }

  if (!secretsMatch(readEdgeSecret(req), options.edgeSecret)) {
    sendJson(res, 401, { error: 'No autorizado.' });
    return;
  }

  try {
    const outcome = await options.onTrigger();
    sendJson(
      res,
      200,
      outcome.busy
        ? { triggered: true, processed: 0, busy: true }
        : { triggered: true, processed: outcome.processed },
    );
  } catch {
    sendJson(res, 500, { error: 'Error al procesar.' });
  }
}

export function createTriggerServer(options: {
  apiKey: string;
  edgeSecret: string;
  onTrigger: TriggerHandler;
}): http.Server {
  return http.createServer((req, res) => {
    const url = req.url?.split('?')[0] ?? '';

    if (req.method === 'GET' && url === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && url === '/api/trigger') {
      handleTrigger(req, res, options).catch(() => {
        logError('Fallo inesperado al responder /api/trigger');
      });
      return;
    }

    sendJson(res, 404, { error: 'No encontrado.' });
  });
}

export function startTriggerServer(options: {
  port: number;
  apiKey: string;
  edgeSecret: string;
  onTrigger: TriggerHandler;
}): http.Server {
  const server = createTriggerServer(options);

  server.listen(options.port, () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        message: 'Servidor HTTP del worker iniciado',
        port: options.port,
      }),
    );
  });

  return server;
}
