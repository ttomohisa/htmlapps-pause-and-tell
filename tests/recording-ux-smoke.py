#!/usr/bin/env python3
"""Manual v0.9.3 browser regression: video-first capture and drawing undo/redo.

Install playwright and FFmpeg/ffprobe for DEVELOPMENT ONLY. No runtime app deps.
python tests/recording-ux-smoke.py --html dist/index.html --output ./ux-test --chromium /usr/bin/chromium

Tests use a synthetic WebAudio mic via about:blank page.set_content.
They do NOT establish physical iOS/Android, native saved-file, or file:// support.
"""
import argparse
import json
import math
import subprocess
import time
from array import array
from pathlib import Path
from playwright.sync_api import sync_playwright


def execute(command, binary=False):
    result = subprocess.run(command, check=True, capture_output=True)
    return result.stdout if binary else result.stdout.decode("utf-8")


def until(predicate, timeout=20):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if predicate():
            return
        time.sleep(.1)
    raise TimeoutError("Expected browser state did not arrive")


def microphone(page):
    page.evaluate("""() => {
      window.__micTracks=[];
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
        getUserMedia:async()=> {
          const c=new AudioContext(); await c.resume();
          const o=c.createOscillator(), g=c.createGain(), d=c.createMediaStreamDestination();
          o.frequency.value=880;g.gain.value=.22;
          o.connect(g);g.connect(d);o.start();
          window.__micTracks.push(...d.stream.getAudioTracks());
          return d.stream;
        }
      }});
    }""")


def ffprobe(path):
    return json.loads(execute(["ffprobe","-v","error","-show_format","-show_streams",
                               "-of","json",str(path)]))


