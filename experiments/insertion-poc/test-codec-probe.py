#!/usr/bin/env python3
"""Opt-in synthetic AVC/AAC feasibility; unsupported is a finding, never a product pass."""
import argparse,base64,json,math,subprocess
from array import array
from pathlib import Path
from playwright.sync_api import sync_playwright

def command(args):return subprocess.run(args,capture_output=True,check=True).stdout

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8765/codec-probe.html');parser.add_argument('--chromium',default='/usr/bin/chromium');parser.add_argument('--out',type=Path,required=True);parser.add_argument('--require-aac',action='store_true');a=parser.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=a.chromium,headless=True,args=['--no-sandbox'])
        try:
            context=browser.new_context();page=context.new_page();errors=[];external=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            context.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith('http://127.0.0.1:') else None)
            page.goto(a.url,wait_until='load')
            report=page.evaluate("Promise.race([runCodecProbe(),new Promise(resolve=>setTimeout(()=>resolve({status:'ENCODE_FAILED',error:'30-second laboratory timeout'}),30000))])")
        finally:
            browser.close()
    encoded=report.pop('base64',None);report.update(pageErrors=errors,externalRequests=external)
    if encoded:
        path=a.out/'probe.mp4';path.write_bytes(base64.b64decode(encoded))
        probe=json.loads(command(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))
        report['ffprobe']=probe;streams={s['codec_type']:s for s in probe['streams']}
        assert streams['video']['codec_name']=='h264';assert streams['video']['width']==320 and streams['video']['height']==180
        assert abs(float(probe['format']['duration'])-2)<.15
        for t,channel in ((.5,0),(1.5,1)):
            rgb=command(['ffmpeg','-v','error','-i',str(path),'-ss',str(t),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-threads','1','-'])
            means=[sum(rgb[c::3])/len(rgb[c::3]) for c in range(3)];assert means[channel]>200 and means[1-channel]<40,means
        rgb=command(['ffmpeg','-v','error','-i',str(path),'-an','-f','rawvideo','-pix_fmt','rgb24','-threads','1','-'])
        frame_bytes=320*180*3
        assert len(rgb)==30*frame_bytes,len(rgb)
        green_frames=[i for i in range(30) if sum(rgb[i*frame_bytes+1:(i+1)*frame_bytes:3])/(320*180)>200]
        assert green_frames and green_frames[0]==15,green_frames
        report['videoTransitionSeconds']=green_frames[0]/15
        if report['aac']:
            assert streams['audio']['codec_name']=='aac' and streams['audio']['channels']==2
            pcm=array('h');pcm.frombytes(command(['ffmpeg','-v','error','-i',str(path),'-vn','-ac','2','-ar','48000','-f','s16le','-']))
            rms=lambda x:math.sqrt(sum(v*v for v in x)/len(x))/32768
            def tone(samples,hz):
                values=samples[60000:72000]
                real=sum(v*math.cos(2*math.pi*hz*i/48000) for i,v in enumerate(values))
                imag=sum(v*math.sin(2*math.pi*hz*i/48000) for i,v in enumerate(values))
                return 2*math.hypot(real,imag)/len(values)/32768
            channel_onsets=[]
            for index,expected,other in ((0,440,660),(1,660,440)):
                channel=pcm[index::2]
                assert rms(channel[12000:24000])<.01 and rms(channel[60000:72000])>.1
                assert tone(channel,expected)>.15 and tone(channel,other)<.03,(index,tone(channel,expected),tone(channel,other))
                onsets=[i/48000 for i in range(47000,50000,240) if rms(channel[i:i+240])>.05]
                assert onsets and abs(onsets[0]-report['videoTransitionSeconds'])<.08,onsets
                channel_onsets.append(onsets[0])
            report['audioOnsetSeconds']=channel_onsets[0]
            report['channelOnsetsSeconds']=channel_onsets
        else:assert 'audio' not in streams
    (a.out/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='ffprobe'}))
    assert not errors and not external
    assert report['status']!='ENCODE_FAILED',report
    if a.require_aac:assert report['status']=='ENCODED_AVC_AAC',report
if __name__=='__main__':main()
