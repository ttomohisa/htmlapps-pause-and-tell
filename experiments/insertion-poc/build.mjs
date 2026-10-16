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
const code = js.outputFiles[0].text.replace(/<\s*\/\s*script/gi, '<\/script');
const output = source.replace(marker, code);
// The document must preserve the complete inline bundle. HTML terminates a
// script at a literal </script> even if it appears inside a JS string.
const start = output.indexOf('<script>') + '<script>'.length;
const end = output.lastIndexOf('</script>');
const embedded = output.slice(start, end);
if (embedded.length !== code.length) throw new Error('Embedded script was truncated');
const { Script } = await import('node:vm');
try { new Script(embedded, { filename: 'insertion-poc-inline.js' }); }
catch (e) {
  const around = embedded.indexOf('&amp;');
  console.error('Embedded JavaScript parse failed; ampersand entity index:', around, 'first chars:', embedded.slice(0,120));
  throw e;
}
const dir = resolve(base, 'dist');
await mkdir(dir, {recursive: true});
await writeFile(resolve(dir,'index.html'), output);
console.log('Insertion PoC built:', Buffer.byteLength(output), 'bytes');
