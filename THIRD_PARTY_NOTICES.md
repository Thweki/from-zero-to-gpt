# Third-party notices

Application source and original course explanations: MIT, see LICENSE. External books and courses linked from lessons retain their own copyrights and licenses; linking does not relicense their content.

Runtime dependencies:

- React / React DOM: MIT, Meta Platforms, Inc. and affiliates.
- Vite: MIT, Vite contributors.
- Lucide: ISC, Lucide contributors (icons derived from Feather).
- idb: ISC, Jake Archibald.
- KaTeX: MIT, Khan Academy and contributors. Math fonts distributed by KaTeX retain their package notices.
- Pyodide 0.27.7: Mozilla Public License 2.0; includes CPython (Python Software Foundation license) and WebAssembly runtime components under their respective licenses. Source: https://github.com/pyodide/pyodide/tree/0.27.7 . No modifications are made to the runtime. The npm runtime files are copied verbatim by scripts/copy-python.mjs.

Full Pyodide MPL-2.0 and CPython 3.12.7 license texts are retained in `third_party/pyodide/` and copied to `public/python/` (and therefore `dist/python/`). React, React DOM, KaTeX, Lucide and idb license texts are copied verbatim from npm packages into `dist/licenses/`. Development dependency notices remain in their installed packages and upstream repositories. This file is a navigation aid, not a replacement for those license texts.
