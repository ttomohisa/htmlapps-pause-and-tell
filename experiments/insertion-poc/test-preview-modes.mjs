import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preparePreviewModes} from './prepare-preview-modes.mjs';
const template=await readFile(new URL('./index.template.html',import.meta.url),'utf8');
assert.match(template,/<span id="previewModeEntry"><\/span>/);
assert.doesNotMatch(template,/href="\/modes\/"/);
const dir=await mkdtemp(join(tmpdir(),'pause-modes-'));
try {
  await writeFile(join(dir,'index.html'),'unchanged normal app');
  await mkdir(join(dir,'insertion-poc'));
  await writeFile(join(dir,'insertion-poc/index.html'),'<span id="previewModeEntry"></span>');
  await preparePreviewModes(dir);
  assert.equal(await readFile(join(dir,'index.html'),'utf8'),'unchanged normal app');
  const modes=await readFile(join(dir,'modes/index.html'),'utf8');
  assert.match(modes,/noindex,nofollow/);
  assert.match(modes,/href="\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(modes,/href="\/insertion-poc\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(modes,/30 seconds/);
  assert.match(modes,/30秒/);
  assert.match(modes,/v0\.9\.3/);
  const poc=await readFile(join(dir,'insertion-poc/index.html'),'utf8');
  assert.match(poc,/href="\/modes\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(poc,/data-ja="モードを選ぶ"/);
  assert.match(poc,/data-en="Choose a mode"/);
  // Refuse a missing template marker before altering output.
  await writeFile(join(dir,'insertion-poc/index.html'),'unexpected page');
  await assert.rejects(preparePreviewModes(dir),/marker/);
  assert.equal(await readFile(join(dir,'index.html'),'utf8'),'unchanged normal app');
  console.log('PASS preview-only mode links, bilingual limits, normal bytes and marker guard');
}finally{await rm(dir,{recursive:true,force:true});}
