import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDeploymentArgs, parseControl, decideDeployment, executeDeployment, REPOSITORY,
} from '../../scripts/deployment-control.mjs';

const requestId = '12345678-1234-4123-8123-123456789abc';
const control = (mode = 'checked', requested = true) => ({
  version: 1, mode, requestId: requested ? requestId : null,
  requestMode: requested ? 'checked' : null,
});

function fixture(overrides = {}) {
  const calls = [];
  let savedControl = null;
  let pages = { html_url: 'https://example.invalid/', build_type: 'workflow' };
  const api = {
    authenticate: async () => calls.push('authenticate'),
    getRepository: async () => ({ full_name: REPOSITORY, default_branch: 'main', permissions: { admin: true } }),
    getControl: async () => savedControl,
    setControl: async value => { calls.push('setControl'); savedControl = value; },
    getPages: async () => pages,
    ensurePages: async () => calls.push('ensurePages'),
    deletePages: async () => { calls.push('deletePages'); pages = null; },
    getWorkflow: async () => ({ state: 'active' }),
    enableWorkflow: async () => calls.push('enableWorkflow'),
    disableWorkflow: async () => calls.push('disableWorkflow'),
    dispatch: async inputs => calls.push({ dispatch: inputs }),
    listRuns: async () => [],
    cancelRun: async id => calls.push({ cancel: id }),
    latestRun: async () => null,
    ...overrides,
  };
  return { api, calls, get savedControl() { return savedControl; } };
}

test('command defaults are checked and repeating or unknown options are rejected', () => {
  assert.deepEqual(parseDeploymentArgs(['on']), { action: 'on', fast: false, once: false });
  assert.deepEqual(parseDeploymentArgs(['on', '--once', '--fast']), { action: 'on', fast: true, once: true });
  assert.equal(parseDeploymentArgs([]).action, 'help');
  for (const args of [['publish'], ['pause', '--fast'], ['status', '--once'],
    ['off', '--fast'], ['on', '--fast', '--fast'], ['on', '--unknown']]) {
    assert.throws(() => parseDeploymentArgs(args));
  }
});

test('missing controls deny deployment; malformed controls fail closed', () => {
  assert.equal(parseControl('').mode, 'off');
  for (const value of ['invalid JSON', '{}', '{"version":1,"mode":"anything"}',
    JSON.stringify({ ...control(), requestId: 'invalid' }), JSON.stringify(control('off'))]) {
    assert.throws(() => parseControl(value));
  }
});

test('push deployment requires the approved repository, main and an enabled mode', () => {
  const event = { event: 'push', ref: 'refs/heads/main', repository: REPOSITORY };
  for (const mode of ['checked', 'fast']) {
    assert.deepEqual(decideDeployment({ ...event, control: control(mode) }), { publish: true, mode });
  }
  for (const change of [
    { control: '' }, { control: control('paused') },
    { control: control('off', false) }, { ref: 'refs/heads/other' },
    { repository: 'another/repository' }, { event: 'pull_request' },
  ]) {
    assert.equal(decideDeployment({ ...event, control: control(), ...change }).publish, false);
  }
});

test('manual one-shot authorization requires the matching identifier and verification mode', () => {
  const event = { event: 'workflow_dispatch', repository: REPOSITORY,
    ref: 'refs/heads/main', control: control('paused'), requestId, mode: 'checked' };
  assert.deepEqual(decideDeployment(event), { publish: true, mode: 'checked' });
  for (const change of [{ requestId: '' }, { requestId: 'stale' }, { mode: 'fast' },
    { control: control('paused', false) }, { control: control('off', false) }]) {
    assert.equal(decideDeployment({ ...event, ...change }).publish, false);
  }
});

test('status performs reads without changing deployment state', async () => {
  const f = fixture();
  const result = await executeDeployment(parseDeploymentArgs(['status']), f.api);
  assert.equal(result.control.mode, 'off');
  assert.ok(result.pages);
  assert.deepEqual(f.calls, ['authenticate']);
});

test('invalid options, wrong repository and insufficient permission never activate Pages', async () => {
  const invalid = fixture();
  await assert.rejects(executeDeployment({ action: 'off', fast: true }, invalid.api));
  assert.deepEqual(invalid.calls, []);
  for (const repository of [
    { full_name: 'another/repository', default_branch: 'main', permissions: { admin: true } },
    { full_name: REPOSITORY, default_branch: 'develop', permissions: { admin: true } },
    { full_name: REPOSITORY, default_branch: 'main', permissions: { admin: false } },
  ]) {
    const f = fixture({ getRepository: async () => repository });
    await assert.rejects(executeDeployment(parseDeploymentArgs(['on']), f.api));
    assert.deepEqual(f.calls, ['authenticate']);
  }
});

