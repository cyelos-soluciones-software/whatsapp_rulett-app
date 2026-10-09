import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { createBatchRunner } from '../src/batch-runner.js';

beforeEach(() => {
  mock.method(console, 'log', () => {});
});

afterEach(() => {
  mock.restoreAll();
});

describe('createBatchRunner', () => {
  it('devuelve lo procesado y libera el candado', async () => {
    const runner = createBatchRunner(async () => 4);

    assert.deepEqual(await runner.run(), { processed: 4, busy: false });
    assert.equal(runner.isRunning(), false);
  });

  it('con un lote en curso responde busy sin llamar otra vez al procesador', async () => {
    let release!: (value: number) => void;
    let calls = 0;
    const runner = createBatchRunner(() => {
      calls += 1;
      return new Promise<number>((resolve) => {
        release = resolve;
      });
    });

    const first = runner.run();
    assert.equal(runner.isRunning(), true);
    assert.deepEqual(await runner.run(), { processed: 0, busy: true });
    assert.equal(calls, 1);

    release(2);
    assert.deepEqual(await first, { processed: 2, busy: false });
  });

  it('si el lote lanza, propaga el error, no reintenta y libera el candado', async () => {
    let calls = 0;
    const runner = createBatchRunner(async () => {
      calls += 1;
      throw new Error('db caída');
    });

    await assert.rejects(runner.run(), /db caída/);
    assert.equal(calls, 1);
    assert.equal(runner.isRunning(), false);
  });
});
