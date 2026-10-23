'use strict';
// CI-only native layout checks; synthetic inputs never request camera/microphone access.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const cfg={"slug": "pause-and-tell", "bp": 767, "short": 600, "landscape": false, "lang": "#language", "version": "#versionBadge", "value": "v1.0.0", "badge": ".local-badge > span", "meta": false, "head": "#helpDialog > .dialog-header", "close": "#closeHelpButton"};
const results=path.resolve(__dirname,'../test-results/mobile-layout');
async function bounds(locator,width,height,label){const r=await locator.boundingBox();assert.ok(r&&r.x>=0&&r.x+r.width<=width+1&&r.y>=0&&r.y+r.height<=height+1,label+': '+JSON.stringify(r));}
async function smoke(page,file){
 const encoded=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const c=canvas.getContext('2d');c.fillStyle='#16624f';c.fillRect(0,0,160,120);
  const audio=new AudioContext(),dest=audio.createMediaStreamDestination(),osc=audio.createOscillator();osc.frequency.value=440;osc.connect(dest);osc.start();await audio.resume();
  const stream=canvas.captureStream(10);stream.addTrack(dest.stream.getAudioTracks()[0]);const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'}),chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();await new Promise(resolve=>setTimeout(resolve,1000));recorder.stop();await stopped;osc.stop();stream.getTracks().forEach(t=>t.stop());await audio.close();return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});
 });
 await page.locator('#sourceFile').setInputFiles({name:'synthetic-video.webm',mimeType:'video/webm',buffer:Buffer.from(encoded.split(',')[1],'base64')});await page.locator('#editor').waitFor();await page.locator('#silentNote').check();await page.waitForFunction(()=>!document.querySelector('#startNote').disabled,null,{timeout:60000});
 await page.locator('#startNote').click();await page.locator('#finishNote').waitFor();await page.waitForTimeout(650);await page.locator('#finishNote').click();await page.waitForFunction(()=>document.querySelector('#noteList').children.length===1);
 await page.locator('#export').click();await page.locator('#result').waitFor({timeout:60000});assert.equal(await page.locator('#resultVideo').evaluate(el=>el.readyState>=2),true);await page.locator('#outputName').fill('mobile-layout-silent');
 const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending;assert.equal(download.suggestedFilename(),'mobile-layout-silent.webm');const target=path.join(results,file.includes('self-extract')?'synthetic-loader.webm':'synthetic-readable.webm');await download.saveAs(target);const bytes=fs.readFileSync(target);assert.ok(bytes.length>100);assert.equal(bytes.subarray(0,4).toString('hex'),'1a45dfa3');
 console.log('PASS real synthetic video + silent explanation + edited-name WebM export, no microphone '+file);
}
async function main(){
 fs.mkdirSync(results,{recursive:true});const browser=await chromium.launch();
 try{for(const file of ['dist/index.html','dist/index.self-extract.html',cfg.slug+'.html'])for(const language of ['ja','en'])for(const [width,height,coarse] of [[1360,900,false],[cfg.bp+1,568,false],[cfg.bp,568,false],[360,640,false],[320,568,false],[393,252,false],[900,430,true]]){
  const compact=width<=cfg.bp||(coarse&&height<=cfg.short&&(!cfg.landscape||width>height));
  const context=await browser.newContext({viewport:{width,height},locale:language,hasTouch:coarse,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  const label=`${file} ${language} ${width}x${height} coarse=${coarse}`;
  try{
   await page.goto(pathToFileURL(path.resolve(__dirname,'..',file)).href);await page.locator('#helpButton').waitFor();
   if(await page.locator('html').getAttribute('lang')!==language)await page.locator(cfg.lang).click();await page.locator(cfg.lang).click();await page.locator(cfg.lang).click();assert.equal(await page.locator('html').getAttribute('lang'),language,label+': repeated localization');
   assert.equal((await page.locator(cfg.version).textContent()).trim(),cfg.value,label+': existing header version');
   assert.equal((await page.locator(cfg.badge).textContent()).trim(),language==='ja'?'完全ローカル処理':'Fully local processing');
   if(await page.locator('.local-badge').isVisible())assert.ok(await page.locator('.local-badge').evaluate(el=>{const b=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el.querySelector('span'));return b.left>=0&&b.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1&&[...range.getClientRects()].every(r=>r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1);}),label+': rendered badge fits');
   assert.equal(await page.locator('body > footer').isVisible(),!compact,label+': existing footer visibility');
   if(cfg.meta){assert.equal(await page.locator('#helpVersion').count(),1);assert.equal(await page.locator('#helpVersion').textContent(),'Practice Mirror v1.0.2');assert.equal(await page.locator('main #helpVersion').count(),0);assert.doesNotMatch(await page.locator('footer').textContent(),/v1\.0\.2/);}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': page width');
   await page.locator('#helpButton').focus();await page.keyboard.press('Enter');const body=page.locator('#helpDialog > .dialog-body');
   if(cfg.meta){assert.ok(await body.evaluate(el=>el.lastElementChild.id==='helpVersion'),label+': metadata final in actual scroll body');assert.equal(await page.locator('#helpVersion').isVisible(),!compact,label+': original metadata hiding');}
   // Pause's existing license disclosure uses the pointer route; no dismissal behavior is changed by this wording-only fix.
   if(!cfg.meta){await page.locator('.pt-license > summary').click();assert.equal(await page.locator('.pt-license').getAttribute('open'),'');assert.equal(await page.locator('#helpDialog').isVisible(),true);}
   await body.evaluate(el=>{el.scrollTop=el.scrollHeight;});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const finalSelector=cfg.meta?(compact?'#helpDialog [data-lang-block="'+language+'"] > p:last-child':'#helpVersion'):'.pt-license pre';
   const tail=await page.locator(finalSelector).evaluate(el=>{const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let last;while(w.nextNode())if(w.currentNode.textContent.trim())last=w.currentNode;const range=document.createRange(),end=last.textContent.trimEnd().length;range.setStart(last,end-1);range.setEnd(last,end);return range.getBoundingClientRect().toJSON();});
   const bb=await body.boundingBox(),db=await page.locator('#helpDialog').boundingBox();console.log('GEOMETRY '+label+' '+JSON.stringify({tail,body:bb,dialog:db}));
   assert.ok(tail.x>=0&&tail.right<=width&&tail.y>=Math.max(0,bb.y,db.y)-1&&tail.bottom<=Math.min(height,bb.y+bb.height,db.y+db.height)+1,label+': final Help character reachable');
   assert.ok(await body.evaluate(el=>el.scrollWidth<=el.clientWidth+1),label+': Help width');await bounds(page.locator(cfg.head),width,height,label+': header');await bounds(page.locator(cfg.head+' h2'),width,height,label+': title');await bounds(page.locator(cfg.close),width,height,label+': Close');
   if(file==='dist/index.html'&&[1360,320].includes(width))await page.screenshot({path:path.join(results,`help-${language}-${width}.png`)});
   assert.ok(db.y>1,label+': genuine backdrop');const before=await page.evaluate(()=>scrollY);await page.mouse.move(2,1);await page.mouse.wheel(0,400);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>scrollY),before,label+': background lock retained');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#helpDialog').isVisible(),false);await page.locator('#helpButton').click();await page.locator(cfg.close).click();assert.equal(await page.locator('#helpDialog').isVisible(),false);await page.locator('#helpButton').click();await page.mouse.click(2,1);assert.equal(await page.locator('#helpDialog').isVisible(),false,label+': existing backdrop dismissal');
   if(file!==cfg.slug+'.html'&&language==='ja'&&width===360)await smoke(page,file);
   assert.deepEqual(errors,[],label+': runtime errors');assert.deepEqual(requests,[],label+': external runtime requests');console.log('PASS '+label);
  }catch(e){await page.screenshot({path:path.join(results,`failure-${file.replace(/[^a-z0-9]/gi,'-')}-${language}-${width}x${height}.png`)}).catch(()=>{});console.error('CONTEXT '+label+' '+JSON.stringify({errors,requests}));throw e;}finally{await context.close();}
 }}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
