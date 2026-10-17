import {buildTimeline} from './timeline.js';
const formats=Object.freeze({
  webm:Object.freeze({extension:'webm',mime:'video/webm',video:'vp8',audio:'opus',label:'WebM VP8/Opus',maxSeconds:600}),
  mp4:Object.freeze({extension:'mp4',mime:'video/mp4',video:'avc',audio:'aac',label:'MP4 AVC/AAC (experimental)',maxSeconds:30})
});
export function exportFormat(value){if(!formats[value])throw Error('Unknown export format');return formats[value];}
export function resultFilename(value,mime){
  const extension=mime==='video/mp4'?'mp4':'webm';
  const name=value.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'-').replace(/[. ]+$/g,'').replace(/\.(webm|mp4)$/i,'').trim();
  return (name||'video-explained')+'.'+extension;
}

// Advisory edit budget; the exporter independently enforces the same ceiling.
export function compositionBudget(sourceSeconds,notes,value,fps) {
  const limit=exportFormat(value).maxSeconds;
  const duration=buildTimeline(sourceSeconds,notes,fps).duration;
  return {duration,limit,remaining:Math.max(0,limit-duration),exceeded:duration>limit};
}
