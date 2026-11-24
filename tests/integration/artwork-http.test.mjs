import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { webcrypto } from 'node:crypto';
import { createVaultUploadPipeline } from '../../frontend/cloud/vault-upload-pipeline.mjs';
import { encryptedArtworkRepository } from '../../frontend/cloud/encrypted-artwork-store.mjs';
import { createArtworkHttpTransport } from '../../frontend/cloud/artwork-http-transport.mjs';

if (!globalThis.crypto)
  globalThis.crypto = webcrypto;

const password = 'correct horse battery staple';

function localStores() {
  const encrypted = new Map(), pending = new Map();
  const adapter = {
    get: async (k) => encrypted.get(k),
    put: async (r) => encrypted.set(r.key, r),
    delete: async (k) => encrypted.delete(k),
    list: async (owner) => [...encrypted.values()].filter(r => r.owner === owner)
  };
  const queue = {
    put: async (r) => pending.set(`${r.owner}:${r.id}`, structuredClone(r)),
    list: async (owner) => [...pending.values()].filter(r => r.owner === owner),
    remove: async (owner, id) => pending.delete(`${owner}:${id}`)
  };
  return {
    encrypted,
    pending,
    vault: encryptedArtworkRepository(adapter),
    queue
  };
}

async function server() {
  const uploads = new Map(), metadata = new Map(), calls = [];
  let rejectMetadata = false;
  const app = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req)
      chunks.push(c);
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString());
    }
    catch {
      res.writeHead(400).end();
      return;
    }
    const owner = req.headers.authorization?.replace(/^Bearer /, '');
    calls.push({
      route: req.url,
      owner,
      body
    });
    const reply = (status, data = {}) => {
      res.writeHead(status, {
        'content-type': 'application/json'
      }).end(JSON.stringify(data));
    };
    if (!owner || owner !== body.owner) {
      reply(403);
      return;
    }
    if (!body.path?.startsWith(`${owner}/`) || !/^[-\w]{1,128}$/.test(body.id)) {
      reply(400);
      return;
    }
    if (req.url === '/artwork/upload') {
      if (!Array.isArray(body.bytes) || body.bytes.length === 0 || body.bytes.length > 30 * 1024 * 1024 || body.bytes.some(x => !Number.isInteger(x) || x < 0 || x > 255)) {
        reply(400);
        return;
      }
      const existing = uploads.get(body.path), payload = Buffer.from(body.bytes);
      if (existing && !existing.equals(payload)) {
        reply(409);
        return;
      }
      uploads.set(body.path, payload);
      reply(200, {
        stored: true
      });
      return;
    }
    if (req.url === '/artwork/delete') {
      uploads.delete(body.path);
      metadata.delete(`${owner}:${body.id}`);
      reply(200, {
        deleted: true
      });
      return;
    }
    if (req.url === '/artwork/metadata') {
      if (rejectMetadata) {
        reply(503);
        return;
      }
      if (!uploads.has(body.path)) {
        reply(409);
        return;
      }
      const key = `${owner}:${body.id}`, previous = metadata.get(key);
      if (previous && JSON.stringify(previous) !== JSON.stringify(body)) {
        reply(409);
        return;
      }
      metadata.set(key, body);
      reply(200, {
        confirmed: true
      });
      return;
    }
    reply(404);
  });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return {
    app,
    url: `http://127.0.0.1:${app.address().port}`,
    uploads,
    metadata,
    calls,
    setRejectMetadata: v => rejectMetadata = v,
    close: () => new Promise(r => app.close(r))
  };
}

const art = (owner, id) => ({
  owner,
  id,
  kind: 'inspiration',
  mime: 'image/png',
  bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
  passphrase: password
});

test('real HTTP: encrypted local enqueue -> authenticated upload -> metadata -> queue acknowledgement', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const local = localStores();
  const transport = createArtworkHttpTransport({
    baseUrl: api.url,
    token: async () => 'alice'
  });
  const pipeline = createVaultUploadPipeline({
    ...local,
    upload: transport.upload,
    metadata: transport.metadata
  });
  await pipeline.enqueue(art('alice', 'drawing1'));
  const encrypted = local.encrypted.get('alice:drawing1');
  assert.ok(encrypted.ciphertext);
  assert.equal('bytes' in encrypted, false);
  assert.equal(api.calls.length, 0, 'enqueue must work without network');
  const result = await pipeline.flush('alice', password);
  assert.deepEqual(result.uploaded, ['drawing1']);
  assert.equal(local.pending.size, 0);
  assert.deepEqual([...api.uploads.values()][0], Buffer.from(art('alice', 'drawing1').bytes));
  assert.equal(api.metadata.size, 1);
  assert.deepEqual(api.calls.map(x => x.route), ['/artwork/upload', '/artwork/metadata']);
});

