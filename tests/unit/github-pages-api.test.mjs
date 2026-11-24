import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithubPagesApi, decodeApiResponse } from '../../scripts/github-pages-api.mjs';
import { CONTROL_VARIABLE, REPOSITORY } from '../../scripts/deployment-control.mjs';

function response(status, data = null, newline = '\n') {
  return `HTTP/2.0 ${status} Result${newline}content-type: application/json${newline}${newline}${data === null ? '' : JSON.stringify(data)}`;
}

test('decodes JSON, empty success and redirected HTTP responses', () => {
  assert.deepEqual(decodeApiResponse(response(200, { mode: 'checked' }, '\r\n')),
    { status: 200, data: { mode: 'checked' } });
  assert.deepEqual(decodeApiResponse(response(204)), { status: 204, data: null });
  assert.deepEqual(decodeApiResponse(response(301) + '\n' + response(200, { id: 1 })),
    { status: 200, data: { id: 1 } });
  for (const body of ['not an HTTP response', 'HTTP/2.0 200 OK\n', response(200) + 'invalid JSON']) {
    assert.throws(() => decodeApiResponse(body));
  }
});

test('API transport fixes the host/repository and sends JSON through stdin without a shell', () => {
  let invocation;
  const api = createGithubPagesApi((binary, args, options) => {
    invocation = { binary, args, options };
    return { status: 0, stdout: response(204) };
  });
  api.dispatch({ mode: 'checked', request_id: 'request' });
  assert.equal(invocation.binary, 'gh');
  assert.ok(invocation.args.includes('github.com'));
  assert.ok(invocation.args.includes(`repos/${REPOSITORY}/actions/workflows/pages.yml/dispatches`));
  assert.deepEqual(JSON.parse(invocation.options.input),
    { ref: 'main', inputs: { mode: 'checked', request_id: 'request' } });
  assert.equal(invocation.options.shell, undefined);
});

test('missing controls use safe defaults while permission errors are not treated as missing', () => {
  const missing = createGithubPagesApi(() => ({ status: 1, stdout: response(404, { message: 'Not Found' }) }));
  assert.equal(missing.getControl(), null);
  const denied = createGithubPagesApi(() => ({ status: 1, stdout: response(403, { message: 'Forbidden' }) }));
  assert.throws(() => denied.getControl(), /HTTP 403/);
  assert.throws(() => denied.getPages(), /HTTP 403/);
});

test('control updates choose POST for absent variables and PATCH for existing variables', () => {
  for (const exists of [false, true]) {
    const calls = [];
    const api = createGithubPagesApi((_binary, args, options) => {
      calls.push({ args, input: options.input });
      return calls.length === 1
        ? { status: exists ? 0 : 1, stdout: response(exists ? 200 : 404, exists ? { value: '{}' } : { message: 'Not Found' }) }
        : { status: 0, stdout: response(204) };
    });
    api.setControl({ version: 1, mode: 'off', requestId: null, requestMode: null });
    assert.ok(calls[1].args.includes(exists ? 'PATCH' : 'POST'));
    const body = JSON.parse(calls[1].input);
    assert.equal(body.name, CONTROL_VARIABLE);
    assert.equal(JSON.parse(body.value).mode, 'off');
  }
});

test('Pages setup creates or updates workflow-based hosting only when needed', () => {
  for (const initial of [null, { build_type: 'legacy' }, { build_type: 'workflow' }]) {
    const methods = [];
    const api = createGithubPagesApi((_binary, args, options) => {
      const method = args[args.indexOf('--method') + 1];
      methods.push(method);
      if (method === 'GET') return { status: initial ? 0 : 1,
        stdout: response(initial ? 200 : 404, initial ?? { message: 'Not Found' }) };
      assert.deepEqual(JSON.parse(options.input), { build_type: 'workflow' });
      return { status: 0, stdout: response(204) };
    });
    api.ensurePages();
    assert.deepEqual(methods, initial?.build_type === 'workflow' ? ['GET']
      : initial ? ['GET', 'PUT'] : ['GET', 'POST']);
  }
});

test('missing CLI and failed login produce actionable failures without exposing auth output', () => {
  const missing = createGithubPagesApi(() => ({ error: new Error('spawn gh ENOENT') }));
  assert.throws(() => missing.authenticate(), /Cannot run GitHub CLI/);
  const failed = createGithubPagesApi(() => ({ status: 1, stdout: 'private auth output' }));
  assert.throws(() => failed.authenticate(), error =>
    error.message.includes('gh auth login') && !error.message.includes('private auth output'));
});

test('an existing custom domain is preserved and requires an explicit configuration decision', () => {
  const methods = [];
  const api = createGithubPagesApi((_binary, args) => {
    methods.push(args[args.indexOf('--method') + 1]);
    return { status: 0, stdout: response(200, { build_type: 'legacy', cname: 'example.invalid' }) };
  });
  assert.throws(() => api.ensurePages(), /custom domain/);
  assert.deepEqual(methods, ['GET']);
});
