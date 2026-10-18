#!/usr/bin/env python3
"""Real unsupported codec route + UI transaction fixture; no native AAC success claim."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    try:
        page=browser.new_page();errors=[];external=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith('http://127.0.0.1:') else None)
        page.goto('http://127.0.0.1:8765/native-mp4.html');assert page.locator('#save').is_hidden()
        page.locator('#generate').click();page.wait_for_function("document.querySelector('#status').dataset.result==='failed'")
        assert page.locator('#save').is_hidden();assert not page.locator('#generate').is_disabled()
        actual=page.locator('#status').inner_text()
        page.goto('http://127.0.0.1:8765/native-mp4-ui-test.html')
        # A tiny fixture blob tests UI ownership only; it is deliberately not a valid media success.
        page.evaluate("() => { window.testEncode=async()=>new Blob(['fixture-only'],{type:'video/mp4'}); }")
        page.locator('#generate').click();page.wait_for_function("document.querySelector('#status').dataset.result==='success'")
        previous=page.locator('#save').get_attribute('href');assert previous.startswith('blob:')
        assert page.locator('#saveStatus').inner_text()==''
        with page.expect_download() as download:page.locator('#save').click()
        assert download.value.suggested_filename=='pause-tell-native-synthetic-2s.mp4'
        assert '保存完了' in page.locator('#saveStatus').inner_text()
        page.evaluate("() => { window.testEncode=async()=>{throw Error('injected failure')}; }")
        page.locator('#generate').click();page.wait_for_function("document.querySelector('#status').dataset.result==='failed'")
        assert page.locator('#save').get_attribute('href')==previous
        assert page.locator('#video').get_attribute('src')==previous
        assert '前回成功' in page.locator('#status').inner_text()
        page.screenshot(path=str(a.out/'failure-retains-result.png'))
        # Static mode guide reuses this browser; no extra media encode or suite.
        page.set_content((Path(__file__).parent/'modes.html').read_text())
        assert page.locator('meta[name="robots"]').get_attribute('content')=='noindex,nofollow'
        for href in ['/', '/insertion-poc/']:
            link=page.locator(f'a[href="{href}"]')
            assert link.get_attribute('target')=='_blank'
            assert 'noopener' in link.get_attribute('rel')
        for width in [390,1280]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            for link in page.locator('a.open').all():
                assert link.bounding_box()['height']>=44
            page.screenshot(path=str(a.out/f'mode-guide-{width}.png'),full_page=True)
        assert not errors and not external,(errors,external)
        (a.out/'report.json').write_text(json.dumps({'realNativeUnsupported':actual,'uiFixtureOnly':True,'saveSeparate':True,'failurePreservesPrevious':True,'pageErrors':errors,'externalRequests':external},ensure_ascii=False,indent=2))
        print('PASS: real unsupported route, separate save, failed retry preserves prior synthetic fixture; no native AAC success claim')
    finally:browser.close()
