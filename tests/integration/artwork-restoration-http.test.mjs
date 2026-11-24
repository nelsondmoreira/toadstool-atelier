import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { webcrypto } from 'node:crypto';
import { encryptedArtworkRepository } from '../../frontend/cloud/encrypted-artwork-store.mjs';
import { createArtworkRestorer, createArtworkRecoveryHttp } from '../../frontend/cloud/artwork-restoration.mjs';

if (!globalThis.crypto)
  globalThis.crypto = webcrypto;

const pass = 'very long offline passphrase';

const bytes = Uint8Array.from([137, 80, 78, 71, 1, 2, 3]);

function local() {
  const m = new Map();
  const repo = encryptedArtworkRepository({
    get: async (k) => m.get(k),
    put: async (r) => m.set(r.key, r),
    delete: async (k) => m.delete(k),
    list: async (owner) => [...m.values()].filter(x => x.owner === owner)
  });
  return {
    m,
    vault: {
      load: (o, id) => repo.load(o, id, pass),
      save: (o, id, mime, b) => repo.save(o, id, mime, b, pass)
    }
  };
}

async function server() {
  const records = new Map([['alice:a', {
        mime: 'image/png',
        bytes: [...bytes]
      }], ['bob:b', {
        mime: 'image/png',
        bytes: [5, 6, 7]
      }]]);
  let delay = null;
  const requests = [];
  const app = http.createServer(async (req, res) => {
    const body = JSON.parse(await (async () => {
      let s = '';
      for await (const c of req)
        s += c;
      return s;
    })());
    const auth = req.headers.authorization?.replace('Bearer ', '');
    requests.push({
      route: req.url,
      auth,
      body
    });
    const reply = (status, data = {}) => res.writeHead(status, {
      'content-type': 'application/json'
    }).end(JSON.stringify(data));
    if (!auth || auth !== body.owner)
      return reply(403);
    if (delay)
      await delay();
    if (req.url === '/artwork/list')
      return reply(200, {
        items: [...records.entries()].filter(([k]) => k.startsWith(auth + ':')).map(([k, v]) => ({
          id: k.split(':')[1],
          mime: v.mime
        }))
      });
    if (req.url === '/artwork/download') {
      const data = records.get(`${auth}:${body.id}`);
      return data ? reply(200, data) : reply(404);
    }
    return reply(404);
  });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return {
    url: `http://127.0.0.1:${app.address().port}`,
    records,
    requests,
    setDelay: f => delay = f,
    close: () => new Promise(r => app.close(r))
  };
}

test('HTTP restoration: authenticated list -> download -> AES-GCM encrypted local readback', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const l = local();
  const transport = createArtworkRecoveryHttp({
    baseUrl: api.url,
    token: async () => 'alice'
  });
  const r = createArtworkRestorer({
    vault: l.vault,
    remote: transport
  });
  r.session('alice');
  assert.deepEqual((await r.restore()).restored, ['a']);
  assert.deepEqual((await l.vault.load('alice', 'a')).bytes, bytes);
  assert.equal(l.m.get('alice:a').bytes, undefined);
  assert.deepEqual(api.requests.map(x => x.route), ['/artwork/list', '/artwork/download']);
});

test('HTTP restoration: existing local drawing never overwritten by cloud', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const l = local();
  await l.vault.save('alice', 'a', 'image/png', Uint8Array.from([9, 8, 7]));
  const r = createArtworkRestorer({
    vault: l.vault,
    remote: createArtworkRecoveryHttp({
      baseUrl: api.url,
      token: async () => 'alice'
    })
  });
  r.session('alice');
  assert.deepEqual((await r.restore()).skipped, ['a']);
  assert.deepEqual((await l.vault.load('alice', 'a')).bytes, Uint8Array.from([9, 8, 7]));
  assert.equal(api.requests.filter(x => x.route === '/artwork/download').length, 0);
});

test('HTTP restoration: other account token cannot read artwork', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const l = local();
  const r = createArtworkRestorer({
    vault: l.vault,
    remote: createArtworkRecoveryHttp({
      baseUrl: api.url,
      token: async () => 'bob'
    })
  });
  r.session('alice');
  await assert.rejects(r.restore(), /403/);
  assert.equal(l.m.size, 0);
});

test('HTTP restoration: missing image is reported and other images remain recoverable', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const l = local();
  const remote = createArtworkRecoveryHttp({
    baseUrl: api.url,
    token: async () => 'alice'
  });
  const r = createArtworkRestorer({
    vault: l.vault,
    remote: {
      list: async (o) => [{
          id: 'missing',
          mime: 'image/png'
        }, ...(await remote.list(o))],
      download: remote.download
    }
  });
  r.session('alice');
  const report = await r.restore();
  assert.deepEqual(report.restored, ['a']);
  assert.deepEqual(report.failed.map(x => x.id), ['missing']);
});

test('HTTP restoration: sign-out during download never commits to a different account', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const l = local();
  let started;
  const signal = new Promise(r => started = r);
  let resume;
  const hold = new Promise(r => resume = r);
  const remote = createArtworkRecoveryHttp({
    baseUrl: api.url,
    token: async () => 'alice'
  });
  const r = createArtworkRestorer({
    vault: l.vault,
    remote: {
      list: remote.list,
      download: async (...args) => {
        started();
        await hold;
        return remote.download(...args);
      }
    }
  });
  r.session('alice');
  const task = r.restore();
  await signal;
  r.session('bob');
  resume();
  await assert.rejects(task, /Account changed/);
  assert.equal(l.m.size, 0);
});

test('HTTP restoration: retries after network failure, never leaves plaintext in local records', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const l = local();
  let fail = true;
  const remote = createArtworkRecoveryHttp({
    baseUrl: api.url,
    token: async () => 'alice'
  });
  const r = createArtworkRestorer({
    vault: l.vault,
    remote: {
      list: remote.list,
      download: async (...args) => {
        if (fail)
          throw Error('Network down');
        return remote.download(...args);
      }
    }
  });
  r.session('alice');
  assert.equal((await r.restore()).failed.length, 1);
  fail = false;
  assert.deepEqual((await r.restore()).restored, ['a']);
  assert.equal(l.m.get('alice:a').bytes, undefined);
});
