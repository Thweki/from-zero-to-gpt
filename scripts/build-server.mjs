import {build} from 'esbuild';
await build({entryPoints:['server/worker.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',outfile:'dist-server/worker.js',minify:true});
await build({entryPoints:['server/tutor.ts'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:'dist-server/tutor.mjs',minify:true});
