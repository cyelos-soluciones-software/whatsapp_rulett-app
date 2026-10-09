import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';

const LEAKED = 'postgresql://user:s3cr3t-pass@db.example.neon.tech/app?sslmode=require';

const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5440/rulett_db',
  WORKER_API_KEY: 'test-key',
  WHATSAPP_TOKEN: 'test-token',
  WHATSAPP_PHONE_ID: '123',
  WHATSAPP_ACCOUNT_ID: '456',
};

const KEYS = [...Object.keys(BASE_ENV), 'BATCH_SIZE', 'PORT', 'DATABASE_SSL', 'EDGE_SHARED_SECRET'];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, BASE_ENV);
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function errorMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  }
  assert.fail('se esperaba un error');
}

describe('loadConfig — errores sin el valor recibido', () => {
  for (const name of ['BATCH_SIZE', 'PORT']) {
    it(`${name} inválido nombra la variable y no imprime el valor`, () => {
      process.env[name] = LEAKED;

      const message = errorMessage(loadConfig);

      assert.match(message, new RegExp(`${name} debe ser un entero positivo`));
      assert.ok(!message.includes('s3cr3t-pass'));
      assert.ok(!message.includes('neon.tech'));
    });
  }

  it('DATABASE_SSL inválido nombra la variable y no imprime el valor', () => {
    process.env.DATABASE_SSL = LEAKED;

    const message = errorMessage(loadConfig);

    assert.match(message, /DATABASE_SSL debe ser true o false/);
    assert.ok(!message.includes('s3cr3t-pass'));
  });
});

describe('loadConfig — secreto de borde', () => {
  it('EDGE_SHARED_SECRET en el entorno se ignora', () => {
    process.env.EDGE_SHARED_SECRET = 'valor-viejo';

    const config = loadConfig();

    assert.ok(!('edgeSharedSecret' in config));
    assert.ok(!JSON.stringify(config).includes('valor-viejo'));
  });

  it('sin EDGE_SHARED_SECRET arranca igual', () => {
    const config = loadConfig();

    assert.equal(config.workerApiKey, 'test-key');
    assert.equal(config.httpPort, 8080);
    assert.equal(config.batchSize, 50);
  });
});
