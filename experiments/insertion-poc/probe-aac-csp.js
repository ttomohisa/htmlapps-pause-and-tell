// CI-only compatibility check. Never bundled into the app or public preview.
import {registerAacEncoder} from '@mediabunny/aac-encoder';
import {Output,Mp4OutputFormat,BufferTarget,AudioBufferSource,Quality,canEncodeAudio} from 'mediabunny';
window.runAacCspProbe=async()=>{
  registerAacEncoder();
  const advertised=await canEncodeAudio('aac',{sampleRate:48000,numberOfChannels:2,quality:new Quality({bitrate:96000})});
  const output=new Output({format:new Mp4OutputFormat(),target:new BufferTarget()});
  const audio=new AudioBufferSource({codec:'aac',quality:new Quality({bitrate:96000})});output.addAudioTrack(audio);
  try {
    await output.start();
    await audio.add(new AudioBuffer({length:4800,sampleRate:48000,numberOfChannels:2}));
    await output.finalize();
    return {advertised,status:'UNEXPECTED_SUCCESS'};
  }catch(error){
    // Page is closed after the report even if a third-party worker cleanup stalls.
    void output.cancel().catch(()=>{});
    return {advertised,status:'BLOCKED',error:String(error)};
  }
};
