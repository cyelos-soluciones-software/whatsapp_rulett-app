import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

type TriggerHandler = () => void;

function readBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization?.trim();
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim() || null;
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function startTriggerServer(options: {
  port: number;
  apiKey: string;
  onTrigger: TriggerHandler;
}): http.Server {
  const server = http.createServer((req, res) => {
    const url = req.url?.split('?')[0] ?? '';

    if (req.method === 'GET' && url === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && url === '/api/trigger') {
      const token = readBearerToken(req);
      if (!token || token !== options.apiKey) {
        sendJson(res, 401, { error: 'No autorizado.' });
        return;
      }

      options.onTrigger();
      sendJson(res, 200, { triggered: true });
      return;
    }

    sendJson(res, 404, { error: 'No encontrado.' });
  });

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
