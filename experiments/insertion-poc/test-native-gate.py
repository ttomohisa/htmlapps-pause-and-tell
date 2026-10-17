#!/usr/bin/env python3
"""Milestone gate: native candidate queries only, never a successful media claim."""
import argparse,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=a.chromium,headless=True)
    try:
        page=browser.new_page();errors=[];external=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith('http://127.0.0.1:') else None)
        page.goto('http://127.0.0.1:8765/index.html')
        page.locator('#nativeSupportPanel summary').click();page.locator('#checkNativeSupport').click()
        page.wait_for_function("document.querySelector('#nativeSupportResult').dataset.ready==='true'")
        status=page.locator('#nativeSupportResult').inner_text()
        ready=status=='Native AVC: 候補あり / Native AAC: 候補あり'
        report={'status':'NATIVE_CANDIDATES_AVAILABLE' if ready else 'NATIVE_UNSUPPORTED_OR_UNCONFIRMED','query':status,'browser':browser.version,'mediaPass':False,'pageErrors':errors,'externalRequests':external}
        assert not errors and not external,report
        (a.out/'native-gate.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=True))
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'],'a',encoding='utf-8') as f:f.write(f'ready={str(ready).lower()}\n')
    finally:browser.close()
