# Third-party notices

Application source, original course explanations, and the three independent teaching projects: GPL-2.0-only, see LICENSE and each project's LICENSE. Copyright (c) 2026 From Zero to GPT contributors. Earlier commits retain their MIT notices; previously granted MIT rights are not revoked. This change does not relicense third-party works.

The original synthetic tiny-GPT corpus remains CC0-1.0, see projects/tiny-gpt/data/LICENSE.txt. External books, papers and courses linked from lessons retain their own copyrights and licenses; linking does not relicense their content. The micrograd teaching implementation was authored for this course and links to Karpathy's micrograd for further study.

Runtime dependencies:

- React / React DOM: MIT, Meta Platforms, Inc. and affiliates.
- Vite: MIT, Vite contributors.
- Lucide: ISC, Lucide contributors (icons derived from Feather).
- idb: ISC, Jake Archibald.
- KaTeX: MIT, Khan Academy and contributors. Math fonts distributed by KaTeX retain their package notices.
- react-markdown, remark-math, rehype-katex: MIT, unified / remark contributors. Markdown is rendered without raw HTML support or external images.
- Pyodide 0.27.7: Mozilla Public License 2.0; includes CPython (Python Software Foundation license) and WebAssembly runtime components under their respective licenses. Source: https://github.com/pyodide/pyodide/tree/0.27.7 . No modifications are made to the runtime. The npm runtime files are copied verbatim by scripts/copy-python.mjs.
- Inter, JetBrains Mono and Noto Sans SC: SIL Open Font License 1.1. Upstream copyright and full font license texts are retained in public/fonts/LICENSE-*.txt and distributed with the corresponding font assets. The fonts remain separately licensed assets.
- PyTorch: BSD-style license, with its own third-party notices, https://github.com/pytorch/pytorch/blob/main/LICENSE . This is an optional, separately installed local Python dependency; no PyTorch wheels or model weights are committed or included in the website's project ZIPs.

Full Pyodide MPL-2.0 and CPython 3.12.7 license texts are retained in `third_party/pyodide/` and copied to `public/python/` (and therefore `dist/python/`). Pyodide's corresponding source is available at the versioned source URL above, under its upstream licenses; it is not replaced by the application's GPL notice. React, React DOM, KaTeX, Lucide, idb and react-markdown license texts are copied verbatim from npm packages into `dist/licenses/`, along with the application's GPL text and this notice.

Development tools are installed separately from the lockfile and are not relicensed: TypeScript, Playwright, fake-indexeddb and some test-tool dependencies use Apache-2.0; caniuse-lite data uses CC-BY-4.0. Their notices remain in their installed packages and upstream repositories. They are build/test tools rather than application runtime dependencies. Runtime dependency versions and license identifiers are recorded in package-lock.json; preserve all applicable upstream notices when redistributing dependencies.

Application source and build instructions: https://github.com/Thweki/from-zero-to-gpt . For an Actions artifact, use the exact commitSha in its release-manifest.json to obtain the corresponding source, not an arbitrary later main revision. This file is a navigation aid, not a replacement for license texts or the source obligations of the applicable licenses.