test('on configures Pages and dispatches checked remote-main publication in order', async () => {
  const f = fixture();
  const result = await executeDeployment(parseDeploymentArgs(['on']), f.api, { newId: () => requestId });
  assert.deepEqual(f.savedControl, control());
  assert.deepEqual(f.calls, ['authenticate', 'ensurePages', 'setControl', 'enableWorkflow',
    { dispatch: { mode: 'checked', request_id: requestId } }]);
  assert.equal(result.queued, true);
  assert.equal(result.published, undefined);
});

test('fast and once select explicit modes; a one-shot never enables automatic deployment', async () => {
  for (const flags of [['--once'], ['--fast'], ['--once', '--fast']]) {
    const f = fixture();
    await executeDeployment(parseDeploymentArgs(['on', ...flags]), f.api, { newId: () => requestId });
    assert.equal(f.savedControl.mode, flags.includes('--once') ? 'paused' : 'fast');
    assert.equal(f.savedControl.requestMode, flags.includes('--fast') ? 'fast' : 'checked');
  }
});

test('missing workflow or failed Pages setup prevents dispatch and control changes', async () => {
  for (const overrides of [
    { getWorkflow: async () => null },
    { ensurePages: async () => { throw Error('Pages unavailable'); } },
  ]) {
    const f = fixture(overrides);
    await assert.rejects(executeDeployment(parseDeploymentArgs(['on']), f.api, { newId: () => requestId }));
    assert.deepEqual(f.calls, ['authenticate']);
    assert.equal(f.savedControl, null);
  }
});

test('dispatch failure is surfaced rather than reported as successful publication', async () => {
  const f = fixture({ dispatch: async () => { throw Error('Workflow dispatch rejected'); } });
  await assert.rejects(
    executeDeployment(parseDeploymentArgs(['on']), f.api, { newId: () => requestId }),
    /dispatch rejected/,
  );
  // Earlier mutations are real partial state: the caller must not hide them.
  assert.equal(f.savedControl.mode, 'checked');
});

test('pause invalidates requests, disables Pages runs and retains the site', async () => {
  let active = true;
  const f = fixture({
    listRuns: async status => active && status === 'in_progress' ? [{ id: 42, status }] : [],
  });
  const result = await executeDeployment(parseDeploymentArgs(['pause']), f.api, {
    wait: async () => { active = false; },
  });
  assert.equal(result.control.mode, 'paused');
  assert.equal(f.savedControl.requestId, null);
  assert.deepEqual(f.calls, ['authenticate', 'setControl', 'disableWorkflow', { cancel: 42 }]);
  assert.ok(await f.api.getPages());
});

test('off waits for cancelled runs, then removes and verifies Pages configuration', async () => {
  let active = true;
  const f = fixture({
    listRuns: async status => active && status === 'waiting' ? [{ id: 7, status }] : [],
  });
  await executeDeployment(parseDeploymentArgs(['off']), f.api, { wait: async () => { active = false; } });
  assert.deepEqual(f.calls, ['authenticate', 'setControl', 'disableWorkflow', { cancel: 7 }, 'deletePages']);
  assert.equal(f.savedControl.mode, 'off');
  assert.equal(await f.api.getPages(), null);
});

test('cancellation timeout never claims unpublication or deletes before runs stop', async () => {
  const f = fixture({ listRuns: async status => status === 'queued' ? [{ id: 1, status }] : [] });
  await assert.rejects(
    executeDeployment(parseDeploymentArgs(['off']), f.api, { wait: async () => {} }),
    /have not stopped/,
  );
  assert.equal(f.savedControl.mode, 'off');
  assert.equal(f.calls.filter(call => call?.cancel === 1).length, 1);
  assert.equal(f.calls.includes('deletePages'), false);
});

test('off propagates cancellation/API failures and verifies removal instead of trusting DELETE', async () => {
  const failedCancel = fixture({
    listRuns: async status => status === 'queued' ? [{ id: 1, status }] : [],
    cancelRun: async () => { throw Error('Permission denied'); },
  });
  await assert.rejects(executeDeployment(parseDeploymentArgs(['off']), failedCancel.api), /Permission denied/);
  assert.equal(failedCancel.calls.includes('deletePages'), false);
  const failedDelete = fixture({ deletePages: async () => {} });
  await assert.rejects(executeDeployment(parseDeploymentArgs(['off']), failedDelete.api), /still exists/);
});

test('off also works before a deployment workflow has been registered', async () => {
  const f = fixture({ getWorkflow: async () => null });
  await executeDeployment(parseDeploymentArgs(['off']), f.api);
  assert.deepEqual(f.calls, ['authenticate', 'setControl', 'deletePages']);
});

test('run cancellation handles more than one page of queued runs', async () => {
  let active = true;
  const f = fixture({
    listRuns: async (status, page) => {
      if (!active || status !== 'queued') return [];
      return page === 1 ? Array.from({ length: 100 }, (_, id) => ({ id, status }))
        : page === 2 ? [{ id: 100, status }] : [];
    },
  });
  await executeDeployment(parseDeploymentArgs(['pause']), f.api, { wait: async () => { active = false; } });
  assert.equal(f.calls.filter(call => typeof call === 'object' && 'cancel' in call).length, 101);
});
