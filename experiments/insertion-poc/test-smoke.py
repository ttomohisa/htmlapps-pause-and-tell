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
    ap.add_argument('--source-audio',action='store_true',help='Use a source with 440 Hz original soundtrack')
    ap.add_argument('--multiple',action='store_true',help='Record, delete and rerecord a second explanation')
    a=ap.parse_args()
    a.out.mkdir(parents=True,exist_ok=True)
    source=a.out/('source-audio-4s.webm' if a.source_audio else 'silent-4s.webm')
    source_command=['ffmpeg','-v','error','-y','-f','lavfi','-i',
        'testsrc2=size=320x180:rate=15:duration=4']
    if a.source_audio:
        source_command+=['-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=4',
                         '-map','0:v:0','-map','1:a:0']
    else:
        source_command+=['-an']
    source_command+=['-c:v','libvpx','-deadline','realtime','-cpu-used','8','-b:v','500k']
    if a.source_audio:
        source_command+=['-c:a','libopus','-b:a','64k','-shortest']
    command(source_command+[str(source)])
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=a.chromium,headless=True,args=[
            '--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        context=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
        page=context.new_page()
        errors=[]; external=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda req:external.append(req.url) if req.url.startswith(('http:','https:')) and not req.url.startswith('http://127.0.0.1:') else None)
        page.add_init_script("""(() => {
          const mediaDevices = navigator.mediaDevices;
          Object.defineProperty(mediaDevices, 'getUserMedia', { configurable:true, value: async () => {
            const context = new AudioContext();
            await context.resume();
            const wave=context.createOscillator(), gain=context.createGain(), dest=context.createMediaStreamDestination();
            wave.frequency.value=800;gain.gain.value=.3;wave.connect(gain);gain.connect(dest);wave.start();
            window.__pocTracks=(window.__pocTracks||[]).concat(dest.stream.getAudioTracks());
            return dest.stream;
          }});
        })()""")
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
        try:
            page.locator('#finishNote').wait_for(state='visible',timeout=25000)
        except Exception as error:
            diagnostic={
                'message':page.locator('#error').inner_text(),
                'capture':page.locator('#captureStatus').inner_text(),
                'pageErrors':errors,
                'sourceTime':page.locator('#sourceVideo').evaluate('(v)=>v.currentTime'),
                'readyState':page.locator('#sourceVideo').evaluate('(v)=>v.readyState'),
                'seeking':page.locator('#sourceVideo').evaluate('(v)=>v.seeking')
            }
            page.screenshot(path=str(a.out/'failure-capture.png'),full_page=True)
            raise AssertionError('Failed to start isolated explanation: '+json.dumps(diagnostic)) from error
        canvas=page.locator('#drawCanvas').bounding_box()
        page.mouse.move(canvas['x']+canvas['width']*.35,canvas['y']+canvas['height']*.4)
        page.mouse.down()
        page.mouse.move(canvas['x']+canvas['width']*.7,canvas['y']+canvas['height']*.65,steps=9)
        page.mouse.up()
        page.wait_for_timeout(1800)
        page.locator('#finishNote').click()
        page.locator('#notePanel').wait_for(state='visible',timeout=25000)
        assert page.locator('#noteSummary').inner_text()
        assert page.locator('#noteList .note-item').count()==1
        if a.multiple:
            # Add a second explanation near the end without losing the original.
            page.locator('#seek').evaluate("""element => {
                element.value='750';element.dispatchEvent(new Event('input',{bubbles:true}));
            }""")
            wait_for(lambda:abs(page.locator('#sourceVideo').evaluate('(v)=>v.currentTime')-3)<.12)
            page.locator('#startNote').click()
            page.locator('#finishNote').wait_for(state='visible',timeout=25000)
            page.wait_for_timeout(850)
            page.locator('#finishNote').click()
            wait_for(lambda:page.locator('#noteList .note-item').count()==2)
            # Delete just the second segment, then independently rerecord it.
            page.once('dialog',lambda dialog:dialog.accept())
            page.locator('#noteList .note-item').last.locator('button').last.click()
            wait_for(lambda:page.locator('#noteList .note-item').count()==1)
            page.locator('#startNote').click()
            page.locator('#finishNote').wait_for(state='visible',timeout=25000)
            page.wait_for_timeout(850)
            page.locator('#finishNote').click()
            wait_for(lambda:page.locator('#noteList .note-item').count()==2)
            assert '2' in page.locator('#noteSummary').inner_text()
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
        assert (6.0<duration<8.0 if a.multiple else 5.15<duration<7.5), f'Unexpected composed duration: {duration}'
        audio=command(['ffmpeg','-v','error','-i',str(result),'-vn','-ar','48000',
            '-ac','1','-f','s16le','-'],binary=True)
        pcm=array('h');pcm.frombytes(audio)
        signal=pcm[48000*2:48000*3]
        rms=math.sqrt(sum(v*v for v in signal)/len(signal))/32768 if signal else 0
        assert rms>.01,f'No narration samples at the inserted interval, RMS={rms}'
        # Frequency-specific checks prove that original soundtrack is retained
        # in original intervals and is silent throughout narration, rather than
        # merely verifying that the final container has an audio stream.
        def tone_amplitude(samples, seconds, frequency):
            start=int((seconds-.15)*48000)
            window=samples[max(0,start):int((seconds+.15)*48000)]
            if not window: return 0.
            cosine=sum(x*math.cos(2*math.pi*frequency*i/48000) for i,x in enumerate(window))
            sine=sum(x*math.sin(2*math.pi*frequency*i/48000) for i,x in enumerate(window))
            return 2*math.hypot(cosine,sine)/len(window)/32768
        lead_original=tone_amplitude(pcm,.7,440)
        insert_original=tone_amplitude(pcm,2.5,440)
        insert_narration=tone_amplitude(pcm,2.5,800)
        tail_original=tone_amplitude(pcm,duration-.5,440)
        lead_narration=tone_amplitude(pcm,.7,800)
        tail_narration=tone_amplitude(pcm,duration-.5,800)
        assert insert_narration>.04, ('Narration missing',insert_narration)
        assert insert_original<.025, ('Original audio plays during explanation',insert_original)
        assert lead_narration<.025 and tail_narration<.025, ('Narration leaked into source',lead_narration,tail_narration)
        if a.source_audio:
            assert lead_original>.03 and tail_original>.03, ('Original soundtrack missing',lead_original,tail_original)
        if a.multiple:
            second_voice=tone_amplitude(pcm,5.2,800)
            second_original=tone_amplitude(pcm,5.2,440)
            assert second_voice>.04 and second_original<.025,('Second inserted segment incorrect',second_voice,second_original)
        else:
            assert lead_original<.025 and tail_original<.025, ('Silence source contains unexpected sound',lead_original,tail_original)
        # Verify original frames survive both before AND after insertion.
        def rgb_at(file, seconds):
            return command(['ffmpeg','-v','error','-ss',f'{seconds:.3f}','-i',
              str(file),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],binary=True)
        def mean_abs(a,b):
            assert len(a)==len(b) and len(a)>0,(len(a),len(b))
            return sum(abs(x-y) for x,y in zip(a,b))/len(a)
        shift=duration-4.0
        prefix_diff=mean_abs(rgb_at(source,.4),rgb_at(result,.4))
        last_source_sample=3.8 if a.multiple else 3.1
        suffix_diff=mean_abs(rgb_at(source,last_source_sample),rgb_at(result,last_source_sample+shift))
        assert prefix_diff<35, f'Original opening frames altered too much: {prefix_diff}'
        assert suffix_diff<35, f'Original trailing frames missing or wrong: {suffix_diff}'
        # The original source was silent: there must not be narration outside
        # of the explicitly inserted interval.
        before=pcm[int(.35*48000):int(.85*48000)]
        after=pcm[int((duration-.7)*48000):int((duration-.2)*48000)]
        def rms_of(data):
            return math.sqrt(sum(v*v for v in data)/max(1,len(data)))/32768
        if not a.source_audio:
            assert rms_of(before)<.03 and rms_of(after)<.03, 'Silent original intervals contain unexpected audio'
        # For sources with sound the 440/800 Hz assertions above distinguish tracks.
        page.screenshot(path=str(a.out/'result.png'),full_page=True)
        assert not errors and not external,{'pageErrors':errors,'external':external}
        live=page.evaluate("()=>(window.__pocTracks||[]).filter(t=>t.readyState==='live').length")
        assert live==0,f'Microphone tracks not released: {live}'
        report={'status':'PASS','input':4,'output':duration,'video':streams['video']['codec_name'],
          'audio':streams['audio']['codec_name'],'narrationRms':rms,'sourceBytes':source.stat().st_size,
          'outputBytes':result.stat().st_size,'openingFrameError':prefix_diff,
          'tailFrameError':suffix_diff,'sourceHasAudio':a.source_audio,'multiple':a.multiple,
          'originalToneBefore':lead_original,'originalToneDuring':insert_original,
          'originalToneAfter':tail_original,'narrationToneDuring':insert_narration,
          'networkRequests':external,'pageErrors':errors}
        (a.out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print('PASS insertion PoC:',json.dumps(report))
        context.close();browser.close()
if __name__=='__main__':main()
