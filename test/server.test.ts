import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { BatchOutcome } from '../src/batch-runner.js';
import { createTriggerServer, secretsMatch } from '../src/server.js';

const API_KEY = 'test-bearer-054';
const EDGE_SECRET = 'test-edge-054';

let server: http.Server | undefined;

async function start(options: {
  edgeSecret?: string;
  onTrigger?: () => Promise<BatchOutcome>;
}): Promise<{ baseUrl: string; calls: () => number }> {
  let calls = 0;
  const onTrigger = options.onTrigger ?? (async () => ({ processed: 1, busy: false }));
  server = createTriggerServer({
    apiKey: API_KEY,
    edgeSecret: options.edgeSecret ?? EDGE_SECRET,
    onTrigger: () => {
      calls += 1;
      return onTrigger();
    },
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, calls: () => calls };
}

function headers(bearer?: string, edge?: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (bearer !== undefined) h.Authorization = `Bearer ${bearer}`;
  if (edge !== undefined) h['X-Rulett-Edge-Secret'] = edge;
  return h;
}

beforeEach(() => {
  mock.method(console, 'log', () => {});
});

afterEach(async () => {
  mock.restoreAll();
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});

describe('secretsMatch', () => {
  it('acepta solo el valor exacto', () => {
    assert.equal(secretsMatch('abc', 'abc'), true);
    assert.equal(secretsMatch('abd', 'abc'), false);
    assert.equal(secretsMatch('abc ', 'abc'), false);
    assert.equal(secretsMatch('ab', 'abc'), false);
  });

  it('rechaza ausente y secreto esperado vacío', () => {
    assert.equal(secretsMatch(null, 'abc'), false);
    assert.equal(secretsMatch(null, ''), false);
    assert.equal(secretsMatch('', ''), false);
  });
});

describe('POST /api/trigger', () => {
  it('con los dos secretos espera el lote y después responde', async () => {
    let finished = false;
    const { baseUrl, calls } = await start({
      onTrigger: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        finished = true;
        return { processed: 3, busy: false };
      },
    });

    const res = await fetch(`${baseUrl}/api/trigger`, {
      method: 'POST',
      headers: headers(API_KEY, EDGE_SECRET),
    });

    assert.equal(finished, true);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { triggered: true, processed: 3 });
    assert.equal(calls(), 1);
  });

  it('GET también exige y acepta los dos secretos', async () => {
    const { baseUrl, calls } = await start({});

    const ok = await fetch(`${baseUrl}/api/trigger`, { headers: headers(API_KEY, EDGE_SECRET) });
    const noEdge = await fetch(`${baseUrl}/api/trigger`, { headers: headers(API_KEY) });

    assert.equal(ok.status, 200);
    assert.equal(noEdge.status, 401);
    assert.equal(calls(), 1);
  });

  it('con un lote en curso responde busy', async () => {
    const { baseUrl } = await start({ onTrigger: async () => ({ processed: 0, busy: true }) });

    const res = await fetch(`${baseUrl}/api/trigger`, {
      method: 'POST',
      headers: headers(API_KEY, EDGE_SECRET),
    });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { triggered: true, processed: 0, busy: true });
  });

  const rejected: Array<[string, Record<string, string>]> = [
    ['sin Bearer', headers(undefined, EDGE_SECRET)],
    ['Bearer mal', headers('otra-clave', EDGE_SECRET)],
    ['sin header de borde', headers(API_KEY)],
    ['header de borde mal', headers(API_KEY, 'otro-borde')],
    ['header de borde vacío', headers(API_KEY, '')],
    ['sin ningún secreto', headers()],
  ];

  for (const [name, h] of rejected) {
    it(`${name} → 401 y no procesa`, async () => {
      const { baseUrl, calls } = await start({});

      const res = await fetch(`${baseUrl}/api/trigger`, { method: 'POST', headers: h });

      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { error: 'No autorizado.' });
      assert.equal(calls(), 0);
    });
  }

  it('Authorization sin esquema Bearer → 401', async () => {
    const { baseUrl, calls } = await start({});

    const res = await fetch(`${baseUrl}/api/trigger`, {
      method: 'POST',
      headers: { Authorization: API_KEY, 'X-Rulett-Edge-Secret': EDGE_SECRET },
    });

    assert.equal(res.status, 401);
    assert.equal(calls(), 0);
  });

  it('secreto de borde vacío en el proceso + Bearer correcto → 503 y no procesa', async () => {
    const { baseUrl, calls } = await start({ edgeSecret: '' });

    const res = await fetch(`${baseUrl}/api/trigger`, {
      method: 'POST',
      headers: headers(API_KEY, EDGE_SECRET),
    });

    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'No configurado.' });
    assert.equal(calls(), 0);
  });

  it('secreto de borde vacío en el proceso + Bearer mal → 401, no revela la configuración', async () => {
    const { baseUrl, calls } = await start({ edgeSecret: '' });

    const res = await fetch(`${baseUrl}/api/trigger`, {
      method: 'POST',
      headers: headers('otra-clave', EDGE_SECRET),
    });

    assert.equal(res.status, 401);
    assert.equal(calls(), 0);
  });

  it('si el lote lanza → 500 genérico, una sola llamada', async () => {
    const { baseUrl, calls } = await start({
      onTrigger: async () => {
        throw new Error('detalle interno de la base');
      },
    });

    const res = await fetch(`${baseUrl}/api/trigger`, {
      method: 'POST',
      headers: headers(API_KEY, EDGE_SECRET),
    });

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.deepEqual(body, { error: 'Error al procesar.' });
    assert.equal(calls(), 1);
  });
});

describe('otras rutas', () => {
  it('GET /health responde 200 sin secretos', async () => {
    const { baseUrl, calls } = await start({});

    const res = await fetch(`${baseUrl}/health`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(calls(), 0);
  });

  it('ruta o método desconocido → 404', async () => {
    const { baseUrl, calls } = await start({});

    const unknown = await fetch(`${baseUrl}/otra`);
    const put = await fetch(`${baseUrl}/api/trigger`, {
      method: 'PUT',
      headers: headers(API_KEY, EDGE_SECRET),
    });

    assert.equal(unknown.status, 404);
    assert.equal(put.status, 404);
    assert.equal(calls(), 0);
  });
});
