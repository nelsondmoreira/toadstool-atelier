import { randomUUID } from 'node:crypto';

export const REPOSITORY = 'nelsondmoreira/toadstool-atelier';
export const WORKFLOW = 'pages.yml';
export const CONTROL_VARIABLE = 'PAGES_DEPLOY_CONTROL';

export function parseDeploymentArgs(args) {
  if (args.length === 0 || (args.length === 1 && ['--help', '-h'].includes(args[0]))) {
    return { action: 'help', fast: false, once: false };
  }

  const [action, ...flags] = args;
  if (!['on', 'pause', 'off', 'status'].includes(action)) {
    throw new Error(`Unknown deployment action: ${action}`);
  }
  if (new Set(flags).size !== flags.length) throw new Error('Duplicate deployment option');
  for (const flag of flags) {
    if (action !== 'on' || !['--fast', '--once'].includes(flag)) {
      throw new Error(`Unsupported option for ${action}: ${flag}`);
    }
  }
  return { action, fast: flags.includes('--fast'), once: flags.includes('--once') };
}

export function parseControl(value) {
  if (!value) return { version: 1, mode: 'off', requestId: null, requestMode: null };
  const control = typeof value === 'string' ? JSON.parse(value) : value;
  if (!control || control.version !== 1 ||
      !['checked', 'fast', 'paused', 'off'].includes(control.mode)) {
    throw new Error('Invalid Pages deployment control');
  }
  const hasRequest = typeof control.requestId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(control.requestId);
  if (hasRequest ? !['checked', 'fast'].includes(control.requestMode)
    : control.requestId !== null || control.requestMode !== null) {
    throw new Error('Invalid Pages deployment request');
  }
  if (control.mode === 'off' && hasRequest) throw new Error('An off site cannot authorize deployment');
  return { version: 1, mode: control.mode, requestId: control.requestId, requestMode: control.requestMode };
}

export function decideDeployment({ event, ref, repository, control: raw, requestId, mode }) {
  const control = parseControl(raw);
  const denied = { publish: false, mode: 'checked' };
  if (repository !== REPOSITORY || ref !== 'refs/heads/main') return denied;
  if (event === 'push' && ['checked', 'fast'].includes(control.mode)) {
    return { publish: true, mode: control.mode };
  }
  if (event === 'workflow_dispatch' && control.mode !== 'off' && requestId &&
      requestId === control.requestId && mode === control.requestMode) {
    return { publish: true, mode };
  }
  return denied;
}

async function activeRuns(api) {
  const result = new Map();
  for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
    for (let page = 1; ; page++) {
      const runs = await api.listRuns(status, page);
      for (const run of runs) {
        if (run.status !== 'completed') result.set(run.id, run);
      }
      if (runs.length < 100) break;
      if (page === 100) throw new Error('Too many Pages runs to cancel safely');
    }
  }
  return [...result.values()];
}

async function stopRuns(api, wait) {
  const cancelled = new Set();
  for (let attempt = 0; attempt < 20; attempt++) {
    const runs = await activeRuns(api);
    if (runs.length === 0) return;
    for (const run of runs) {
      if (!cancelled.has(run.id)) {
        await api.cancelRun(run.id);
        cancelled.add(run.id);
      }
    }
    await wait(1_000);
  }
  throw new Error('Pages runs have not stopped. Automatic deployment is disabled; retry the command.');
}

export async function executeDeployment(command, api, {
  newId = randomUUID,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  // Validate even when called directly rather than through the command-line entry.
  const args = [command.action];
  if (command.fast) args.push('--fast');
  if (command.once) args.push('--once');
  const { action, fast, once } = parseDeploymentArgs(args);
  await api.authenticate();
  const repository = await api.getRepository();
  if (repository.full_name !== REPOSITORY || repository.default_branch !== 'main') {
    throw new Error('Repository or default branch differs from the approved deployment target');
  }
  if (action !== 'status' && !repository.permissions?.admin) {
    throw new Error('Repository administration permission is required to manage this Pages setup');
  }

  if (action === 'status') {
    return {
      action,
      control: parseControl(await api.getControl()),
      pages: await api.getPages(),
      workflow: await api.getWorkflow(),
      latestRun: await api.latestRun(),
    };
  }

  if (action === 'on') {
    if (!await api.getWorkflow()) {
      throw new Error('Commit and push .github/workflows/pages.yml to remote main before activation');
    }
    const mode = fast ? 'fast' : 'checked';
    const control = parseControl({
      version: 1, mode: once ? 'paused' : mode, requestId: newId(), requestMode: mode,
    });
    await api.ensurePages();
    await api.setControl(control);
    await api.enableWorkflow();
    await api.dispatch({ mode, request_id: control.requestId });
    return { action, control, queued: true };
  }

  // Invalidate old manual requests before stopping the dedicated Pages workflow.
  const control = parseControl({
    version: 1, mode: action === 'off' ? 'off' : 'paused', requestId: null, requestMode: null,
  });
  await api.setControl(control);
  if (await api.getWorkflow()) {
    await api.disableWorkflow();
    await stopRuns(api, wait);
  }
  if (action === 'off') {
    await api.deletePages();
    if (await api.getPages()) {
      throw new Error('Pages configuration still exists; unpublishing is not confirmed. Retry off.');
    }
  }
  return { action, control };
}
