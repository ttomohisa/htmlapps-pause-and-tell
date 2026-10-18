#!/usr/bin/env python3
"""CI-only Japanese visual evidence for the original and insertion shells.

Uses the workflow's existing localhost server. Does not start another server,
request microphone access, publish files, or require pixel equality between
different workflows. The temporary original HTML is always removed.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlsplit


BASELINE_COMMIT = '07d044acd712519a95f6005b8389d799d3885b9e'
BASELINE_SHA256 = '7a4ed05e43163555565cb318a618684759b8b98d3bf59f167518a0d373d9463e'
BASELINE_FILENAME = '_visual-baseline-07d044a.html'
VIEWPORTS = {'desktop': {'width': 1180, 'height': 800},
             'mobile': {'width': 390, 'height': 844}}
# Kept here because Actions' shallow checkout need not contain the old commit.
# The actual original HTML/CSS/JS is read from the hash-pinned historical source.
BASELINE_CONFIG = {
    'name': 'Pause & Tell', 'nameJa': 'Pause & Tell｜動画解説レコーダー',
    'slug': 'pause-and-tell', 'version': '0.9.3', 'defaultLanguage': 'auto',
    'description': 'Seek while recording, default pen and safe finish-confirmation dialog in a local narration recorder.',
    'descriptionJa': '録画中の位置移動に対応。初期ツールはペン、録画終了は確認ダイアログで確定。元動画は端末内で処理。',
    'repository': {'owner': 'ttomohisa', 'name': 'htmlapps-pause-and-tell'},
    'build': {'output': 'dist/index.html', 'blockRuntimeNetwork': True,
              'selfExtract': {'enabled': True, 'output': 'dist/index.self-extract.html'},
              'sizeBudget': {'readableWarningMb': 25, 'selfExtractWarningMb': 12}},
}


def safe_json(value):
    return (json.dumps(value, ensure_ascii=True, separators=(',', ':'))
            .replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026'))


def render_baseline(template_bytes, icon):
    digest = hashlib.sha256(template_bytes).hexdigest()
    if digest != BASELINE_SHA256:
        raise AssertionError('Historical template changed; review the baseline explicitly: ' + digest)
    template = template_bytes.decode('utf-8')
    manifest = {
        'schemaVersion': 2, 'builder': 'single-html-app-template/1.3',
        'generatedAtUtc': '2026-10-18T00:00:00Z',
        'app': {key: BASELINE_CONFIG[key] for key in ('name', 'slug', 'version')},
        'dependencies': [],
    }
    replacements = {
        '__APP_CONFIG_JSON__': (safe_json(BASELINE_CONFIG), 1),
        '__BUILD_MANIFEST_JSON__': (safe_json(manifest), 1),
        '__EMBEDDED_ASSET_BUNDLE_JSON__': (safe_json({'schemaVersion': 2, 'dependencies': {}}), 1),
        '__APP_ICON_DATA_URI__': ('data:image/svg+xml;base64,' + base64.b64encode(icon).decode('ascii'), 2),
    }
    for marker, (value, expected) in replacements.items():
        assert template.count(marker) == expected, (marker, template.count(marker))
        template = template.replace(marker, value)
    assert not any(marker in template for marker in replacements)
    return template


GEOMETRY = r"""(selectors) => {
  const rect = (element) => {
    if (!element) return null;
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    const visible = !!element.getClientRects().length && style.visibility !== 'hidden';
    return {visible, x:box.x, y:box.y, width:box.width, height:box.height,
      documentY:box.y+scrollY, bottom:box.bottom, fontFamily:style.fontFamily,
      fontSize:style.fontSize, color:style.color, background:style.backgroundColor,
      borderRadius:style.borderRadius, display:style.display};
  };
  return {viewport:{width:innerWidth,height:innerHeight},
    page:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,scrollY},
    language:document.documentElement.lang, bodyFont:getComputedStyle(document.body).fontFamily,
    elements:Object.fromEntries(Object.entries(selectors).map(([name,selector]) =>
      [name,rect(document.querySelector(selector))]))};
}"""


def capture_variant(browser, url, variant, source, out, report):
    old = variant == 'original'
    selectors = {
        'header': '.app-header', 'headerInner': '.header-inner', 'main': '.main',
        'hero': '.page-intro', 'localBadge': '.local-badge', 'steps': '#ptSteps',
        'inputPanel': '#ptInputPanel' if old else '#sourcePanel',
        'editor': '#ptStudioPanel' if old else '#editor',
        'drawTools': '.pt-draw-tools' if old else '.drawing-tools',
        'stage': '#ptStage' if old else '.stage',
        'transport': '#ptTransport' if old else '.pt-transport',
        'help': '#helpDialog', 'helpBody': '#helpDialog .dialog-body',
    }
    for viewport_name, viewport in VIEWPORTS.items():
        context = browser.new_context(viewport=viewport, locale='ja-JP',
                                      color_scheme='light', reduced_motion='reduce')
        page = context.new_page()
        page.set_default_timeout(20000)
        key = variant + '-' + viewport_name
        result = report['captures'][key] = {'states': {}, 'pageErrors': [], 'externalRequests': []}
        page.on('pageerror', lambda error: result['pageErrors'].append(str(error)))

        def record_request(request):
            parsed = urlsplit(request.url)
            if parsed.scheme in ('http', 'https') and (parsed.scheme, parsed.hostname, parsed.port) != ('http', '127.0.0.1', 8765):
                result['externalRequests'].append(request.url)

        page.on('request', record_request)

        def shot(state):
            page.evaluate('document.fonts.ready')
            assert page.locator('html').get_attribute('lang') == 'ja'
            metrics = page.evaluate(GEOMETRY, selectors)
            assert metrics['page']['width'] <= viewport['width'] + 1, (key, state, metrics['page'])
            filename = key + '-' + state + '.png'
            page.screenshot(path=str(out / filename), full_page=True)
            result['states'][state] = {'screenshot': filename, **metrics}

        try:
            page.goto(url, wait_until='load')
            page.locator('.page-intro').wait_for(state='visible')
            # Real glyph rendering is backed by an installed Japanese CJK font.
            assert page.evaluate("document.fonts.check('15px \"Noto Sans CJK JP\"', '動画説明保存')")
            shot('initial')
            page.locator('#ptFile' if old else '#sourceFile').set_input_files(str(source))
            page.locator('#ptStudioPanel' if old else '#editor').wait_for(state='visible')
            page.wait_for_function("selector => !document.querySelector(selector).disabled",
                                   arg='#ptStart' if old else '#startNote')
            page.wait_for_function("selector => { const v=document.querySelector(selector); return v.readyState>=2 && v.videoWidth>0; }",
                                   arg='#ptVideo' if old else '#sourceVideo')
            # Loading may focus/scroll the editor; use a common page-top framing.
            page.evaluate('window.scrollTo(0,0)')
            page.evaluate('() => new Promise(requestAnimationFrame)')
            shot('loaded')
            page.locator('#helpButton').click()
            page.locator('#helpDialog').wait_for(state='visible')
            shot('help')
            page.keyboard.press('Escape')
            page.locator('#helpDialog').wait_for(state='hidden')
            assert not result['pageErrors'], result['pageErrors']
            assert not result['externalRequests'], result['externalRequests']
        except Exception:
            page.screenshot(path=str(out / (key + '-failure.png')), full_page=True)
            raise
        finally:
            context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8765/index.html')
    parser.add_argument('--out', type=Path, default=Path('insertion-evidence/shell-visual'))
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    args = parser.parse_args()
    # This script must not be used as a workaround for local/cloud browser policy.
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        raise SystemExit('CI-only visual comparison: run in the authorized GitHub Actions job.')
    assert args.url == 'http://127.0.0.1:8765/index.html', 'Use the existing CI localhost server only.'
    font = subprocess.check_output(['fc-match', '-f', '%{family}\n', ':lang=ja'], text=True).strip()
    assert 'Noto Sans CJK' in font, 'Install fonts-noto-cjk before visual capture: ' + font
    root = Path(__file__).resolve().parents[2]
    dist = Path(__file__).resolve().parent / 'dist'
    baseline = dist / BASELINE_FILENAME
    assert (dist / 'index.html').is_file(), 'Build the restored insertion app first.'
    assert not baseline.exists(), 'Refusing to overwrite a pre-existing baseline file.'
    html = render_baseline((root / 'src/index.template.html').read_bytes(),
                           (root / 'assets/favicon.svg').read_bytes())
    args.out.mkdir(parents=True, exist_ok=True)
    out = args.out.resolve()
    source = out / 'synthetic-4s.webm'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                    'testsrc2=size=640x360:rate=15:duration=4', '-an', '-c:v', 'libvpx',
                    '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '500k', str(source)], check=True)
    report = {'baselineCommit': BASELINE_COMMIT, 'baselineSourceSha256': BASELINE_SHA256,
              'baselineHtmlSha256': hashlib.sha256(html.encode('utf-8')).hexdigest(),
              'japaneseFont': font, 'viewports': VIEWPORTS,
              'comparison': 'Visual/geometry evidence, not pixel equality or physical-device validation.',
              'captures': {}}
    created_baseline = False
    try:
        # Exclusive creation prevents accidentally taking ownership of another file.
        with baseline.open('x', encoding='utf-8') as handle:
            created_baseline = True
            handle.write(html)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.chromium, headless=True,
                args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
            try:
                capture_variant(browser, 'http://127.0.0.1:8765/' + BASELINE_FILENAME,
                                'original', source, out, report)
                capture_variant(browser, args.url, 'restored', source, out, report)
            finally:
                browser.close()
    finally:
        if created_baseline:
            baseline.unlink(missing_ok=True)
        report['temporaryBaselineRemoved'] = not baseline.exists()
        (out / 'shell-visual-geometry.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'captures': len(report['captures']), 'out': str(out),
                      'baselineRemoved': report['temporaryBaselineRemoved']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
