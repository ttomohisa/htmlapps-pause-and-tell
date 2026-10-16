import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const base = dirname(new URL(import.meta.url).pathname);
const js = await build({
  entryPoints: [resolve(base, 'insertion-poc.js')],
  bundle: true, platform: 'browser', format: 'iife', target: ['es2022'],
  write: false, minify: true, logLevel: 'warning'
});
const source = await readFile(resolve(base,'index.template.html'),'utf8');
const marker = '/*__INSERTION_POC_BUNDLE__*/';
if (!source.includes(marker)) throw new Error('HTML bundle marker missing');
const code = js.outputFiles[0].text.replaceAll('</script','<\\/script');
const output = source.replace(marker, code);
const dir = resolve(base, 'dist');
await mkdir(dir, {recursive: true});
await writeFile(resolve(dir,'index.html'), output);
console.log('Insertion PoC built:', Buffer.byteLength(output), 'bytes');
