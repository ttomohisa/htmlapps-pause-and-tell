#!/usr/bin/env python3
"""Browser-only insertion PoC acceptance: source + independently recorded narration -> output."""
import argparse
import json
import math
import re
import subprocess
import time
from array import array
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

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
    ap.add_argument('--portrait',action='store_true',help='Use a vertical source and verify pen coordinates')
    ap.add_argument('--memory-target',action='store_true',help='Disable OPFS to exercise the memory fallback')
    ap.add_argument('--expanded-input',action='store_true',help='Verify loading an input longer than the old 15-second prototype cap')
    ap.add_argument('--vfr-stereo',action='store_true',help='Opt-in irregular video timestamps plus 44.1 kHz stereo Vorbis source')
    ap.add_argument('--output-format',choices=['webm','mp4'],default='webm',help='MP4 requires a real native AAC-capable browser; no fallback is injected')
    a=ap.parse_args()
    if a.vfr_stereo:a.source_audio=True
    a.out.mkdir(parents=True,exist_ok=True)
    source=a.out/('source-audio-4s.webm' if a.source_audio else 'silent-4s.webm')
    width,height=(180,320) if a.portrait else (320,180)
    source_command=['ffmpeg','-v','error','-y','-f','lavfi','-i',
        f'testsrc2=size={width}x{height}:rate={60 if a.vfr_stereo else 15}:duration=4']
    if a.source_audio:
        source_command+=['-f','lavfi','-i',('aevalsrc=0.25*sin(2*PI*440*t)|0.25*sin(2*PI*660*t):s=44100:d=4' if a.vfr_stereo else 'sine=frequency=440:sample_rate=48000:duration=4'),
                         '-map','0:v:0','-map','1:a:0']
    else:
        source_command+=['-an']
    if a.vfr_stereo:
        source_command+=['-vf',"select='if(lt(t,2),not(mod(n,2)),not(mod(n,5)))+eq(n,239)'",'-fps_mode','vfr']
    source_command+=['-c:v','libvpx','-deadline','realtime','-cpu-used','8','-b:v','500k']
    if a.source_audio:
        source_command+=['-c:a',('libvorbis' if a.vfr_stereo else 'libopus'),'-b:a',('96k' if a.vfr_stereo else '64k'),'-shortest']
    command(source_command+[str(source)])
    source_deltas=[]
    if a.vfr_stereo:
        original=ffprobe(source);source_audio=next(s for s in original['streams'] if s['codec_type']=='audio')
        assert source_audio['sample_rate']=='44100' and source_audio['channels']==2,source_audio
        frames=json.loads(command(['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',str(source)]))['frames']
        pts=[float(frame['best_effort_timestamp_time']) for frame in frames]
        source_deltas=sorted(set(round(b-a,3) for a,b in zip(pts,pts[1:])))
        assert len(source_deltas)>=2 and max(source_deltas)-min(source_deltas)>.03,source_deltas
        assert pts[-1]>3.95,pts[-1]

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
        if a.memory_target:
            page.add_init_script("""(() => {
              if(navigator.storage) Object.defineProperty(navigator.storage,
                'getDirectory',{configurable:true,value:undefined});
            })()""")
        page.goto(a.url,wait_until='domcontentloaded')
        # The shipped shell must retain the established header and usable help.
        assert page.locator('.app-header .header-inner').count()==1
        assert page.locator('.page-intro').is_visible()
        assert page.locator('#ptSteps').count()==0
        page.set_viewport_size({'width':1180,'height':800})
        page.screenshot(path=str(a.out/'initial-ja-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.locator('#helpButton').click()
        assert page.locator('#helpDialog').is_visible()
        assert page.evaluate("document.documentElement.classList.contains('pt-help-locked')")
        page.screenshot(path=str(a.out/'help-ja-mobile.png'),full_page=True)
        page.keyboard.press('Escape')
        assert not page.locator('#helpDialog').is_visible()
        page.wait_for_function("() => !document.documentElement.classList.contains('pt-help-locked') && !document.body.classList.contains('pt-help-locked')")
        page.locator('#helpButton').click();page.locator('#closeHelpButton').click()
        assert not page.locator('#helpDialog').is_visible()
        page.screenshot(path=str(a.out/'initial-ja-mobile.png'),full_page=True)
        assert page.locator('#nativeSupportPanel').count()==0
        assert page.locator('#formatHint').count()==0
        if a.expanded_input:
            larger=a.out/'expanded-20s.webm'
            command(['ffmpeg','-v','error','-y','-f','lavfi','-i',
              'testsrc2=size=160x90:rate=5:duration=20','-an','-c:v','libvpx',
              '-deadline','realtime','-cpu-used','8','-b:v','150k',str(larger)])
            page.locator('#sourceFile').set_input_files(str(larger))
            page.locator('#editor').wait_for(state='visible',timeout=25000)
            assert '20.0s' in page.locator('#sourceInfo').inner_text()
            assert not page.locator('#startNote').is_disabled()
        page.locator('#sourceFile').set_input_files(str(source))
        page.locator('#editor').wait_for(state='visible')
        page.locator('#exportFormat').select_option(a.output_format)
        try:
            page.locator('#editor').wait_for(state='visible',timeout=25000)
        except Exception as error:
            diagnostic={
                'message':page.locator('#error').inner_text(),
                'pageErrors':errors,
                'header':page.locator('.brand-name').inner_text(),
                'source':page.locator('#sourceInfo').inner_text()
            }
            page.screenshot(path=str(a.out/'failure-input.png'),full_page=True)
            raise AssertionError('Could not open source: '+json.dumps(diagnostic)) from error
        # The editor may already be visible while a replacement is loading.
        # Wait for the *new* source and its controls, not the existing editor.
        try:
            wait_for(lambda:'4.0s' in page.locator('#sourceInfo').inner_text()
                and not page.locator('#startNote').is_disabled(), seconds=30)
        except Exception as error:
            data={'sourceInfo':page.locator('#sourceInfo').inner_text(),
                  'error':page.locator('#error').inner_text(),'pageErrors':errors,
                  'startDisabled':page.locator('#startNote').is_disabled()}
            raise AssertionError('Source replacement did not finish: '+json.dumps(data)) from error
        assert page.locator('#sourceVideo').evaluate('(v)=>v.muted') is False
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
        page.locator('#drawCanvas').scroll_into_view_if_needed()
        canvas=page.locator('#drawCanvas').bounding_box()
        assert page.locator('#drawCanvas').evaluate("c => {const r=c.getBoundingClientRect();return [[.35,.4],[.7,.65]].every(([x,y])=>document.elementFromPoint(r.x+r.width*x,r.y+r.height*y)===c);}"), 'Pen test target is clipped or covered'
        displayed_ratio=canvas['width']/canvas['height']
        expected_ratio=width/height
        assert abs(displayed_ratio-expected_ratio)<.04,(
            'Drawing canvas does not match video aspect ratio',
            displayed_ratio,expected_ratio)
        page.mouse.move(canvas['x']+canvas['width']*.35,canvas['y']+canvas['height']*.4)
        page.mouse.down()
        page.mouse.move(canvas['x']+canvas['width']*.7,canvas['y']+canvas['height']*.65,steps=9)
        page.mouse.up()
        page.wait_for_timeout(1800)
        page.screenshot(path=str(a.out/'recording-ja-mobile.png'),full_page=True)
        page.set_viewport_size({'width':1180,'height':800})
        page.screenshot(path=str(a.out/'recording-ja-desktop.png'),full_page=True)
        source_position=page.locator('#sourceVideo').evaluate('(v)=>v.currentTime')
        drawing_pixels=page.locator('#drawCanvas').evaluate('(c)=>c.toDataURL()')
        page.locator('#language').click()
        expect(page.locator('#captureStatus')).to_contain_text('Recording your explanation.')
        expect(page.locator('#sourceInfo')).to_contain_text('Original audio present' if a.source_audio else 'Silent source')
        page.screenshot(path=str(a.out/'recording-en-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(a.out/'recording-en-mobile.png'),full_page=True)
        page.locator('#language').click()
        expect(page.locator('#captureStatus')).to_contain_text('説明を録音中')
        expect(page.locator('#sourceInfo')).to_contain_text('元音声あり' if a.source_audio else '無音動画')
        assert page.locator('#sourceVideo').evaluate('(v)=>v.currentTime')==source_position
        assert page.locator('#drawCanvas').evaluate('(c)=>c.toDataURL()')==drawing_pixels
        expect(page.locator('#recordingClock')).to_be_visible()
        page.set_viewport_size({'width':390,'height':844})
        page.locator('#finishNote').click()
        page.locator('#noteList .note-item').first.wait_for(state='visible',timeout=25000)
        assert page.locator('#noteSummary').inner_text()
        assert page.locator('#noteList .note-item').count()==1
        if a.multiple:
            # Replacement confirmation must preserve separately recorded clips if
            # dismissed. An invalid new video must not destroy them either.
            page.locator('#sourceFile').set_input_files(str(source))
            page.locator('#confirmCancel').click()
            assert page.locator('#noteList .note-item').count()==1
            broken=a.out/'broken-video.mp4'
            broken.write_bytes(b'not a video')
            page.locator('#sourceFile').set_input_files(str(broken))
            page.locator('#confirmAccept').click()
            wait_for(lambda:bool(page.locator('#error').inner_text()))
            assert page.locator('#noteList .note-item').count()==1
            assert page.locator('#sourceVideo').evaluate('(v)=>v.readyState>=2')
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
            # Rerecord the selected second segment without deleting it first.
            previous_audio=page.locator('#notePlayer').get_attribute('src')
            previous_rows=page.locator('#noteList .note-item button:first-child').all_inner_texts()
            page.locator('#seek').evaluate("element => {element.value='0';element.dispatchEvent(new Event('input',{bubbles:true}));}")
            page.locator('#rerecord').click()
            assert page.locator('#noteList .note-item').count()==2
            page.locator('#finishNote').wait_for(state='visible',timeout=25000)
            page.wait_for_timeout(850)
            page.locator('#finishNote').click()
            wait_for(lambda:page.locator('#notePlayer').get_attribute('src')!=previous_audio)
            assert page.locator('#noteList .note-item').count()==2
            replaced=page.locator('#noteList .note-item button:first-child').all_inner_texts()
            assert replaced[0]==previous_rows[0]
            assert replaced[1].split(' · ')[0]==previous_rows[1].split(' · ')[0]
            assert replaced[1].split(' · ')[-1]==previous_rows[1].split(' · ')[-1]
            assert '2' in page.locator('#noteSummary').inner_text()
        # Read user-visible, rounded clip durations rather than assuming every
        # browser's MediaRecorder returns exactly 1.94 seconds.
        notes=page.locator('#noteList .note-item button:first-child').all_inner_texts()
        durations=[float(re.search(r'·\s*([0-9]+\.[0-9]+)s',item).group(1)) for item in notes]
        expected_output=4.0+sum(durations)
        page.locator('#exportFormat').select_option(a.output_format)
        wait_for(lambda:page.locator('#export').is_enabled())
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
        result=a.out/('inserted.'+a.output_format)
        d.value.save_as(result)
        probe=ffprobe(result)
        streams={s['codec_type']:s for s in probe['streams']}
        assert set(streams)>={'audio','video'},probe
        assert streams['video']['codec_name']==('h264' if a.output_format=='mp4' else 'vp8'),streams
        assert streams['audio']['codec_name']==('aac' if a.output_format=='mp4' else 'opus'),streams
        assert int(streams['video']['width'])==width and int(streams['video']['height'])==height,(
            'Output orientation or dimensions changed',streams['video'])
        duration=float(probe['format']['duration'])
        assert abs(duration-expected_output)<.65, (
            f'Output duration {duration} differs from source + separate clips {expected_output}')
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
        else:
            assert lead_original<.025 and tail_original<.025, ('Silence source contains unexpected sound',lead_original,tail_original)
        if a.multiple:
            # The original soundtrack must also survive BETWEEN the two inserts.
            # Recording duration includes real browser work (including captures).
            # Keep each 300 ms analysis window inside its intended interval.
            # Rounded UI duration uncertainty is <=50 ms, plus one 15fps frame.
            middle_center=2+durations[0]+.5
            second_center=3+durations[0]+durations[1]/2
            assert durations[1]>.6, 'Second narration too short for an interior tone window'
            middle_original=tone_amplitude(pcm,middle_center,440)
            middle_narration=tone_amplitude(pcm,middle_center,800)
            assert middle_original>.03 and middle_narration<.025, ('Middle source audio lost',middle_original,middle_narration)
            second_voice=tone_amplitude(pcm,second_center,800)
            second_original=tone_amplitude(pcm,second_center,440)
            assert second_voice>.04 and second_original<.025,('Second inserted segment incorrect',second_voice,second_original)
        if a.vfr_stereo:
            assert streams['audio']['channels']==2,streams['audio']
            stereo=array('h');stereo.frombytes(command(['ffmpeg','-v','error','-i',str(result),'-vn','-ar','48000','-ac','2','-f','s16le','-'],binary=True))
            left,right=stereo[::2],stereo[1::2]
            for sample in (.7,duration-.5):
                assert tone_amplitude(left,sample,440)>.12 and tone_amplitude(left,sample,660)<.025
                assert tone_amplitude(right,sample,660)>.12 and tone_amplitude(right,sample,440)<.025
            for sample in ([2.5,second_center] if a.multiple else [2.5]):
                assert tone_amplitude(left,sample,800)>.04 and tone_amplitude(right,sample,800)>.04
                for channel in (left,right):
                    assert tone_amplitude(channel,sample,440)<.025 and tone_amplitude(channel,sample,660)<.025, 'Source stereo tone leaked into narration'
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
        if a.portrait:
            # The central part of the pointer-drawn diagonal must be visible
            # in the *encoded inserted frame*. Aspect alone is not sufficient.
            still=rgb_at(source,2.0)
            inserted_frame=rgb_at(result,2.8)
            def patch_pixels(data):
                cx,cy=int(width*.53),int(height*.53)
                values=[]
                for y in range(cy-5,cy+6):
                    for x in range(cx-5,cx+6):
                        idx=(y*width+x)*3
                        values.extend(data[idx:idx+3])
                return values
            original_patch,marked_patch=patch_pixels(still),patch_pixels(inserted_frame)
            drawn_delta=sum(abs(x-y) for x,y in zip(original_patch,marked_patch))/len(marked_patch)
            assert drawn_delta>12, ('Recorded portrait Pen line did not appear at tap position',drawn_delta)

        # The original source was silent: there must not be narration outside
        # of the explicitly inserted interval.
        before=pcm[int(.35*48000):int(.85*48000)]
        after=pcm[int((duration-.7)*48000):int((duration-.2)*48000)]
        def rms_of(data):
            return math.sqrt(sum(v*v for v in data)/max(1,len(data)))/32768
        if not a.source_audio:
            assert rms_of(before)<.03 and rms_of(after)<.03, 'Silent original intervals contain unexpected audio'
        # For sources with sound the 440/800 Hz assertions above distinguish tracks.
        page.set_viewport_size({'width':320,'height':568})
        overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
        if overflow:
            offenders=page.evaluate("""() => Array.from(document.querySelectorAll('*'))
              .filter(el => el.getBoundingClientRect().right > innerWidth + 1)
              .slice(0,8).map(el => ({
                tag:el.tagName,id:el.id,cls:el.className,
                width:Math.round(el.getBoundingClientRect().width),
                right:Math.round(el.getBoundingClientRect().right)
              }))""")
            page.screenshot(path=str(a.out/'320px-overflow.png'),full_page=True)
            raise AssertionError('320px phone layout has horizontal overflow: '+json.dumps(offenders))
        storage=page.locator('#result').get_attribute('data-storage')
        assert storage in ('temporary-file','memory'),storage
        if a.memory_target:
            assert storage=='memory','Memory fallback did not run'
        page.evaluate("document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,180)")
        prior_scroll=page.evaluate('scrollY')
        page.locator('#helpButton').click();page.keyboard.press('Escape')
        page.wait_for_function("y=>Math.abs(scrollY-y)<2",arg=prior_scroll)
        assert not page.evaluate("document.body.classList.contains('pt-help-locked')")
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(a.out/'result.png'),full_page=True)
        page.set_viewport_size({'width':1180,'height':800})
        page.screenshot(path=str(a.out/'saved-ja-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(a.out/'saved-ja-mobile.png'),full_page=True)
        assert not errors and not external,{'pageErrors':errors,'external':external}
        live=page.evaluate("()=>(window.__pocTracks||[]).filter(t=>t.readyState==='live').length")
        assert live==0,f'Microphone tracks not released: {live}'
        report={'status':'PASS','input':4,'output':duration,'video':streams['video']['codec_name'],
          'audio':streams['audio']['codec_name'],'narrationRms':rms,'sourceBytes':source.stat().st_size,
          'outputBytes':result.stat().st_size,'openingFrameError':prefix_diff,
          'tailFrameError':suffix_diff,'sourceHasAudio':a.source_audio,
          'portrait':a.portrait,'multiple':a.multiple,'clipDurations':durations,'middleProbe':middle_center if a.multiple else None,'secondProbe':second_center if a.multiple else None,'vfrStereo':a.vfr_stereo,'sourceFrameDeltas':source_deltas,
          'storage':storage,'expectedOutput':expected_output,
          'originalToneBefore':lead_original,'originalToneDuring':insert_original,
          'originalToneAfter':tail_original,'narrationToneDuring':insert_narration,
          'networkRequests':external,'pageErrors':errors}
        (a.out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print('PASS insertion PoC:',json.dumps(report))
        if a.multiple:
            # Deletion stays covered after saved-file verification, without
            # another recording/export just to restore the test fixture.
            # Selection must bring video time, frozen drawing and actions together.
            first_row=page.locator('#noteList .note-item').first
            first_row.locator('button').first.click()
            expected=float(first_row.inner_text().split('s')[0])
            assert abs(page.locator('#sourceVideo').evaluate('(v)=>v.currentTime')-expected)<.12
            assert page.locator('#sourceVideo').evaluate('(v)=>v.paused')
            expect(page.locator('#drawCanvas')).to_be_visible()
            expect(first_row.locator('button').first).to_have_attribute('aria-pressed','true')
            final_drawing=page.locator('#drawCanvas').evaluate('(c)=>c.toDataURL()')
            page.locator('#notePlayer').evaluate('(v)=>{v.currentTime=0;v.dispatchEvent(new Event("timeupdate"));}')
            opening_drawing=page.locator('#drawCanvas').evaluate('(c)=>c.toDataURL()')
            assert opening_drawing!=final_drawing,'Selected narration did not replay drawing timing'
            page.locator('#seek').evaluate('(v)=>{v.value="500";v.dispatchEvent(new Event("input"));}')
            expect(page.locator('#selectedExplanation')).to_be_hidden()
            expect(page.locator('#noteList [aria-pressed="true"]')).to_have_count(0)
            expect(page.locator('#sourceVideo')).to_be_visible()
            page.locator('#language').click()
            expect(page.locator('#noteList')).to_contain_text('Explanation')
            expect(page.locator('#noteList .icon-button').first).to_have_attribute('aria-label','Delete explanation 1')
            page.locator('#language').click()
            first_row.locator('button').first.click()
            page.screenshot(path=str(a.out/'selected-explanation-ja-mobile.png'),full_page=True)
            before=page.locator('#noteList').inner_text()
            trash=first_row.locator('button').last
            trash.scroll_into_view_if_needed()
            scroll_before=page.evaluate("window.scrollY")
            trash.click()
            expect(page.locator('#confirmDialog')).to_be_visible()
            expect(page.locator('#confirmCancel')).to_be_focused()
            assert '説明 1' in page.locator('#confirmMessage').inner_text()
            assert page.evaluate('document.body.classList.contains("pt-help-locked")')
            page.screenshot(path=str(a.out/'delete-confirm-ja-mobile.png'),full_page=True)
            page.keyboard.press('Escape')
            expect(page.locator('#confirmDialog')).not_to_be_visible()
            expect(trash).to_be_focused()
            assert abs(page.evaluate("window.scrollY")-scroll_before)<2
            assert page.locator('#noteList').inner_text()==before
            assert page.locator('#result').is_visible()
            assert not page.evaluate('document.body.classList.contains("pt-help-locked")')
            page.locator('#noteList .note-item').last.locator('button').last.click()
            page.locator('#confirmAccept').click()
            wait_for(lambda:page.locator('#noteList .note-item').count()==1)
            assert not page.locator('#result').is_visible()
        context.close();browser.close()
if __name__=='__main__':main()
