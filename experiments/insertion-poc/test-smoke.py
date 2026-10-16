#!/usr/bin/env python3
"""Browser-only insertion PoC acceptance: source + independently recorded narration -> output."""
import argparse
import json
import math
import subprocess
import time
from array import array
from pathlib import Path
from playwright.sync_api import sync_playwright

def command(args, binary=False):
    v=subprocess.run(args,capture_output=True,check=True)
    return v.stdout if binary else v.stdout.decode()

def wait_for(predicate, seconds=25):
    until=time.monotonic()+seconds
    while time.monotonic()<until:
        if predicate(): return
        time.sleep(.1)
    raise TimeoutError('PoC state did not advance')

def ffprobe(path):
    return json.loads(command(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--url',default='http://127.0.0.1:8765/index.html')
    ap.add_argument('--out',type=Path,default=Path('insertion-evidence'))
    ap.add_argument('--chromium',default='/usr/bin/chromium')
    a=ap.parse_args()
    a.out.mkdir(parents=True,exist_ok=True)
    source=a.out/'silent-4s.webm'
    command(['ffmpeg','-v','error','-y','-f','lavfi','-i',
        'testsrc2=size=320x180:rate=15:duration=4','-an','-c:v','libvpx',
        '-deadline','realtime','-cpu-used','8','-b:v','500k',str(source)])
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=a.chromium,headless=True,args=[
            '--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        context=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
        page=context.new_page()
        errors=[]; external=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda req:external.append(req.url) if req.url.startswith(('http:','https:')) and not req.url.startswith('http://127.0.0.1:') else None)
        page.add_init_script("""() => {
          const mediaDevices = navigator.mediaDevices;
          Object.defineProperty(mediaDevices, 'getUserMedia', { configurable:true, value: async () => {
            const context = new AudioContext();
            await context.resume();
            const wave=context.createOscillator(), gain=context.createGain(), dest=context.createMediaStreamDestination();
            wave.frequency.value=800;gain.gain.value=.3;wave.connect(gain);gain.connect(dest);wave.start();
            window.__pocTracks=(window.__pocTracks||[]).concat(dest.stream.getAudioTracks());
            return dest.stream;
          }});
        }""")
        page.goto(a.url,wait_until='domcontentloaded')
        page.locator('#sourceFile').set_input_files(str(source))
        try:
            page.locator('#editor').wait_for(state='visible',timeout=25000)
        except Exception as error:
            diagnostic={
                'message':page.locator('#error').inner_text(),
                'pageErrors':errors,
                'header':page.locator('h1').inner_text(),
                'source':page.locator('#sourceInfo').inner_text()
            }
            page.screenshot(path=str(a.out/'failure-input.png'),full_page=True)
            raise AssertionError('Could not open source: '+json.dumps(diagnostic)) from error
        assert not page.locator('#startNote').is_disabled()
        page.locator('#seek').evaluate("""element => {
            element.value='500';element.dispatchEvent(new Event('input',{bubbles:true}));
        }""")
        wait_for(lambda: abs(page.locator('#sourceVideo').evaluate('(v)=>v.currentTime')-2)<.1)
        page.locator('#startNote').click()
        page.locator('#finishNote').wait_for(state='visible',timeout=25000)
        canvas=page.locator('#drawCanvas').bounding_box()
        page.mouse.move(canvas['x']+canvas['width']*.35,canvas['y']+canvas['height']*.4)
        page.mouse.down()
        page.mouse.move(canvas['x']+canvas['width']*.7,canvas['y']+canvas['height']*.65,steps=9)
        page.mouse.up()
        page.wait_for_timeout(1800)
        page.locator('#finishNote').click()
        page.locator('#notePanel').wait_for(state='visible',timeout=25000)
        assert page.locator('#noteSummary').inner_text()
        page.locator('#export').click()
        try:
            page.locator('#result').wait_for(state='visible',timeout=100000)
        except Exception:
            data={
                'error':page.locator('#error').inner_text(),
                'export':page.locator('#exportStatus').inner_text(),
                'capture':page.locator('#captureStatus').inner_text(),
                'pageErrors':errors,
            }
            page.screenshot(path=str(a.out/'failure.png'),full_page=True)
            raise AssertionError(json.dumps(data,ensure_ascii=False))
        with page.expect_download(timeout=15000) as d:
            page.locator('#save').click()
        result=a.out/'inserted.webm'
        d.value.save_as(result)
        probe=ffprobe(result)
        streams={s['codec_type']:s for s in probe['streams']}
        assert set(streams)>={'audio','video'},probe
        assert streams['video']['codec_name']=='vp8',streams
        assert streams['audio']['codec_name']=='opus',streams
        duration=float(probe['format']['duration'])
        assert 5.15<duration<7.5, f'Expected source 4s plus ~2s narration, got {duration}'
        audio=command(['ffmpeg','-v','error','-i',str(result),'-vn','-ar','48000',
            '-ac','1','-f','s16le','-'],binary=True)
        pcm=array('h');pcm.frombytes(audio)
        signal=pcm[48000*2:48000*3]
        rms=math.sqrt(sum(v*v for v in signal)/len(signal))/32768 if signal else 0
        assert rms>.01,f'No narration samples at the inserted interval, RMS={rms}'
        assert not errors and not external,{'pageErrors':errors,'external':external}
        live=page.evaluate("()=>(window.__pocTracks||[]).filter(t=>t.readyState==='live').length")
        assert live==0,f'Microphone tracks not released: {live}'
        report={'status':'PASS','input':4,'output':duration,'video':streams['video']['codec_name'],
          'audio':streams['audio']['codec_name'],'narrationRms':rms,'sourceBytes':source.stat().st_size,
          'outputBytes':result.stat().st_size,'networkRequests':external,'pageErrors':errors}
        (a.out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print('PASS insertion PoC:',json.dumps(report))
        context.close();browser.close()
if __name__=='__main__':main()