def rms_in_interval(raw, rate, center):
    values = array("h")
    start = max(0, int((center - .2) * rate) * 2)
    end = min(len(raw), int((center + .2) * rate) * 2)
    values.frombytes(raw[start:end])
    if not values:
        raise AssertionError("Audio has no samples near recording pause")
    return math.sqrt(sum(v*v for v in values)/len(values))/32768.


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--html",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--chromium",default="/usr/bin/chromium")
    parser.add_argument("--long-recording",action="store_true",help="Also record and decode over 90 seconds in real time")
    options=parser.parse_args()
    options.output.mkdir(parents=True,exist_ok=True)
    source=options.output/"dynamic-5s.webm"
    if not source.exists():
        execute(["ffmpeg","-v","error","-y","-f","lavfi","-i",
                 "testsrc2=size=480x270:rate=20:duration=5","-an",
                 "-c:v","libvpx","-deadline","realtime","-cpu-used","6",
                 "-b:v","600k","-pix_fmt","yuv420p",str(source)])
    html=options.html.read_text(encoding="utf-8")
    results={}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=options.chromium,
            args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])
        for width,height in [(320,568),(360,740),(390,844),(844,390),(1280,800)]:
            context=browser.new_context(viewport={"width":width,"height":height},accept_downloads=True)
            page=context.new_page()
            errors,requests=[],[]
            page.on("pageerror",lambda e: errors.append(str(e)))
            page.on("request",lambda r: requests.append(r.url) if r.url.startswith(("https:","http:")) else None)
            page.set_content(html,wait_until="domcontentloaded")
            microphone(page)
            page.locator("#ptFile").set_input_files(str(source))
            try:
                page.locator("#ptStart").wait_for(state="visible",timeout=15000)
            except Exception as error:
                state=page.evaluate("""() => ({
                  phase: document.querySelector('#ptInputPanel')?.hidden,
                  inputError: document.querySelector('#ptInputError')?.textContent,
                  inputErrorHidden: document.querySelector('#ptInputError')?.hidden,
                  videoError: document.querySelector('#ptVideo')?.error?.code,
                  readyState: document.querySelector('#ptVideo')?.readyState,
                  appPhase: document.querySelector('#ptScreenAnnouncement')?.textContent,
                  diagnostics: document.querySelector('#ptLog')?.textContent
                })""")
                page.screenshot(path=str(options.output/f"failed-load-{width}.png"),full_page=True)
                raise AssertionError(f"Source failed to load in Chromium at {width}: {state}; errors={errors}") from error
            assert page.locator('[data-draw-tool="pen"]').get_attribute("aria-pressed")=="true"
            assert page.locator('[data-draw-tool="point"]').get_attribute("aria-pressed")=="false"
            layout=page.evaluate("""() => {
              const canvas=document.querySelector('#ptCanvas').getBoundingClientRect(),
                bar=document.querySelector('#ptTransport').getBoundingClientRect();
              return {gap:bar.top-canvas.bottom, width:document.documentElement.scrollWidth,
                transport:getComputedStyle(document.querySelector('#ptTransport')).position,
                diagnosticsHidden:document.querySelector('#ptDiagnosticsSection').hidden,
                buildHidden:document.querySelector('#ptBuildInfoSection').hidden,
                heroVisible:!!document.querySelector('.page-intro').getClientRects().length,
                stepsVisible:!!document.querySelector('#ptSteps').getClientRects().length,
                currentStep:document.querySelector('#ptSteps [aria-current="step"]').dataset.step,
                recordLimit:document.querySelector('#ptRecordClock').textContent};
            }""")
            assert layout["gap"] >= 0 and layout["gap"] < 28,layout
            assert layout["width"] <= width+1,layout
            assert layout["transport"] == "static",layout
            assert layout["diagnosticsHidden"] and layout["buildHidden"],layout
            assert layout["heroVisible"] and layout["stepsVisible"],layout
            assert layout["currentStep"]=="2" and layout["recordLimit"].endswith("10:00"),layout
            if width in (320,1280):
                page.locator("#ptStart").click()
                until(lambda:not page.locator("#ptStop").is_disabled())
                until(lambda:page.locator("#ptVideo").evaluate("(v)=>v.currentTime")>.4)
                # Pause source; voice + recorder continue. Point click adds a ring.
                page.locator("#ptPlayPause").click()
                source_time=page.locator("#ptVideo").evaluate("(v)=>v.currentTime")
                page.locator('[data-draw-tool="point"]').click()
                canvas=page.locator("#ptCanvas").bounding_box()
                page.mouse.click(canvas["x"]+canvas["width"]*.45,
                                 canvas["y"]+canvas["height"]*.48)
                assert not page.locator("#ptDrawUndo").is_disabled()
                page.keyboard.press("Control+z")
                assert not page.locator("#ptDrawRedo").is_disabled()
                page.keyboard.press("Control+y")
                assert not page.locator("#ptDrawUndo").is_disabled()
                page.locator("#ptDrawClear").click()
                page.keyboard.press("Control+z")
                assert not page.locator("#ptDrawClear").is_disabled()
                page.wait_for_timeout(1500)
                paused_source=page.locator("#ptVideo").evaluate("(v)=>v.currentTime")
                assert abs(source_time-paused_source)<.05,(source_time,paused_source)
                page.locator("#ptPlayPause").click()
                until(lambda:page.locator("#ptVideo").evaluate("(v)=>v.currentTime")>source_time+.45)
                assert page.locator("#ptDrawUndo").is_disabled()
                assert page.locator("#ptSeek").is_enabled()
                # Scrubbing in a live capture pauses only source playback.
                page.locator("#ptSeek").evaluate("""el=>{
                  el.value='400'; el.dispatchEvent(new Event('input',{bubbles:true}));
                }""")
                until(lambda:abs(page.locator("#ptVideo").evaluate("(v)=>v.currentTime")-2.0)<.18)
                assert page.locator("#ptVideo").evaluate("(v)=>v.paused")
                assert page.locator("#ptSeekNote").is_visible()
                assert page.locator("#ptStop").is_enabled()
                # Cancel while paused: recording must stay active.
                page.locator("#ptStop").click()
                page.locator("#appConfirmDialog").wait_for(state="visible")
                assert page.locator("#appConfirmTitle").inner_text() in ("録画を終了しますか？","Finish recording?")
                page.locator("#appConfirmCancel").click()
                assert page.locator("#ptStop").is_enabled()
                page.locator("#ptPlayPause").click()
                until(lambda:not page.locator("#ptVideo").evaluate("(v)=>v.paused"))
                # Finish while playing: dialog pauses the source; cancel resumes it.
                page.locator("#ptStop").click()
                page.locator("#appConfirmDialog").wait_for(state="visible")
                assert page.locator("#ptVideo").evaluate("(v)=>v.paused")
                page.locator("#appConfirmCancel").click()
                until(lambda:not page.locator("#ptVideo").evaluate("(v)=>v.paused"))
                page.locator("#ptStop").click()
                page.locator("#appConfirmOk").click()
                page.locator("#ptResultPanel").wait_for(state="visible",timeout=25000)
                assert page.locator('#ptSteps [aria-current="step"]').get_attribute("data-step")=="3"
                with page.expect_download() as dl:
                    page.locator("#ptDownload").click()
                download=dl.value
                output=options.output/f"{width}-result.webm"
                download.save_as(output)
                metadata=ffprobe(output)
                streams={x["codec_type"]:x for x in metadata["streams"]}
                assert "video" in streams and "audio" in streams,metadata
                # A real audio track with decodable PCM, not merely a header.
                pcm=execute(["ffmpeg","-v","error","-i",str(output),"-vn",
                             "-ac","1","-ar","48000","-f","s16le","-"],binary=True)
                voice=rms_in_interval(pcm,48000,1.4)
                assert voice>.01,voice
                live=page.evaluate("window.__micTracks.filter(t=>t.readyState==='live').length")
                assert live==0,live
                layout["recording"]={"bytes":output.stat().st_size,
                    "videoCodec":streams["video"]["codec_name"],
                    "audioCodec":streams["audio"]["codec_name"],
                    "sourceFrozenAt":source_time,"sourceStillAt":paused_source,
                    "voiceRMS":voice,"liveMicTracks":live}
            assert not errors and not requests,{"errors":errors,"network":requests}
            results[f"{width}x{height}"]=layout
            context.close()
        # Explicit paused-first-frame mode does not automatically start playback.
        context=browser.new_context(accept_downloads=True)
        page=context.new_page()
        page.set_content(html)
        microphone(page)
        page.locator("#ptFile").set_input_files(str(source))
        page.locator("#ptStart").wait_for(state="visible")
        page.locator("#ptStartPaused").check()
        page.locator("#ptStart").click()
        until(lambda:not page.locator("#ptStop").is_disabled())
        page.wait_for_timeout(500)
        assert page.locator("#ptVideo").evaluate("(v)=>v.paused && v.currentTime < .1")
        page.locator("#ptStop").click()
        page.locator("#appConfirmOk").click()
        page.locator("#ptResultPanel").wait_for(state="visible",timeout=25000)
        results["pausedFirstFrame"]=True
        context.close()
        if options.long_recording:
            context=browser.new_context(accept_downloads=True)
            page=context.new_page()
            page.set_content(html)
            microphone(page)
            page.locator("#ptFile").set_input_files(str(source))
            page.locator("#ptStartPaused").check()
            page.locator("#ptStart").click()
            until(lambda:not page.locator("#ptStop").is_disabled())
            page.wait_for_timeout(95_000)
            assert page.locator("#ptStop").is_visible() and page.locator("#ptStop").is_enabled(), "Stopped before 95 seconds"
            assert page.locator("#ptRecordClock").inner_text().endswith("10:00")
            page.locator("#ptStop").click()
            page.locator("#appConfirmOk").click()
            page.locator("#ptResultPanel").wait_for(state="visible",timeout=25000)
            with page.expect_download() as dl:
                page.locator("#ptDownload").click()
            output=options.output/"long-95s-result.webm"
            dl.value.save_as(output)
            metadata=ffprobe(output)
            duration=float(metadata["format"].get("duration") or 0)
            assert duration>=92, f"Output truncated before 90s: {duration}"
            assert {"video","audio"} <= {t["codec_type"] for t in metadata["streams"]}
            results["longRecording"]={"outputSeconds":duration,"bytes":output.stat().st_size}
            context.close()
        browser.close()
    output=options.output/"ux-smoke-report.json"
    output.write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding="utf-8")
    print("PASS: "+str(output))


if __name__=="__main__":
    main()
