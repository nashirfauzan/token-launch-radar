import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, dataScript, parseSnapshot, validate } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';
const root=fileURLToPath(new URL('.',import.meta.url));
function arg(k:string,d:string){const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]||d:d;}
const input=arg('input','/input');const source=input.endsWith('.json')?input:join(input,'snapshot.json');
if(!existsSync(source)){process.stderr.write(`No snapshot at ${source}\n`);process.exit(2);}
const out=arg('output',process.env.MAKEFUN_OUTPUT_DIR||'/output');const snapshot=parseSnapshot(readFileSync(source,'utf8'));
if(!snapshot.as_of||!Array.isArray(snapshot.protocols)||!Array.isArray(snapshot.watchlist)||new Set(snapshot.protocols.map(p=>p.slug)).size!==snapshot.protocols.length)throw Error('Snapshot has missing metadata or duplicate protocol slugs');
const {rows,live,meta}=build(snapshot);validate(rows,snapshot);mkdirSync(out,{recursive:true});
writeFileSync(join(out,'board.json'),JSON.stringify({rows,meta},null,2)+'\n');writeFileSync(join(out,'data.js'),dataScript({rows,live,meta}));
function copyDir(from:string,to:string){if(!existsSync(from))return;mkdirSync(to,{recursive:true});for(const name of readdirSync(from)){const p=join(from,name);if(statSync(p).isFile())copyFileSync(p,join(to,name));}}
copyDir(join(root,'dashboard'),join(out,'dashboard'));copyDir(join(root,'screenshots'),join(out,'screenshots'));
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}}));
process.stdout.write(`Radar ${meta.model_version}: ${rows.length} pre-token rows (${meta.watchlist_size} watchlist, ${meta.early_size} early), ${live.length} live tokens; ${meta.peer_observation_count} screened token peers across ${meta.peer_categories} comparable groups.\n`);
