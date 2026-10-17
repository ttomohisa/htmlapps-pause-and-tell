// Pure edit decision list. All times are mapped to the export frame clock.
// This module contains no browser APIs and can be regression-tested in Node.
export function buildTimeline(sourceSeconds, notes, fps) {
  if (!(Number.isFinite(sourceSeconds) && sourceSeconds>0 && Number.isInteger(fps) && fps>0)) {
    throw new Error('Invalid source duration or output frame rate');
  }
  const sourceFrames=Math.max(1,Math.round(sourceSeconds*fps));
  const ordered=notes.slice().sort((a,b)=>a.position-b.position || a.id-b.id);
  const segments=[];
  let originalCursor=0,outputCursor=0;
  for (const note of ordered) {
    if (!(Number.isFinite(note.position)&&Number.isFinite(note.duration)&&note.duration>0)) {
      throw new Error('Invalid explanation timestamp or duration');
    }
    const sourceFrame=Math.min(sourceFrames,Math.max(0,Math.round(note.position*fps)));
    if(sourceFrame<originalCursor)throw new Error('Explanation order regressed');
    if(sourceFrame>originalCursor) {
      const length=sourceFrame-originalCursor;
      segments.push({kind:'original',sourceStart:originalCursor,outputStart:outputCursor,length});
      outputCursor+=length;
    }
    const length=Math.max(1,Math.round(note.duration*fps));
    segments.push({kind:'explanation',note,sourceStart:sourceFrame,outputStart:outputCursor,length});
    outputCursor+=length;
    originalCursor=sourceFrame;
  }
  if(originalCursor<sourceFrames) {
    const length=sourceFrames-originalCursor;
    segments.push({kind:'original',sourceStart:originalCursor,outputStart:outputCursor,length});
    outputCursor+=length;
  }
  return {fps,sourceFrames,frames:outputCursor,duration:outputCursor/fps,segments};
}

// Hold the first visible frame before a positive track start; do not shift the
// source clock (which would move every later frame relative to source audio).
export function sourceSampleTime(frame, fps, duration, firstTimestamp) {
  if (![frame,fps,duration,firstTimestamp].every(Number.isFinite) || frame<0 || fps<=0 || duration<=0) throw new Error('Invalid source sample clock');
  return Math.max(0, firstTimestamp, Math.min(Math.max(0,duration-.001),frame/fps));
}
