import { spawnSync } from 'node:child_process';
import { CONTROL_VARIABLE, REPOSITORY, WORKFLOW } from './deployment-control.mjs';

export function decodeApiResponse(output) {
  const headers = [...output.matchAll(/^HTTP\/\S+\s+(\d{3})[^\r\n]*/gm)];
  const last = headers.at(-1);
  if (!last) throw new Error('GitHub CLI returned no HTTP response headers');
  const remainder = output.slice(last.index);
  const separator = /\r?\n\r?\n/.exec(remainder);
  if (!separator) throw new Error('GitHub CLI returned incomplete HTTP response headers');
  const body = remainder.slice(separator.index + separator[0].length).trim();
  return { status: Number(last[1]), data: body ? JSON.parse(body) : null };
}

export function createGithubPagesApi(run = spawnSync) {
  const base = `repos/${REPOSITORY}`;
  const workflow = `${base}/actions/workflows/${WORKFLOW}`;

  function invoke(args, input) {
    const result = run('gh', args, {
      encoding: 'utf8', input, timeout: 30_000, windowsHide: true,
      env: { ...process.env, GH_PROMPT_DISABLED: '1' },
    });
    if (result.error) throw new Error(`Cannot run GitHub CLI: ${result.error.message}`);
    return result;
  }

  function request(method, endpoint, body, allowed = []) {
    const args = ['api', '--hostname', 'github.com', '--include', '--method', method,
      '-H', 'Accept: application/vnd.github+json', endpoint];
    if (body !== undefined) args.push('--input', '-');
    const result = invoke(args, body === undefined ? undefined : JSON.stringify(body));
    const response = decodeApiResponse(result.stdout ?? '');
    if (allowed.includes(response.status)) return null;
    if (result.status !== 0 || response.status < 200 || response.status >= 300) {
      throw new Error(`GitHub ${method} ${endpoint}: HTTP ${response.status}: ${response.data?.message ?? 'request failed'}`);
    }
    return response.data;
  }

  return {
    authenticate() {
      const result = invoke(['auth', 'status', '--hostname', 'github.com']);
      if (result.status !== 0) throw new Error('Authenticate first with gh auth login --hostname github.com');
    },
    getRepository: () => request('GET', base),
    getControl: () => request('GET', `${base}/actions/variables/${CONTROL_VARIABLE}`, undefined, [404])?.value ?? null,
    setControl(control) {
      const existing = request('GET', `${base}/actions/variables/${CONTROL_VARIABLE}`, undefined, [404]);
      request(existing ? 'PATCH' : 'POST', existing
        ? `${base}/actions/variables/${CONTROL_VARIABLE}` : `${base}/actions/variables`,
      { name: CONTROL_VARIABLE, value: JSON.stringify(control) });
    },
    getPages: () => request('GET', `${base}/pages`, undefined, [404]),
    ensurePages() {
      const pages = request('GET', `${base}/pages`, undefined, [404]);
      if (pages?.cname) {
        throw new Error('An existing custom domain requires a separately approved asset-base configuration');
      }
      if (!pages) request('POST', `${base}/pages`, { build_type: 'workflow' });
      else if (pages.build_type !== 'workflow') {
        request('PUT', `${base}/pages`, { build_type: 'workflow' });
      }
    },
    deletePages: () => request('DELETE', `${base}/pages`, undefined, [404]),
    getWorkflow: () => request('GET', workflow, undefined, [404]),
    enableWorkflow: () => request('PUT', `${workflow}/enable`),
    disableWorkflow: () => request('PUT', `${workflow}/disable`),
    dispatch: inputs => request('POST', `${workflow}/dispatches`, { ref: 'main', inputs }),
    listRuns: (status, page) => request('GET', `${workflow}/runs?status=${status}&per_page=100&page=${page}`).workflow_runs,
    cancelRun: id => request('POST', `${base}/actions/runs/${id}/cancel`, undefined, [409, 422]),
    latestRun: () => request('GET', `${workflow}/runs?per_page=1`, undefined, [404])?.workflow_runs?.[0] ?? null,
  };
}
