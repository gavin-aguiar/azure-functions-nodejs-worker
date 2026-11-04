# Azure Functions Node.js Worker

|Branch|Status|[Runtime Version](https://docs.microsoft.com/azure/azure-functions/functions-versions)|Support level|Node.js Versions|
|---|---|---|---|---|
|v3.x (default)|[![Build Status](https://img.shields.io/azure-devops/build/azfunc/public/527/v3.x)](https://azfunc.visualstudio.com/public/_build/latest?definitionId=527&branchName=v3.x) [![Test Status](https://img.shields.io/azure-devops/tests/azfunc/public/527/v3.x?compact_message)](https://azfunc.visualstudio.com/public/_build/latest?definitionId=527&branchName=v3.x)|4|GA|26, 24, 22|

> NOTE: The branch corresponds to the _worker_ version, which is intentionally decoupled from the _runtime_ version.

## Getting Started

- [Create your first Node.js function](https://docs.microsoft.com/azure/azure-functions/create-first-function-vs-code-node)
- [Node.js developer guide](https://docs.microsoft.com/azure/azure-functions/functions-reference-node)
- [Language Extensibility Wiki](https://github.com/Azure/azure-webjobs-sdk-script/wiki/Language-Extensibility)

## Contributing

- Clone the repository locally and open in VS Code
- Run "Extensions: Show Recommended Extensions" from the [command palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette) and install all extensions listed under "Workspace Recommendations"
- Run `npm install` and `npm run build`
- Create or open a local function app to test with
- In the local function app, add the following settings to your "local.settings.json" file or configure them directly as environment variables
  - `languageWorkers__node__workerDirectory`: `<path to the root of this repository>`
  - `languageWorkers__node__arguments`: `--inspect`
    > 💡 Tip #1: Set `logging__logLevel__Worker` to `debug` if you want to view worker-specific logs in the output of `func start`

    > 💡 Tip #2: If you need to debug worker initialization, use `--inspect-brk` instead of `--inspect`. Just keep in mind you need to attach the debugger within 30 seconds or the host process will timeout.
- Start the local function app (i.e. run `func start` or press <kbd>F5</kbd>)
- Back in the worker repository, press <kbd>F5</kbd> and select the process for your running function app
- Before you submit a PR, run `npm run lint` and `npm test` and fix any issues. If you want to debug the tests, switch your [launch profile](https://code.visualstudio.com/docs/editor/debugging) in VS Code to "Launch Unit Tests" and press <kbd>F5</kbd>.

## Standalone BYOC prototype (unofficial fork)

This fork can package its **locally compiled worker**, without downloading or extracting a Functions Host zip.
The `3.16.1-byoc.1` version is an unofficial prototype, not an official Microsoft worker release.
The existing version updater keeps `package.json`, the lockfile, `src/constants.ts`, and
`Worker.nuspec` aligned; the NuGet pipeline and packaging layout are otherwise unchanged.

```powershell
npm ci
npm run build
npm run webpack
npm run test:bundle
npm run package:byoc -- --source . --output ..\node-byoc-release
```

The helper requires an already built source directory and an output directory **outside** that source.
Use `node scripts/packageByoc.js --help` for CLI usage. It derives the version from `package.json`,
validates worker metadata, rejects symlinked paths, and includes only the six files staged by
`azure-pipelines/templates/build.yml`: `LICENSE`, `NOTICE.html`, `package.json`,
`worker.config.json`, `dist/src/nodejsWorker.js`, and `dist/src/worker-bundle.js`.
It adds `worker-manifest.json` at the archive root; there is no enclosing version directory.
Sources, tests, credentials, and `node_modules` are not copied.

Outputs are `azure-functions-nodejs-worker-<version>.tar.gz` and its `.sha256` sidecar
(SHA-256 hex digest followed by the archive basename). Tar ownership, modes (`0644`), timestamps,
entry order, and gzip metadata are normalized for repeatable packaging of identical inputs with
the same Node.js/zlib implementation.

The current webpack bundle contains JavaScript, uses Node.js built-ins, and supplies its own
`@azure/functions-core` module. It needs no external native addon or `node_modules` directory.
Accordingly the manifest uses `platform: "any"` and the filename has no OS, architecture, or Node ABI suffix.
This does **not** promise compatibility with every Node.js version: use the supported versions listed above
and validate the chosen Node.js/Functions Host combination. The archive does not contain Node.js or the Host.
Packaging does not modify worker startup or install/configure the archive in a Function App.

The `3.16.1-byoc.2` fix makes worker-indexed function metadata report `language: "node"`
for each registered function. This satisfies the Host's per-function language requirement
for linked-worker indexing, preventing rejection of metadata with a missing language.

## Repositories

These are the most important GitHub repositories that make up the Node.js experience on Azure Functions:

- [azure-functions-nodejs-library](https://github.com/Azure/azure-functions-nodejs-library): The `@azure/functions` [npm package](https://www.npmjs.com/package/@azure/functions) that you include in your app.
- [azure-functions-nodejs-worker](https://github.com/Azure/azure-functions-nodejs-worker): The other half of the Node.js experience that ships directly in Azure.
- [azure-functions-nodejs-e2e-tests](https://github.com/Azure/azure-functions-nodejs-e2e-tests): A set of automated end-to-end tests designed to run against prerelease versions of all Node.js components.
- [azure-functions-host](https://github.com/Azure/azure-functions-host): The runtime shared by all languages in Azure Functions.
- [azure-functions-core-tools](https://github.com/Azure/azure-functions-core-tools): The CLI used to test Azure Functions locally.

### Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

### Contributing to TypeScript type definitions

The type definitions supplied by the `@azure/functions` [npm package](https://www.npmjs.com/package/@azure/functions) are located in the `types` folder. Any changes should be applied directly to `./types/index.d.ts`. Please make sure to update the tests in `./types/index.test.ts` as well.
