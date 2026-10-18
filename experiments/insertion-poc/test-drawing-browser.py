#!/usr/bin/env python3
"""Real-browser drawing/history capture and encoded-frame parity regression."""
import argparse,base64,json,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright

def run(args):return subprocess.run(args,check=True,capture_output=True).stdout
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8766/index.html');p.add_argument('--out',type=Path,default=Path('/tmp/insertion-drawing-evidence'));a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
source=a.out/'source.webm'
run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=0x404040:s=320x180:r=15:d=4','-an','-c:v','libvpx',str(source)])
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 page=b.new_page(viewport={'width':390,'height':844},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{const c=new AudioContext();await c.resume();const o=c.createOscillator(),d=c.createMediaStreamDestination();o.connect(d);o.start();return d.stream;}});document.addEventListener('pointerdown',e=>{if(e.target.id==='drawCanvas')window.__drawingPointer=e.pointerId},true);window.__recordStart=0;const start=MediaRecorder.prototype.start;MediaRecorder.prototype.start=function(...args){window.__recordStart=performance.now();return start.apply(this,args)};""")
 page.goto(a.url);page.locator('#sourceFile').set_input_files(str(source));page.locator('#editor').wait_for(state='visible');page.wait_for_function("() => !document.querySelector('#startNote').disabled")
 page.evaluate("""bytes=>{const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob(bytes),c=>c.charCodeAt(0))],'dropped.webm',{type:'video/webm'}));document.querySelector('#sourcePanel').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));}""",base64.b64encode(source.read_bytes()).decode());page.wait_for_function("() => document.querySelector('#sourceInfo').textContent.includes('dropped.webm') && !document.querySelector('#startNote').disabled")
 page.locator('#seek').evaluate("e=>{e.value=500;e.dispatchEvent(new Event('input',{bubbles:true}))}")
 page.locator('#startNote').click();page.locator('#finishNote').wait_for(state='visible')
 assert page.locator('[data-draw-tool=pen]').get_attribute('aria-pressed')=='true'
 samples=[]
 def sample(name):
  page.wait_for_timeout(180)
  samples.append(page.evaluate("name=>({name,at:(performance.now()-window.__recordStart)/1000,pixels:Array.from(document.querySelector('#drawCanvas').getContext('2d').getImageData(0,0,320,180).data)})",name));page.wait_for_timeout(180)
 def gesture(tool,color):
  page.locator('[data-draw-tool='+tool+']').click();page.locator('[data-draw-color='+color+']').click();page.locator('#drawCanvas').scroll_into_view_if_needed();r=page.locator('#drawCanvas').bounding_box()
  page.mouse.move(r['x']+r['width']*.2,r['y']+r['height']*.3);page.mouse.down();page.mouse.move(r['x']+r['width']*.7,r['y']+r['height']*.7,steps=6);page.mouse.up()
 sample('empty')
 gesture('pen','yellow');sample('pen-yellow')
 gesture('ellipse','white');sample('ellipse-white')
 gesture('arrow','red');sample('arrow-red')
 page.locator('[data-draw-tool=point]').click();page.locator('#drawCanvas').focus();page.keyboard.press('ArrowRight');page.keyboard.press('Shift+ArrowDown');page.keyboard.press('Enter');assert page.locator('#keyboardCursor').is_visible();sample('point-keyboard')
 page.keyboard.press('Control+z');sample('undo-point')
 # A cancelled gesture after Undo must retain Redo and release actual capture.
 page.locator('[data-draw-tool=pen]').click();page.locator('#drawCanvas').scroll_into_view_if_needed();r=page.locator('#drawCanvas').bounding_box()
 page.mouse.move(r['x']+r['width']*.3,r['y']+r['height']*.3);page.mouse.down()
 assert page.evaluate("document.querySelector('#drawCanvas').hasPointerCapture(window.__drawingPointer)")
 page.evaluate("document.querySelector('#drawCanvas').dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.__drawingPointer,bubbles:true}))")
 assert not page.evaluate("document.querySelector('#drawCanvas').hasPointerCapture(window.__drawingPointer)")
 page.mouse.up();assert not page.locator('#drawRedo').is_disabled()
 page.keyboard.press('Control+Shift+z');sample('redo-point')
 page.locator('#drawClear').click();sample('clear')
 page.locator('#drawUndo').click();sample('undo-clear')
 assert samples[0]['pixels']==samples[-2]['pixels'],'Clear did not restore frozen source'
 assert samples[4]['pixels']==samples[6]['pixels']==samples[8]['pixels'],'Undo/Redo changed restored geometry'
 assert samples[3]['pixels']==samples[5]['pixels'],'Undo did not remove only the final Point'
 assert all(samples[i]['pixels']!=samples[i-1]['pixels'] for i in range(1,5)),'A tool failed to draw'
 # Finish with a genuinely captured, unfinished pointer gesture.
 page.locator('#drawCanvas').scroll_into_view_if_needed();r=page.locator('#drawCanvas').bounding_box()
 page.mouse.move(r['x']+r['width']*.8,r['y']+r['height']*.2);page.mouse.down()
 assert page.evaluate("document.querySelector('#drawCanvas').hasPointerCapture(window.__drawingPointer)")
 page.evaluate("document.querySelector('#finishNote').click()")
 assert not page.evaluate("document.querySelector('#drawCanvas').hasPointerCapture(window.__drawingPointer)")
 page.mouse.up();page.locator('#notePanel').wait_for(state='visible');page.locator('#export').click();page.locator('#result').wait_for(state='visible',timeout=120000)
 with page.expect_download() as d:page.locator('#save').click()
 output=a.out/'drawing.webm';d.value.save_as(str(output))
 evidence=[]
 for s in samples:
  raw=run(['ffmpeg','-v','error','-ss',str(2+s['at']),'-i',str(output),'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','-'])
  assert len(raw)==len(s['pixels']),(s['name'],len(raw))
  error=sum(abs(x-y) for x,y in zip(raw,s['pixels']))/len(raw)
  assert error<7,(s['name'],error,'Encoded state differs from recording preview')
  evidence.append({'state':s['name'],'narrationSeconds':s['at'],'meanPixelError':error})
 # Cancellation also releases pointer ownership without changing the saved clip.
 page.locator('#startNote').click();page.locator('#finishNote').wait_for(state='visible')
 page.locator('#drawCanvas').scroll_into_view_if_needed();r=page.locator('#drawCanvas').bounding_box()
 page.mouse.move(r['x']+r['width']*.3,r['y']+r['height']*.3);page.mouse.down()
 assert page.evaluate("document.querySelector('#drawCanvas').hasPointerCapture(window.__drawingPointer)")
 page.evaluate("document.querySelector('#cancelNote').click()")
 assert not page.evaluate("document.querySelector('#drawCanvas').hasPointerCapture(window.__drawingPointer)")
 page.mouse.up();page.locator('#startNote').wait_for(state='visible')
 assert page.locator('#noteList .note-item').count()==1
 assert not errors,errors
 (a.out/'drawing-results.json').write_text(json.dumps(evidence,indent=2));print(json.dumps(evidence,indent=2));b.close()
