import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { BatchOutcome } from '../src/batch-runner.js';
import { createTriggerServer, secretsMatch } from '../src/server.js';

const API_KEY = 'test-bearer-054';

let server: http.Server | undefined;

async function start(
  onTrigger: () => Promise<BatchOutcome> = async () => ({ processed: 1, busy: false }),
): Promise<{ baseUrl: string; calls: () => number }> {
  let calls = 0;
  server = createTriggerServer({
    apiKey: API_KEY,
    onTrigger: () => {
      calls += 1;
      return onTrigger();
    },
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, calls: () => calls };
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
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

describe('/api/trigger', () => {
  it('POST con el Bearer espera el lote y después responde', async () => {
    let finished = false;
    const { baseUrl, calls } = await start(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      finished = true;
      return { processed: 3, busy: false };
    });

    const res = await fetch(`${baseUrl}/api/trigger`, { method: 'POST', headers: bearer(API_KEY) });

    assert.equal(finished, true);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { triggered: true, processed: 3 });
    assert.equal(calls(), 1);
  });

  it('GET con el Bearer también procesa', async () => {
    const { baseUrl, calls } = await start();

    const res = await fetch(`${baseUrl}/api/trigger`, { headers: bearer(API_KEY) });

    assert.equal(res.status, 200);
    assert.equal(calls(), 1);
  });

  it('no exige ni mira el header de borde ni el token de Google', async () => {
    const { baseUrl, calls } = await start();

    const res = await fetch(`${baseUrl}/api/trigger`, {
      method: 'POST',
      headers: {
        ...bearer(API_KEY),
        'X-Rulett-Edge-Secret': 'cualquier-cosa',
        'X-Serverless-Authorization': 'Bearer token-que-no-se-valida',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(calls(), 1);
  });

  it('con un lote en curso responde busy', async () => {
    const { baseUrl } = await start(async () => ({ processed: 0, busy: true }));

    const res = await fetch(`${baseUrl}/api/trigger`, { method: 'POST', headers: bearer(API_KEY) });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { triggered: true, processed: 0, busy: true });
  });

  const rejected: Array<[string, Record<string, string>]> = [
    ['sin Bearer', {}],
    ['Bearer mal', bearer('otra-clave')],
    ['Authorization sin esquema Bearer', { Authorization: API_KEY }],
  ];

  for (const [name, headers] of rejected) {
    for (const method of ['POST', 'GET']) {
      it(`${method} ${name} → 401 y no procesa`, async () => {
        const { baseUrl, calls } = await start();

        const res = await fetch(`${baseUrl}/api/trigger`, { method, headers });

        assert.equal(res.status, 401);
        assert.deepEqual(await res.json(), { error: 'No autorizado.' });
        assert.equal(calls(), 0);
      });
    }
  }

  it('si el lote lanza → 500 genérico, una sola llamada', async () => {
    const { baseUrl, calls } = await start(async () => {
      throw new Error('detalle interno de la base');
    });

    const res = await fetch(`${baseUrl}/api/trigger`, { method: 'POST', headers: bearer(API_KEY) });

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: 'Error al procesar.' });
    assert.equal(calls(), 1);
  });
});

describe('otras rutas', () => {
  it('GET /health responde 200 sin secretos', async () => {
    const { baseUrl, calls } = await start();

    const res = await fetch(`${baseUrl}/health`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(calls(), 0);
  });

  it('ruta o método desconocido → 404', async () => {
    const { baseUrl, calls } = await start();

    const unknown = await fetch(`${baseUrl}/otra`);
    const put = await fetch(`${baseUrl}/api/trigger`, { method: 'PUT', headers: bearer(API_KEY) });

    assert.equal(unknown.status, 404);
    assert.equal(put.status, 404);
    assert.equal(calls(), 0);
  });
});
