import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSearchController } from '../src/lib/search.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const item = (title) => ({ url: `/posts/${title}/`, excerpt: title, meta: { title } });
const result = (title) => ({ data: async () => item(title) });

describe('search controller', () => {
  it('retries a failed index load and recovers without reloading the page', async () => {
    const states = [];
    const errors = [];
    let loads = 0;
    const controller = createSearchController({
      loadApi: async () => {
        if (++loads === 1) throw new Error('offline');
        return { search: async () => ({ results: [result('recovered')] }) };
      },
      onState: (state) => states.push(state),
      onError: (error) => errors.push(error),
    });

    await controller.run(' first ');
    assert.equal(states.at(-1).phase, 'error');
    assert.equal(states.at(-1).query, 'first');
    await controller.run('first');
    assert.equal(loads, 2);
    assert.equal(errors.length, 1);
    assert.equal(states.at(-1).phase, 'ready');
    assert.deepEqual(states.at(-1).items, [item('recovered')]);
  });

  it('shares index loading and ignores a late load failure after the query is cleared', async () => {
    const pending = deferred();
    const states = [];
    const errors = [];
    let loads = 0;
    const controller = createSearchController({
      loadApi: () => {
        loads += 1;
        return pending.promise;
      },
      onState: (state) => states.push(state),
      onError: (error) => errors.push(error),
    });

    const first = controller.run('first');
    const second = controller.run('second');
    await tick();
    assert.equal(loads, 1);
    await controller.run('   ');
    const idle = states.at(-1);
    pending.reject(new Error('late network failure'));
    await Promise.all([first, second]);

    assert.deepEqual(idle, { phase: 'idle', query: '', items: [], total: 0 });
    assert.equal(states.at(-1), idle);
    assert.deepEqual(errors, []);
  });

  it('keeps the newest result when earlier searches resolve out of order', async () => {
    const first = deferred();
    const second = deferred();
    const states = [];
    const controller = createSearchController({
      loadApi: async () => ({
        search: (term) => (term === 'first' ? first.promise : second.promise),
      }),
      onState: (state) => states.push(state),
    });

    const oldSearch = controller.run('first');
    await tick();
    const newSearch = controller.run('second');
    await tick();
    second.resolve({ results: [result('second')] });
    await newSearch;
    const latest = states.at(-1);
    first.resolve({ results: [result('first')] });
    await oldSearch;

    assert.equal(states.at(-1), latest);
    assert.equal(latest.query, 'second');
    assert.deepEqual(latest.items, [item('second')]);
  });

  it('invalidates pending result data as soon as input changes, before the next search starts', async () => {
    const pending = deferred();
    const states = [];
    const controller = createSearchController({
      loadApi: async () => ({
        search: async () => ({ results: [{ data: () => pending.promise }] }),
      }),
      onState: (state) => states.push(state),
    });

    const oldSearch = controller.run('old');
    await tick();
    controller.cancel();
    const before = states.length;
    pending.resolve(item('old'));
    await oldSearch;
    assert.equal(states.length, before);
    assert.equal(states.some((state) => state.phase === 'ready'), false);
  });

  it('handles search and result-data failures and reuses the loaded index for retries', async () => {
    const states = [];
    let loads = 0;
    let searches = 0;
    const controller = createSearchController({
      loadApi: async () => {
        loads += 1;
        return {
          search: async () => {
            searches += 1;
            if (searches === 1) throw new Error('search failed');
            if (searches === 2) {
              return { results: [{ data: async () => { throw new Error('fragment failed'); } }] };
            }
            return { results: [] };
          },
        };
      },
      onState: (state) => states.push(state),
    });

    await controller.run('retry');
    assert.equal(states.at(-1).phase, 'error');
    await controller.run('retry');
    assert.equal(states.at(-1).phase, 'error');
    await controller.run('retry');
    assert.deepEqual(states.at(-1), { phase: 'ready', query: 'retry', items: [], total: 0 });
    assert.equal(loads, 1);
  });

  it('loads only the displayed result data while retaining the total count', async () => {
    const loaded = [];
    const states = [];
    const controller = createSearchController({
      maxResults: 2,
      loadApi: async () => ({
        search: async () => ({
          results: ['one', 'two', 'three'].map((title) => ({
            data: async () => {
              loaded.push(title);
              return item(title);
            },
          })),
        }),
      }),
      onState: (state) => states.push(state),
    });

    await controller.run('example');
    assert.deepEqual(loaded, ['one', 'two']);
    assert.equal(states.at(-1).total, 3);
    assert.equal(states.at(-1).items.length, 2);
  });
});
