#!/usr/bin/env python3
"""Optional offline G9 Chromium regression; NOT a real device/mic test.

Requirements: Python playwright, ffmpeg/ffprobe, installed Chromium executable.
Run:
  python tests/g9-browser-regression.py --html dist/index.html --out ./g9-output --chromium /path/to/chromium

This harness uses a synthetic microphone and page.set_content, so it cannot
verify real microphone permissions, file://, HTTPS, or native file sharing.
It does not run during routine GitHub Actions; keep it manual to avoid costly
browser downloads on every commit.
"""
import argparse
import json
import subprocess
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

CASES = [
    ("landscape", 0), ("landscape", 1),
    ("landscape", 3), ("landscape", 10),
    ("portrait", 3), ("square", 1), ("rotated", 1),
]
SIZES = {"landscape": "480x270", "portrait": "270x480", "square": "360x360"}


def run_command(argv):
    return subprocess.run(argv, capture_output=True, text=True, check=True).stdout


def generate_fixtures(folder):
    folder.mkdir(parents=True, exist_ok=True)
    for name, size in SIZES.items():
        path = folder / f"{name}-5s.mp4"
        if not path.exists():
            run_command(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                         "-f", "lavfi", "-i", f"testsrc2=size={size}:rate=15:duration=5",
                         "-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30",
                         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(path)])
    rotated = folder / "rotated-5s.mp4"
    # The rotation flag MUST be before -i; -metadata:s:v rotate=90 on output
    # can silently produce a video with NO rotation side data in current FFmpeg.
    if not rotated.exists():
        run_command(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                     "-display_rotation:v:0", "90", "-i", str(folder / "landscape-5s.mp4"),
                     "-map", "0", "-c", "copy", str(rotated)])
    meta = json.loads(run_command(["ffprobe", "-v", "error", "-show_streams",
                                    "-of", "json", str(rotated)]))
    rotations = [d.get("rotation") for stream in meta.get("streams", [])
                 for d in stream.get("side_data_list", [])]
    if 90 not in rotations and -90 not in rotations:
        raise RuntimeError("Rotated fixture is missing actual display matrix metadata")


def poll(predicate, seconds=30):
    limit = time.monotonic() + seconds
    while not predicate():
        if time.monotonic() > limit:
            raise TimeoutError("Timed out waiting for browser state")
        time.sleep(.12)


def fake_microphone(page):
    page.evaluate("""() => {
      window.__testMicTracks=[];
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{
        const ctx=new AudioContext();await ctx.resume();
        const osc=ctx.createOscillator(),gain=ctx.createGain(),dst=ctx.createMediaStreamDestination();
        osc.frequency.value=880;gain.gain.value=.1;
        osc.connect(gain);gain.connect(dst);osc.start();
        window.__testMicTracks.push(...dst.stream.getAudioTracks());
        return dst.stream;
      }}});
    }""")


def run_case(browser, html, source, target, name, pauses):
    viewport = {"width": 390, "height": 844} if name == "portrait" else {"width": 1280, "height": 900}
    context = browser.new_context(viewport=viewport, accept_downloads=True)
    page = context.new_page()
    page.set_default_timeout(35000)
    errors, external = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: external.append(r.url)
            if r.url.startswith(("http:", "https:")) else None)
    page.set_content(html, wait_until="domcontentloaded")
    fake_microphone(page)
    page.locator("#ptFile").set_input_files(str(source))
    page.locator("#ptStart").wait_for(state="visible", timeout=20000)
    canvas = page.locator("#ptCanvas").evaluate("(v)=>[v.width,v.height]")
    page.locator("#ptStart").click()
    poll(lambda: not page.locator("#ptStop").is_disabled())
    if page.locator("#ptStartPaused").is_checked():
        raise AssertionError("Record & play should be the default")
    duration = page.locator("#ptVideo").evaluate("(v)=>v.duration")
    # v0.9.1 Record & play starts source motion automatically.
    poll(lambda: page.locator("#ptVideo").evaluate("(v)=>!v.paused && v.currentTime>.05"),
         duration + 15)
    pause_positions = []
    for i in range(pauses):
        destination = duration * (i + 1) / (pauses + 1)
        poll(lambda: page.locator("#ptVideo").evaluate("(v)=>v.currentTime") >= destination,
             duration + 15)
        page.locator("#ptPlayPause").click()  # pause SOURCE, never MediaRecorder
        value = page.locator("#ptVideo").evaluate("(v)=>v.currentTime")
        time.sleep(.16)
        if abs(page.locator("#ptVideo").evaluate("(v)=>v.currentTime") - value) > .2:
            raise AssertionError("Source advanced during pause")
        pause_positions.append(value)
        page.locator("#ptPlayPause").click()  # resume source
    poll(lambda: page.locator("#ptVideo").evaluate("(v)=>v.ended || v.currentTime>=v.duration-.03"),
         duration + 25)
    page.locator("#ptStop").click()
    page.locator("#appConfirmDialog").wait_for(state="visible")
    page.locator("#appConfirmOk").click()
    page.locator("#ptResultPanel").wait_for(state="visible", timeout=35000)
    with page.expect_download(timeout=20000) as download:
        page.locator("#ptDownload").click()
    output = target / f"{name}-pauses-{pauses}.webm"
    download.value.save_as(output)
    metadata = json.loads(run_command(["ffprobe", "-v", "error", "-show_format",
                                        "-show_streams", "-of", "json", str(output)]))
    streams = {stream["codec_type"]: stream for stream in metadata["streams"]}
    if "video" not in streams or "audio" not in streams:
        raise AssertionError("Missing encoded audio or video")
    video = streams["video"]
    if [video["width"], video["height"]] != canvas:
        raise AssertionError("Export dimensions do not match recording Canvas")
    if errors or external:
        raise AssertionError({"js_errors": errors, "network": external})
    live = page.evaluate("window.__testMicTracks.filter(t=>t.readyState==='live').length")
    if live:
        raise AssertionError("Synthetic microphone tracks leaked")
    context.close()
    return {"case": name, "pauses": pauses, "input": source.name,
            "sourceCanvas": canvas, "outputVideo": [video["width"], video["height"]],
            "videoCodec": video["codec_name"], "audioCodec": streams["audio"]["codec_name"],
            "outputBytes": output.stat().st_size, "sourcePausedAt": pause_positions,
            "liveMicTracksAfter": live, "jsErrors": errors, "httpRequests": external}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    generate_fixtures(args.out)
    html = args.html.read_text(encoding="utf-8")
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True, executable_path=args.chromium,
            args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        for name, pauses in CASES:
            print(f"Running {name} with {pauses} pauses...", flush=True)
            result = run_case(browser, html, args.out / f"{name}-5s.mp4",
                              args.out, name, pauses)
            results.append(result)
            print("PASS", name, pauses, result["outputBytes"], flush=True)
        browser.close()
    path = args.out / "g9_matrix.json"
    path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"ALL {len(results)} CASES PASSED: {path}")


if __name__ == "__main__":
    main()
