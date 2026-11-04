# Known pitfalls of the PAC CLI and related tools

| Symptom | Cause / behaviour | What to do |
|---|---|---|
| `pac` installed with winget is a very old version (1.x) | the winget package is outdated | install/update with `dotnet tool update --global Microsoft.PowerApps.CLI.Tool` |
| `pac admin create` returns an error but the environment appears | client-side timeout, provisioning succeeded | **do not retry and do not delete**: check with `pac admin list` |
| Command ran against the wrong environment | without `--environment` PAC uses the active profile | always pass `--environment <url>`; the hook blocks an active PROD profile |
| `pac solution create` does not exist | the command is `pac solution init` (local project) | create the solution in Dataverse with the skill `dataverse:dv-solution` or the Web API |
| `pac test run` | Power Apps Test Engine is deprecated | use Playwright (`microsoft/power-platform-playwright-samples`) |
| `pac code push` | replaced by the `pa` CLI | `pa app push --solution-id <id>` |
| SPA site not updated after the first `upload-code-site` | the site must be reactivated after the first upload | skill `power-pages:activate-site` |
| Obsolete JS bundles stay on the site | `bundleFilePatterns` missing | configure them in `powerpages.config.json` |
| Changes to forms/views/sitemap not visible | components not published | publish selectively (`PublishXml`) only the changed components |
| Installing the `dataverse` plugin fails with "Host key verification failed" | the marketplace clones via SSH | run with `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_0=git@github.com:` |
