#!/usr/bin/env python3
"""Failure regressions using real short recordings and narrowly injected API faults.

Build the PoC, serve its dist directory, then run this script. No app internals
or private state are exposed: assertions use controls, playback and downloads.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright, expect


INSTRUMENT = """(() => {
  window.__testTracks = [];
  window.__testRecorders = [];
  window.__testEncodeFailure = false;
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true, value: async () => {
      if(window.__holdMicrophone) await new Promise(resolve => {window.__releaseMicrophone=resolve;});
      const context = new AudioContext();
      await context.resume();
      const wave = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      wave.frequency.value = 800;
      gain.gain.value = .3;
      wave.connect(gain); gain.connect(destination); wave.start();
      window.__testTracks.push(...destination.stream.getTracks());
      return destination.stream;
    }
  });
  const NativeRecorder = window.MediaRecorder;
  window.MediaRecorder = class extends NativeRecorder {
    constructor(...args) {
      super(...args);
      window.__testRecorders.push(this);
    }
  };
  const encode = VideoEncoder.prototype.encode;
  VideoEncoder.prototype.encode = function(...args) {
    if (window.__testEncodeFailure) throw new Error('Injected encoding failure');
    return encode.apply(this, args);
  };
})();"""


def load(page, url, source, output_format="webm"):
    page.goto(url, wait_until='domcontentloaded')
    page.locator('#exportFormat').select_option(output_format)
    expect(page.locator('#exportFormat')).to_be_visible()  # Must be selectable before recording on MP4-only devices.
    page.locator('#language').click()  # English gives readable diagnostic checks.
    page.locator('#sourceFile').set_input_files(str(source))
    expect(page.locator('#editor')).to_be_visible(timeout=25000)
    expect(page.locator('#sourceFile')).to_be_enabled(timeout=25000)


def record_note(page):
    expect(page.locator('#startNote')).to_be_enabled(timeout=25000)
    page.locator('#startNote').click()
    expect(page.locator('#finishNote')).to_be_visible(timeout=15000)
    page.wait_for_timeout(1000)
    page.locator('#finishNote').click()
    expect(page.locator('#noteList .note-item')).to_have_count(1, timeout=25000)
    expect(page.locator('#startNote')).to_be_enabled(timeout=25000)


def note_snapshot(page):
    return {
        'items': page.locator('#noteList .note-item').all_inner_texts(),
        'summary': page.locator('#noteSummary').inner_text(),
        'audio': page.locator('#notePlayer').get_attribute('src'),
    }


def assert_recovered(page, before):
    expect(page.locator('#finishNote')).to_be_hidden(timeout=12000)
    expect(page.locator('#startNote')).to_be_visible()
    for selector in ('#startNote', '#sourceFile', '#seek', '#playSource', '#export'):
        expect(page.locator(selector)).to_be_enabled()
    expect(page.locator('#drawCanvas')).to_be_hidden()
    expect(page.locator('#sourceVideo')).to_be_visible()
    assert note_snapshot(page) == before, 'Completed explanation changed after recording failure'
    assert page.evaluate("__testTracks.every(track => track.readyState === 'ended')"), 'Microphone remains live'
    expect(page.locator('#error')).not_to_have_text('')


def missing_recorder(page, url, source, out):
    load(page, url, source)
    expect(page.locator('#startNote')).to_be_disabled(timeout=5000)
    # A disabled button alone is insufficient: explain the missing capability.
    text = page.locator('body').inner_text()
    assert re.search(r'(MediaRecorder|recording).*(unavailable|unsupported|not supported|requires)|'
                     r'(unavailable|unsupported|not supported|requires).*record', text, re.I | re.S), text
    assert not page.evaluate('__testTracks.length'), 'Preflight requested a microphone'
    assert 'undefined' not in page.locator('#error').inner_text(), 'Raw JavaScript error shown'


def recording_failure(page, url, source, out, kind):
    load(page, url, source)
    record_note(page)
    before = note_snapshot(page)
    page.locator('#startNote').click()
    expect(page.locator('#finishNote')).to_be_visible()
    page.wait_for_timeout(400)
    if kind == 'unexpected_stop':
        # Actual native stop, without the app's explicit Finish operation.
        page.evaluate('__testRecorders.at(-1).stop()')
    else:
        page.evaluate("""() => {
          const event = new Event('error');
          Object.defineProperty(event, 'error', {value:new Error('Injected recorder failure')});
          __testRecorders.at(-1).dispatchEvent(event);
        }""")
    assert_recovered(page, before)
    # Prove retry is usable, rather than merely painting enabled controls.
    page.locator('#startNote').click()
    expect(page.locator('#finishNote')).to_be_visible()
    page.wait_for_timeout(750)
    page.locator('#finishNote').click()
    expect(page.locator('#noteList .note-item')).to_have_count(2, timeout=25000)
    assert page.locator('#noteList .note-item').first.inner_text() == before['items'][0]
    assert page.evaluate("__testTracks.every(track => track.readyState === 'ended')")


def download(page, destination):
    with page.expect_download(timeout=15000) as event:
        page.locator('#save').click()
    event.value.save_as(destination)
    return hashlib.sha256(destination.read_bytes()).hexdigest()


def failed_export_preserves_result(page, url, source, out, output_format="webm"):
    load(page, url, source, output_format)
    record_note(page)
    notes = note_snapshot(page)
    page.locator('#export').click()
    expect(page.locator('#result')).to_be_visible(timeout=100000)
    expect(page.locator('#export')).to_be_enabled(timeout=10000)
    first_url = page.locator('#resultVideo').get_attribute('src')
    first_info = page.locator('#resultInfo').inner_text()
    page.locator('#outputName').fill('my/video?.'+output_format)
    with page.expect_download(timeout=15000) as named:
        page.locator('#save').click()
    assert named.value.suggested_filename == 'my-video-.'+output_format
    expect(page.locator('#share')).to_be_visible()
    page.locator('#share').click()
    expect(page.locator('#saveStatus')).to_contain_text('Sharing cancelled')
    assert page.evaluate('(format) => __sharedFiles[0].name === `my-video-.${format}` && __sharedFiles[0].type === `video/${format}` && __sharedFiles[0].size > 2048',output_format)
    first_hash = download(page, out / ('before-failed-export.'+output_format))
    assert (out / ('before-failed-export.'+output_format)).stat().st_size > 2048
    if output_format=='webm':
        # Selecting an unavailable native MP4 path must not relabel the old WebM.
        page.evaluate('''() => {
          const original = AudioEncoder.isConfigSupported.bind(AudioEncoder);
          AudioEncoder.isConfigSupported = async config => config.codec.startsWith('mp4a')
            ? {supported:false,config} : original(config);
        }''')
        page.locator('#exportFormat').select_option('mp4')
        expect(page.locator('#capabilities')).to_contain_text('encoders unavailable')
        expect(page.locator('#export')).to_be_disabled()
        assert page.locator('#resultExtension').inner_text()=='.webm'
        assert page.locator('#resultVideo').get_attribute('src')==first_url
        assert download(page,out/'after-mp4-selection.webm')==first_hash
        page.locator('#share').click()
        assert page.evaluate('__sharedFiles[0].type === "video/webm" && __sharedFiles[0].name.endsWith(".webm")')
        page.locator('#exportFormat').select_option('webm')
        expect(page.locator('#export')).to_be_enabled()
    page.evaluate('window.__testEncodeFailure = true')
    page.locator('#export').click()
    expect(page.locator('#error')).to_contain_text('Injected encoding failure', timeout=30000)
    expect(page.locator('#export')).to_be_enabled(timeout=15000)
    expect(page.locator('#result')).to_be_visible()
    assert page.locator('#resultVideo').get_attribute('src') == first_url, 'Previous result URL was replaced/revoked'
    assert page.locator('#resultInfo').inner_text() == first_info
    assert note_snapshot(page) == notes, 'Failed export changed completed explanations'
    assert download(page, out / ('after-failed-export.'+output_format)) == first_hash, 'Saved result bytes changed after failure'
    assert page.locator('#resultVideo').evaluate('(v) => v.readyState >= 2 && v.videoWidth > 0'), 'Previous result no longer decodes'


def failed_start(page, url, source, out):
    load(page, url, source)
    page.evaluate("() => { MediaRecorder.prototype.start = function() {throw new Error('Injected start failure');}; }")
    page.locator('#startNote').click()
    expect(page.locator('#error')).to_contain_text('Injected start failure')
    expect(page.locator('#startNote')).to_be_enabled()
    assert page.evaluate('__testTracks.every(t => t.readyState === "ended")')
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    expect(page.locator('#sourceFile')).to_be_enabled()


def hidden_permission_resolution(page, url, source, out):
    load(page, url, source)
    page.evaluate('window.__holdMicrophone = true')
    page.locator('#startNote').click()
    page.wait_for_function('typeof __releaseMicrophone === "function"')
    page.evaluate("""() => {
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
      __releaseMicrophone();
    }""")
    expect(page.locator('#error')).to_contain_text('Return to this page')
    expect(page.locator('#startNote')).to_be_enabled()
    assert page.evaluate('__testTracks.length > 0 && __testTracks.every(t => t.readyState === "ended")')
    assert page.evaluate('__testRecorders.length === 0')


def multiple_recovery(page, url, source, out):
    load(page, url, source)
    for count in (1, 2):
        page.locator('#startNote').click()
        expect(page.locator('#finishNote')).to_be_visible()
        page.wait_for_timeout(600)
        page.evaluate('__testRecorders.at(-1).stop()')
        expect(page.locator('#finishNote')).to_be_hidden(timeout=12000)
        expect(page.locator('#recoveryFiles button')).to_have_count(count)
        expect(page.locator('#noteList .note-item')).to_have_count(0)
    dialogs=[]
    def cancel(dialog):
        dialogs.append(dialog.message)
        dialog.dismiss()
    page.once('dialog', cancel)
    page.locator('#sourceFile').set_input_files(str(source))
    assert len(dialogs) == 1, 'Replacing recovery-only session did not confirm'
    expect(page.locator('#recoveryFiles button')).to_have_count(2)
    assert page.evaluate('__testTracks.every(t => t.readyState === "ended")')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:8765/index.html')
    parser.add_argument('--out', type=Path, default=Path('/tmp/pause-tell-resilience'))
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    parser.add_argument('--case', choices=['missing_recorder', 'unexpected_stop', 'recorder_error', 'failed_export', 'failed_start', 'hidden_permission', 'multiple_recovery'])
    parser.add_argument("--output-format",choices=["webm","mp4"],default="webm",help="Native MP4 milestone failed-export case only")
    args = parser.parse_args()
    if args.output_format=="mp4" and args.case!="failed_export": parser.error("MP4 milestone requires --case failed_export")
    args.out.mkdir(parents=True, exist_ok=True)
    source = args.out / 'synthetic-source.webm'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                    'testsrc2=size=160x90:rate=15:duration=2', '-an', '-c:v', 'libvpx',
                    '-deadline', 'realtime', '-cpu-used', '8', str(source)], check=True)
    cases = {
        'missing_recorder': missing_recorder,
        'unexpected_stop': lambda *a: recording_failure(*a, kind='unexpected_stop'),
        'recorder_error': lambda *a: recording_failure(*a, kind='recorder_error'),
        'failed_export': lambda *items: failed_export_preserves_result(*items,output_format=args.output_format),
        'failed_start': failed_start,
        'hidden_permission': hidden_permission_resolution,
        'multiple_recovery': multiple_recovery,
    }
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium, headless=True,
            args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        for name, test in cases.items():
            if args.case and name != args.case:
                continue
            context = browser.new_context(accept_downloads=True)
            page = context.new_page()
            # Use one init script: Playwright does not define ordering between
            # multiple init scripts, and instrumentation needs the native class.
            injection = INSTRUMENT
            if name == 'missing_recorder':
                injection += "\nObject.defineProperty(window, 'MediaRecorder', {configurable:true, value:undefined});"
            if name == 'failed_export':
                injection += """Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files[0] instanceof File});
                Object.defineProperty(navigator,'share',{configurable:true,value:async ({files})=>{
                  window.__sharedFiles=files;throw new DOMException('Cancelled','AbortError');
                }});"""
            page.add_init_script(injection)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            try:
                test(page, args.url, source, args.out)
                assert not errors, {'uncaughtPageErrors': errors}
                results.append({'case': name, 'status': 'PASS'})
            except Exception as error:
                results.append({'case': name, 'status': 'FAIL', 'error': str(error),
                                'pageErrors': errors})
                page.screenshot(path=str(args.out / (name + '-failure.png')), full_page=True)
            finally:
                context.close()
            print(json.dumps(results[-1], ensure_ascii=False), flush=True)
        browser.close()
    (args.out / 'report.json').write_text(json.dumps(results, indent=2, ensure_ascii=False))
    if any(result['status'] == 'FAIL' for result in results):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
