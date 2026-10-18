import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const base = dirname(fileURLToPath(import.meta.url));
const js = await build({
  entryPoints: [resolve(base, 'insertion-poc.js')],
  bundle: true, platform: 'browser', format: 'iife', target: ['es2022'],
  write: false, minify: true, logLevel: 'warning'
});
const source = await readFile(resolve(base,'index.template.html'),'utf8');
const marker = '/*__INSERTION_POC_BUNDLE__*/';
if (!source.includes(marker)) throw new Error('HTML bundle marker missing');
const code = js.outputFiles[0].text.replace(/<\/script/gi, String.raw`\x3c/script`);
const license = await readFile(resolve(base,'licenses/mediabunny-MPL-2.0.txt'),'utf8');
const escapedLicense = license.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const icon = await readFile(resolve(base, '../../assets/favicon.svg'));
const iconDataUri = 'data:image/svg+xml;base64,' + icon.toString('base64');
const output = source.replace(marker, () => code).replace('__MEDIABUNNY_LICENSE__', () => escapedLicense).replaceAll('__APP_ICON_DATA_URI__', iconDataUri);
// The document must preserve the complete inline bundle. HTML terminates a
// script at a literal </script> even if it appears inside a JS string.
const start = output.indexOf('<script>') + '<script>'.length;
const end = output.lastIndexOf('</script>');
const embedded = output.slice(start, end);
if (embedded.length !== code.length) {
  console.error('Inline script size mismatch:', {
    embedded: embedded.length, bundle: code.length, start, end,
    firstDiff: [...embedded].findIndex((c,i)=>code[i]!==c),
    scriptTags: (output.match(/<script>/g)||[]).length,
    scriptClosers: (output.match(/<\/script>/g)||[]).length,
    beginning: output.slice(start-90,start+70), trailing: output.slice(end-70,end+30)
  });
  throw new Error('Embedded script was truncated');
}
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
console.log('Insertion editor built:', Buffer.byteLength(output), 'bytes');
