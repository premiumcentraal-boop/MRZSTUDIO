import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
await build({entryPoints:['src/lib/employee-id-model.ts'],outfile:'local-server/id-generator/model.cjs',bundle:true,platform:'node',format:'cjs',target:'node20'});
// Ship the pinned browser driver with the local package: clean installs need no npm/download.
const target=path.resolve('local-server/id-generator/runtime/playwright-core');
const safeParent=path.resolve('local-server/id-generator/runtime');
if(path.dirname(target)!==safeParent || (fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink()))throw Error('Unsafe renderer runtime folder.');
fs.rmSync(target,{recursive:true,force:true});
fs.cpSync(path.resolve('node_modules/playwright-core'),target,{recursive:true});
