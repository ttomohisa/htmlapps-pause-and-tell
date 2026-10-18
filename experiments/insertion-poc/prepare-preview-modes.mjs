import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
export async function preparePreviewModes(dist) {
  const normal=await readFile(join(dist,'index.html'),'utf8');
  if(!normal.includes('Insertion editor')||!normal.includes('id="exportFormat"'))throw new Error('Expected default insertion editor');
  await mkdir(join(dist,'insertion-poc'),{recursive:true});
  // Keep previously shared URLs usable; never substitute the legacy live recorder.
  await writeFile(join(dist,'insertion-poc/index.html'),normal);
  await mkdir(join(dist,'modes'),{recursive:true});
  await writeFile(join(dist,'modes/index.html'),await readFile(join(here,'modes.html')));
  if(normal!==await readFile(join(dist,'index.html'),'utf8'))throw new Error('Default app changed while staging aliases');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(!process.argv[2])throw new Error('Provide the staged preview directory');
  await preparePreviewModes(resolve(process.argv[2]));
  console.log('Default insertion and compatibility routes staged');
}
