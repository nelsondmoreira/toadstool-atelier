import { executeDeployment, parseDeploymentArgs, REPOSITORY } from './deployment-control.mjs';
import { createGithubPagesApi } from './github-pages-api.mjs';

try {
  const command = parseDeploymentArgs(process.argv.slice(2));
  if (command.action === 'help') {
    console.log(`Usage: npm run deploy -- <on|pause|off|status> [--fast] [--once]

on       Publish remote main and enable automatic deployments (tests by default).
         --fast skips the deployment test gate. --once leaves automation paused.
pause    Stop pending Pages runs and pause deployment; retain the current site.
off      Stop pending Pages runs, pause deployment and remove Pages configuration.
status   Inspect deployment controls, Pages configuration and the latest run.

Target: ${REPOSITORY}. No command commits or pushes local changes.`);
  } else {
    console.log(`${command.action === 'status' ? 'Inspecting' : 'Managing'} Pages for ${REPOSITORY}...`);
    const result = await executeDeployment(command, createGithubPagesApi());
    if (result.action === 'status') {
      console.log(`Automatic deployment: ${result.control.mode}`);
      console.log(`Pages configuration: ${result.pages ? result.pages.html_url : 'not found or not accessible'}`);
      console.log(`Workflow: ${result.workflow?.state ?? 'not configured'}`);
      console.log(`Latest run: ${result.latestRun ? `${result.latestRun.status} / ${result.latestRun.conclusion ?? 'pending'} ${result.latestRun.html_url}` : 'none'}`);
    } else if (result.queued) {
      console.log(`Deployment requested (${result.control.requestMode}); automatic mode: ${result.control.mode}.`);
      console.log(`This is not publication confirmation. Follow: https://github.com/${REPOSITORY}/actions/workflows/pages.yml`);
    } else if (result.action === 'off') {
      console.log('Pages runs stopped; Pages configuration removed. Cached/offline copies may remain accessible.');
    } else {
      console.log('Pages runs stopped and deployment paused. The existing site configuration was preserved.');
    }
  }
} catch (error) {
  console.error(error.message);
  console.error('No success is confirmed. Remote operations may be partially applied; inspect deploy status and retry pause/off if needed.');
  process.exitCode = 1;
}
