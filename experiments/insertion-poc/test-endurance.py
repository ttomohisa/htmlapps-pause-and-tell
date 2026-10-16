#!/usr/bin/env python3
"""Optional, explicit longer-video browser proof. Not part of ordinary short PR smoke."""
import argparse
import json
import math
import subprocess
import time
from array import array
from pathlib import Path
from playwright.sync_api import sync_playwright


def command(argv, binary=False):
    completed = subprocess.run(argv, check=False, capture_output=True)
    if completed.returncode:
        raise RuntimeError(f"Command failed with exit {completed.returncode}: {argv}\n"
                           + completed.stderr.decode(errors='replace')[-5000:])
    return completed.stdout if binary else completed.stdout.decode()


def probe(path):
    return json.loads(command(['ffprobe', '-v', 'error', '-show_streams',
                               '-show_format', '-of', 'json', str(path)]))


def tone_at(samples, second, frequency):
    rate = 48000
    a, b = int((second - .18) * rate), int((second + .18) * rate)
    window = samples[max(0, a):b]
    assert window, ('No audio samples at', second)
    cosine = sum(x * math.cos(2 * math.pi * frequency * n / rate) for n, x in enumerate(window))
    sine = sum(x * math.sin(2 * math.pi * frequency * n / rate) for n, x in enumerate(window))
    return 2 * math.hypot(cosine, sine) / len(window) / 32768


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='http://127.0.0.1:8765/index.html')
    ap.add_argument('--chromium', default='/usr/bin/chromium')
    ap.add_argument('--out', type=Path, default=Path('endurance-evidence'))
    ap.add_argument('--source-seconds', type=int, choices=(30, 60, 180), default=30)
    ap.add_argument('--source-format', choices=('webm', 'mp4'), default='webm')
    ap.add_argument('--orientation', choices=('landscape','portrait','rotated'), default='landscape')
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    if args.orientation=='rotated' and args.source_format!='mp4':
        raise ValueError('Rotated metadata fixture requires MP4 container')
    source = args.out / f'original-{args.source_seconds}s.{args.source_format}'
    width,height=(180,320) if args.orientation=='portrait' else (320,180)
    expected_width,expected_height=(180,320) if args.orientation!='landscape' else (320,180)
    start = time.monotonic()
    argv=['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
          f'testsrc2=size={width}x{height}:rate=15:duration={args.source_seconds}',
          '-f', 'lavfi', '-i',
          f'sine=frequency=440:sample_rate=48000:duration={args.source_seconds}',
          '-map', '0:v:0', '-map', '1:a:0']
    if args.source_format=='mp4':
        argv+=['-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',
               '-b:v','400k','-c:a','aac','-b:a','64k','-movflags','+faststart']
    else:
        argv+=['-c:v','libvpx','-deadline','realtime','-cpu-used','8',
               '-b:v','350k','-c:a','libopus','-b:a','48k']
    if args.orientation=='rotated':
        # Rotation is a container display matrix, not a pixel rotation.
        unrotated=args.out/'raw-landscape.mp4'
        command(argv+['-shortest',str(unrotated)])
        # Set an actual MOV/MP4 display matrix, not a legacy 'rotate'
        # metadata string. ffmpeg -display_rotation sets stream side-data.
        command(['ffmpeg','-v','error','-y','-display_rotation','90',
                 '-i',str(unrotated),'-map','0','-c','copy',str(source)])
        unrotated.unlink()
        metadata=probe(source)
        rotation_values=[abs(float(side.get('rotation',0))) for stream in metadata['streams']
                         if stream['codec_type']=='video'
                         for side in stream.get('side_data_list',[])]
        assert any(abs(v-90)<1 for v in rotation_values), (
            'Rotation metadata was not preserved in the test fixture',rotation_values)
    else:
        command(argv+['-shortest',str(source)])
    insertion_at = min(10, args.source_seconds / 3)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chromium, headless=True,
                                    args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
        page = ctx.new_page()
        errors = []
        external = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: external.append(request.url)
                if request.url.startswith(('https:', 'http:'))
                and not request.url.startswith('http://127.0.0.1:') else None)
        page.add_init_script("""(() => {
          Object.defineProperty(navigator.mediaDevices, 'getUserMedia',
            {configurable:true,value:async()=>{
              const audio=new AudioContext();
              await audio.resume();
              const osc=audio.createOscillator(), gain=audio.createGain();
              const out=audio.createMediaStreamDestination();
              osc.frequency.value=800;
              gain.gain.value=.3;
              osc.connect(gain);gain.connect(out);osc.start();
              window.__enduranceTracks=out.stream.getAudioTracks();
              return out.stream;
            }});
        })()""")
        page.goto(args.url, wait_until='domcontentloaded')
        page.locator('#sourceFile').set_input_files(str(source))
        try:
            page.locator('#editor').wait_for(state='visible', timeout=35000)
        except Exception as error:
            diagnostic={'message':page.locator('#error').inner_text(),
                'pageErrors':errors,'format':args.source_format,
                'sourceInfo':page.locator('#sourceInfo').inner_text()}
            (args.out/'input-failure.json').write_text(
                json.dumps(diagnostic,indent=2,ensure_ascii=False),encoding='utf-8')
            page.screenshot(path=str(args.out/'input-failure.png'),full_page=True)
            raise AssertionError('Video source could not be prepared: '+json.dumps(diagnostic)) from error
        canvas_aspect=page.locator('#drawCanvas').evaluate(
            "(c)=>c.width/c.height")
        assert abs(canvas_aspect-(expected_width/expected_height))<.04,(
            'Orientation metadata is not honored by canvas',canvas_aspect,
            expected_width,expected_height)
        page.locator('#seek').evaluate("""(node, value)=>{
          node.value=String(Math.round(value * 1000));
          node.dispatchEvent(new Event('input',{bubbles:true}));
        }""", insertion_at / args.source_seconds)
        page.locator('#startNote').click()
        page.locator('#finishNote').wait_for(state='visible', timeout=30000)
        canvas = page.locator('#drawCanvas').bounding_box()
        page.mouse.move(canvas['x']+canvas['width']*.25,canvas['y']+canvas['height']*.30)
        page.mouse.down()
        page.mouse.move(canvas['x']+canvas['width']*.70,canvas['y']+canvas['height']*.67,steps=8)
        page.mouse.up()
        page.wait_for_timeout(1100)
        page.locator('#finishNote').click()
        page.locator('#notePanel').wait_for(state='visible', timeout=20000)
        page.locator('#export').click()
        try:
            page.locator('#result').wait_for(state='visible', timeout=480000)
        except Exception as e:
            data={'errors':errors,'userError':page.locator('#error').inner_text(),
                  'exportStatus':page.locator('#exportStatus').inner_text()}
            (args.out/'failure.json').write_text(json.dumps(data,indent=2,ensure_ascii=False))
            page.screenshot(path=str(args.out/'failure.png'),full_page=True)
            raise AssertionError(data) from e
        with page.expect_download(timeout=20000) as d:
            page.locator('#save').click()
        output=args.out/'explained.webm'
        d.value.save_as(output)
        info=probe(output)
        kinds={s['codec_type']:s['codec_name'] for s in info['streams']}
        assert kinds.get('video')=='vp8' and kinds.get('audio')=='opus', kinds
        video_info=next(s for s in info['streams'] if s['codec_type']=='video')
        assert (video_info['width'],video_info['height'])==(expected_width,expected_height),(
            'Exported video dimensions/rotation incorrect',video_info)
        duration=float(info['format']['duration'])
        inserted=duration-args.source_seconds
        assert .5<inserted<4.0,(duration,inserted)
        audio=command(['ffmpeg','-v','error','-i',str(output),'-vn','-ar','48000',
                      '-ac','1','-f','s16le','-'],binary=True)
        pcm=array('h');pcm.frombytes(audio)
        assert tone_at(pcm,1,440)>.03, 'Opening source soundtrack missing'
        assert tone_at(pcm,insertion_at+.65,800)>.04, 'Inserted narration missing'
        assert tone_at(pcm,insertion_at+.65,440)<.025, 'Source audio overlaps inserted clip'
        assert tone_at(pcm,duration-2,440)>.03, 'Source soundtrack tail missing'
        assert tone_at(pcm,duration-2,800)<.025, 'Narration leaked into the source tail'
        # Source frame after the inserted section should be recognizably similar,
        # allowing for lossy VP8 recompression and frame-boundary timestamp rounding.
        def frame_at(path,second):
            # Seek AFTER opening the stream so FFmpeg decodes through the
            # requested position. This checks that the late original frames
            # actually decode sequentially instead of relying on WebM indexing.
            # Limit FFmpeg worker threads on small hosted runners.
            return command(['ffmpeg','-v','error','-threads','2','-filter_threads','1',
              '-i',str(path),'-ss',f'{second:.3f}',
              '-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'],binary=True)
        original=frame_at(source,args.source_seconds-3)
        composed=frame_at(output,duration-3)
        assert len(original)==len(composed) and original
        delta=sum(abs(a-b) for a,b in zip(original,composed))/len(original)
        assert delta<35,('Original final source frame missing',delta)
        mode=page.locator('#result').get_attribute('data-storage')
        assert mode=='temporary-file',('Expected OPFS streaming on Chromium',mode)
        assert page.evaluate("()=>window.__enduranceTracks?.every(t=>t.readyState==='ended')") is True
        assert not external and not errors,{'external':external,'errors':errors}
        result={'status':'PASS','sourceSeconds':args.source_seconds, 'sourceFormat':args.source_format,
                'outputSeconds':duration,'insertedSeconds':inserted,
                'outputBytes':output.stat().st_size,'sourceBytes':source.stat().st_size,
                'durationRunSeconds':round(time.monotonic()-start,2),
                'storage':mode,'tailFrameMeanError':delta,
                'orientation':args.orientation,'outputDimensions':[expected_width,expected_height],
                'pageErrors':errors,'externalRequests':external}
        (args.out/'report.json').write_text(json.dumps(result,indent=2))
        page.screenshot(path=str(args.out/'finished.png'), full_page=True)
        print('PASS insertion endurance:',json.dumps(result))
        ctx.close()
        browser.close()


if __name__=='__main__':
    main()
