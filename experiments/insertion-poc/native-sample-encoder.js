// Native-only, synthetic-only laboratory. No optional codec registration.
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, Quality, canEncodeVideo, canEncodeAudio } from 'mediabunny';
export async function encodeNativeSample(signal) {
  const quality=new Quality({bitrate:900000}),audioQuality=new Quality({bitrate:96000});
  const check=()=>{if(signal.aborted)throw Error('Encoding canceled');};
  const avc=await canEncodeVideo('avc',{width:320,height:180,frameRate:15,quality});check();
  const aac=await canEncodeAudio('aac',{numberOfChannels:2,sampleRate:48000,quality:audioQuality});check();
  if(!avc||!aac)throw Error(`Native AVC: ${avc?'候補あり':'利用不可'} / Native AAC: ${aac?'候補あり':'利用不可'}。両方が必要です。`);
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Canvas unavailable');
  const target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat(),target});
  const video=new CanvasSource(canvas,{codec:'avc',quality});
  const audio=new AudioBufferSource({codec:'aac',quality:audioQuality});
  output.addVideoTrack(video,{frameRate:15});output.addAudioTrack(audio);
  const cancel=()=>{if(output.state!=='finalized'&&output.state!=='canceled')void output.cancel().catch(()=>{});};
  signal.addEventListener('abort',cancel,{once:true});
  try {
    check();await output.start();check();
    const buffer=new AudioBuffer({length:96000,sampleRate:48000,numberOfChannels:2});
    for(let channel=0;channel<2;channel++){
      const data=buffer.getChannelData(channel);
      for(let i=48000;i<data.length;i++)data[i]=.25*Math.sin(2*Math.PI*(channel?660:440)*i/48000);
    }
    await audio.add(buffer);check();
    for(let frame=0;frame<30;frame++){
      ctx.fillStyle=frame<15?'#ff0000':'#00ff00';ctx.fillRect(0,0,320,180);
      await video.add(frame/15,1/15,{keyFrame:frame===0||frame===15});check();
    }
    await output.finalize();check();
    return new Blob([target.buffer],{type:'video/mp4'});
  }catch(error){cancel();throw error;}
  finally{signal.removeEventListener('abort',cancel);}
}