test('real HTTP: metadata 503 leaves encrypted job pending; retry publishes once', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const local = localStores();
  const transport = createArtworkHttpTransport({
    baseUrl: api.url,
    token: async () => 'alice'
  });
  const pipeline = createVaultUploadPipeline({
    ...local,
    upload: transport.upload,
    metadata: transport.metadata
  });
  await pipeline.enqueue(art('alice', 'retry1'));
  api.setRejectMetadata(true);
  assert.equal((await pipeline.flush('alice', password)).failed.length, 1);
  assert.equal(local.pending.size, 1);
  assert.equal(api.uploads.size, 1);
  assert.equal(api.metadata.size, 0);
  api.setRejectMetadata(false);
  assert.deepEqual((await pipeline.flush('alice', password)).uploaded, ['retry1']);
  assert.equal(local.pending.size, 0);
  assert.equal(api.uploads.size, 1);
  assert.equal(api.metadata.size, 1);
});

test('real HTTP: wrong-account credentials cannot publish or acknowledge a private upload', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const local = localStores();
  const transport = createArtworkHttpTransport({
    baseUrl: api.url,
    token: async () => 'bob'
  });
  const pipeline = createVaultUploadPipeline({
    ...local,
    upload: transport.upload,
    metadata: transport.metadata
  });
  await pipeline.enqueue(art('alice', 'private1'));
  const result = await pipeline.flush('alice', password);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].error, /403/);
  assert.equal(local.pending.size, 1);
  assert.equal(api.uploads.size, 0);
  assert.equal(api.metadata.size, 0);
});

test('real HTTP: missing credentials never send a request', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const local = localStores();
  const transport = createArtworkHttpTransport({
    baseUrl: api.url,
    token: async () => null
  });
  const pipeline = createVaultUploadPipeline({
    ...local,
    upload: transport.upload,
    metadata: transport.metadata
  });
  await pipeline.enqueue(art('alice', 'noauth'));
  assert.equal((await pipeline.flush('alice', password)).failed.length, 1);
  assert.equal(api.calls.length, 0);
  assert.equal(local.pending.size, 1);
});

test('real HTTP: wrong vault passphrase never transmits image bytes', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const local = localStores();
  const transport = createArtworkHttpTransport({
    baseUrl: api.url,
    token: async () => 'alice'
  });
  const pipeline = createVaultUploadPipeline({
    ...local,
    upload: transport.upload,
    metadata: transport.metadata
  });
  await pipeline.enqueue(art('alice', 'locked'));
  assert.equal((await pipeline.flush('alice', 'wrong password here')).failed.length, 1);
  assert.equal(api.calls.length, 0);
  assert.equal(local.pending.size, 1);
});

test('real HTTP: deletion after failed publication cleans orphaned remote bytes', async (t) => {
  const api = await server();
  t.after(() => api.close());
  const local = localStores();
  let deleted = false;
  const transport = createArtworkHttpTransport({
    baseUrl: api.url,
    token: async () => 'alice'
  });
  const pipeline = createVaultUploadPipeline({
    ...local,
    ...transport,
    deleted: async () => deleted
  });
  await pipeline.enqueue(art('alice', 'remove1'));
  api.setRejectMetadata(true);
  assert.equal((await pipeline.flush('alice', password)).failed.length, 1);
  assert.equal(api.uploads.size, 1);
  assert.equal(local.pending.size, 1);
  deleted = true;
  const retry = await pipeline.flush('alice', password);
  assert.deepEqual(retry.skipped, ['remove1']);
  assert.equal(api.uploads.size, 0);
  assert.equal(api.metadata.size, 0);
  assert.equal(local.pending.size, 0);
  assert.ok(api.calls.some(x => x.route === '/artwork/delete'));
});
