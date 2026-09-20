import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
await build({entryPoints:[fileURLToPath(new URL('./api-entry.js',import.meta.url))],outfile:fileURLToPath(new URL('./api-bundle.mjs',import.meta.url)),bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.png':'dataurl'},plugins:[{name:'emulator-only-firebase',setup(b){b.onResolve({filter:/^\.\/firebase$/},()=>({path:fileURLToPath(new URL('./firebase-stub.js',import.meta.url))}))}}]})
