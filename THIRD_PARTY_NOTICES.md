# Third-Party Notices

The current default Pause & Tell distribution embeds Mediabunny 1.61.5 as described below. The generic starter asset list in `dependencies.json` is empty; the actual runtime dependency is pinned in `experiments/insertion-poc/package.json` and `package-lock.json` and included in the generated build manifest.

Browser APIs and system fonts are used directly. The GitHub Actions workflows reference their respective GitHub-maintained actions under the terms published by those projects.

When adding a package to `dependencies.json`:

1. Add its name, exact version, license, and homepage to this file.
2. Sync and commit the corresponding `dependencies.lock.json` entry.
3. Include every copyright notice and license text required for redistribution.
4. Update both README files when the dependency materially affects privacy, size, or capability.
5. Commit the regenerated `dist/dependency-manifest.json` only if the repository policy chooses to track generated artifacts.

Do not assume that a package being available from npm makes it compatible with MIT redistribution.

## Normal insertion editor (v1.0.0)

`experiments/insertion-poc/` bundles **Mediabunny 1.61.5**, copyright (c) 2026-present, Vanilagy and contributors, licensed under the **Mozilla Public License 2.0**. The library source is not modified. Its source-file copyright/license notices are retained by the bundler. The full license is provided in `experiments/insertion-poc/licenses/mediabunny-MPL-2.0.txt`.

- Project and source: https://github.com/Vanilagy/mediabunny
- Exact distributed source package (includes `src/` and `LICENSE`): https://registry.npmjs.org/mediabunny/-/mediabunny-1.61.5.tgz
- Package: https://www.npmjs.com/package/mediabunny/v/1.61.5

The standalone application's minified library is executable form; its readable and self-extracting distributions embed this source/notice information and the full MPL license. Normal app code is not relicensed. Any future changes to covered library files must preserve the applicable MPL source obligations. Codec patents, optional encoder packages and their independent licenses need separate distribution review; native codec availability does not settle licensing. No additional encoder package is bundled by the AVC/AAC feasibility probe.

Build-time **esbuild 0.25.12** is MIT-licensed (https://github.com/evanw/esbuild); its executable is not embedded in the browser HTML.
