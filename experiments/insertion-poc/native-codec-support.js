// Advisory native WebCodecs support queries only: no encoder, worker, media or permissions.
const configs={
  avc:{codec:'avc1.42001e',width:320,height:180,framerate:15,bitrate:900000},
  aac:{codec:'mp4a.40.2',sampleRate:48000,numberOfChannels:2,bitrate:96000}
};
async function inspect(api,config,timeoutMs) {
  if(typeof api?.isConfigSupported!=='function')return 'unavailable';
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(()=>api.isConfigSupported({...config})).then(result=>
        typeof result?.supported==='boolean'?(result.supported?'supported':'unsupported'):'error'),
      new Promise(resolve=>{timer=setTimeout(()=>resolve('timeout'),timeoutMs);})
    ]);
  }catch{return 'error';}
  finally{clearTimeout(timer);}
}
export async function queryNativeCodecSupport(environment=globalThis,timeoutMs=5000) {
  const [avc,aac]=await Promise.all([
    inspect(environment.VideoEncoder,configs.avc,timeoutMs),
    inspect(environment.AudioEncoder,configs.aac,timeoutMs)
  ]);
  return {avc,aac};
}
