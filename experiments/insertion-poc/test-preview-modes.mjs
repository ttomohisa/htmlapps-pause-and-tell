import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preparePreviewModes} from './prepare-preview-modes.mjs';
const dir=await mkdtemp(join(tmpdir(),'pause-entry-'));
try {
 const app='<button id="startNote"></button><select id="exportFormat"></select>';
 await writeFile(join(dir,'index.html'),app);
 await preparePreviewModes(dir);
 assert.equal(await readFile(join(dir,'index.html'),'utf8'),app);
 assert.equal(await readFile(join(dir,'insertion-poc/index.html'),'utf8'),app);
 const guide=await readFile(join(dir,'modes/index.html'),'utf8');
 assert.match(guide,/noindex,nofollow/);assert.match(guide,/Current entry/);
 for(const href of ['/','/insertion-poc/'])assert(guide.includes(`href="${href}" target="_blank" rel="noopener noreferrer"`));
 assert.match(guide,/30 seconds/);assert.match(guide,/30秒/);assert.doesNotMatch(guide,/v0\.9\.3/);
 await writeFile(join(dir,'index.html'),'legacy recorder');
 await assert.rejects(preparePreviewModes(dir),/default insertion/);
 console.log('PASS default insertion alias identity and stale-entry rejection');
}finally{await rm(dir,{recursive:true,force:true});}
