// Static configuration checks only; these do not run GitHub Actions or deploy a site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  .replaceAll('\r\n', '\n');
const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');

test('Pages delegates authorization to the tested policy and gates publication on its result', () => {
  assert.match(workflow, /import \{ decideDeployment \} from '\.\/scripts\/deployment-control\.mjs'/);
  assert.match(workflow, /if: needs\.plan\.outputs\.publish == 'true'/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
});

test('checked deployments gate both suites and the fast option does not weaken ordinary CI', () => {
  assert.match(workflow, /name: Run Node tests\s+if: needs\.plan\.outputs\.mode == 'checked'\s+run: npm test/);
  assert.match(workflow, /name: Run browser tests\s+if: needs\.plan\.outputs\.mode == 'checked'\s+run: npm run test:browser/);
  assert.match(ci, /name: Run tests\s+run: npm test/);
  assert.doesNotMatch(ci, /PAGES_DEPLOY_CONTROL/);
});

test('Pages builds once, uploads dist and does not implicitly enable the hosting service', () => {
  assert.equal([...workflow.matchAll(/run: npm run build\b/g)].length, 1);
  assert.match(workflow, /GITHUB_PAGES: 'true'/);
  assert.match(workflow, /path: dist/);
  assert.match(workflow, /enablement: false/);
  const build = workflow.indexOf('name: Build Pages artifact');
  const upload = workflow.indexOf('name: Upload the verified build');
  const stale = workflow.indexOf('name: Reject a superseded main revision');
  const publish = workflow.indexOf('name: Publish\n');
  assert.ok(build >= 0 && upload > build && stale > upload && publish > stale);
});
