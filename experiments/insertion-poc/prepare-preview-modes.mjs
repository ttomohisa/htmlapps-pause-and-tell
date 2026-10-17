import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
export async function preparePreviewModes(dist) {
  const normal=await readFile(join(dist,'index.html'));
  const path=join(dist,'insertion-poc/index.html');
  const poc=await readFile(path,'utf8');
  const marker='<span id="previewModeEntry"></span>';
  if(poc.split(marker).length!==2)throw new Error('Expected one preview entry marker');
  const modes=await readFile(join(here,'modes.html'),'utf8');
  await mkdir(join(dist,'modes'),{recursive:true});
  await writeFile(join(dist,'modes/index.html'),modes);
  // Only the nonproduction served copy gains a relative navigation link.
  // Standalone files (even when hosted elsewhere over HTTPS) keep no dead link.
  await writeFile(path,poc.replace(marker,'<a href="/modes/" target="_blank" rel="noopener noreferrer" data-ja="モードを選ぶ" data-en="Choose a mode">モードを選ぶ</a>'));
  if(!normal.equals(await readFile(join(dist,'index.html'))))throw new Error('Normal app changed');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(!process.argv[2])throw new Error('Provide the staged preview directory');
  await preparePreviewModes(resolve(process.argv[2]));
  console.log('Preview mode guide staged; normal app unchanged');
}
