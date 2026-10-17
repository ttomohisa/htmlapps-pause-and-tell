// CI-only. Generated HTML contains third-party WASM and must not be published.
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const template=await readFile(resolve(root,'index.template.html'),'utf8');
const csp=template.match(/<meta http-equiv="Content-Security-Policy"[^>]+>/)[0];
const result=await build({entryPoints:[resolve(root,'probe-aac-csp.js')],bundle:true,platform:'browser',format:'iife',write:false,minify:true});
const code=result.outputFiles[0].text.replace(/<\/script/gi,String.raw`\x3c/script`);
const html=`<!doctype html><meta charset="utf-8">${csp}<title>CI-only AAC CSP check</title><script>${code}</script>`;
await writeFile(resolve(root,'dist/aac-csp-probe.html'),html);
console.log(JSON.stringify({aacCspProbeBytes:Buffer.byteLength(html),cspCopiedFromApp:true,distributeGeneratedHtml:false}));
