#!/usr/bin/env python3
"""Verify the current app CSP rejects the optional AAC worker; no CSP relaxation."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--chromium',default='/usr/bin/chromium');p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path=a.chromium,headless=True,args=['--no-sandbox'])
    page=browser.new_page();external=[];console=[]
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith('http://127.0.0.1:') else None)
    page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
    page.goto('http://127.0.0.1:8765/aac-csp-probe.html')
    report=page.evaluate("Promise.race([runAacCspProbe(),new Promise(resolve=>setTimeout(()=>resolve({status:'TIMEOUT'}),10000))])")
    report.update(externalRequests=external,consoleErrors=console,browser=browser.version,productSupport=False)
    browser.close()
(a.out/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
assert report['status']=='BLOCKED',report
assert 'worker' in report.get('error','').lower() and any('worker-src' in m for m in console),report
assert not external
