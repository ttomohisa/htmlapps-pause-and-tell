// Opt-in laboratory only. Not imported by the insertion app or normal v0.9.3.
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource,
  Quality, canEncodeVideo, canEncodeAudio } from 'mediabunny';
window.runCodecProbe = async () => {
  const videoConfig={width:320,height:180,frameRate:15,quality:new Quality({bitrate:900000})};
  const audioConfig={numberOfChannels:2,sampleRate:48000,quality:new Quality({bitrate:96000})};
  const avc=await canEncodeVideo('avc',videoConfig);
  const aac=await canEncodeAudio('aac',audioConfig);
  const report={browser:navigator.userAgent,avc,aac,
    recordingCandidates:['audio/webm;codecs=opus','audio/mp4;codecs=mp4a.40.2','video/mp4;codecs=avc1.42E01E,mp4a.40.2']
      .map(type=>({type,supported:typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(type)})),
    productMp4Support:false};
  if(!avc)return {...report,status:'UNSUPPORTED_AVC',reason:'No AVC encoder for the exact probe configuration'};
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
  const ctx=canvas.getContext('2d',{alpha:false});
  const target=new BufferTarget();
  const output=new Output({format:new Mp4OutputFormat(),target});
  const video=new CanvasSource(canvas,{codec:'avc',quality:videoConfig.quality});
  output.addVideoTrack(video,{frameRate:15});
  let audio;
  if(aac) {audio=new AudioBufferSource({codec:'aac',quality:audioConfig.quality});output.addAudioTrack(audio);}
  try {
    await output.start();
    if(audio){
      const buffer=new AudioBuffer({length:96000,sampleRate:48000,numberOfChannels:2});
      for(let channel=0;channel<2;channel++){
        const data=buffer.getChannelData(channel);
        for(let i=0;i<data.length;i++)data[i]=i>=48000?.25*Math.sin(2*Math.PI*(channel?660:440)*i/48000):0;
      }
      await audio.add(buffer);
    }
    for(let frame=0;frame<30;frame++){
      ctx.fillStyle=frame<15?'#ff0000':'#00ff00';ctx.fillRect(0,0,320,180);
      await video.add(frame/15,1/15,{keyFrame:frame===0||frame===15});
    }
    await output.finalize();
    let binary='';for(const byte of new Uint8Array(target.buffer))binary+=String.fromCharCode(byte);
    return {...report,status:aac?'ENCODED_AVC_AAC':'ENCODED_AVC_ONLY',
      warning:aac?'Synthetic encoding only; no phone, insertion or OS save claim.':'AAC encoder missing. Silent MP4 is not a usable narration output.',
      base64:btoa(binary),bytes:target.buffer.byteLength};
  }catch(error){
    if(output.state!=='finalized'&&output.state!=='canceled')await output.cancel().catch(()=>{});
    return {...report,status:'ENCODE_FAILED',error:String(error)};
  }
};
