import {
  Input, BlobSource, ALL_FORMATS, VideoSampleSink, AudioBufferSink,
  Output, WebMOutputFormat, BufferTarget, CanvasSource, AudioBufferSource, Quality
} from 'mediabunny';
import { buildTimeline } from './timeline.js';

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FPS = 15;
  const MAX_SOURCE_SECONDS = 15;
  const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
  const MAX_NOTE_SECONDS = 15;
  let lang = 'ja';
  const state = {
    file: null, input: null, track: null, duration: 0,
    sourceUrl: null, noteUrl: null, resultUrl: null,
    note: null, notes: [], nextNoteId: 1, recorder: null, mic: null, chunks: [],
    startedAt: 0, drawing: false, pointerId: null, activeStroke: null,
    events: [], strokes: [], freeze: null, busy: false
  };
  const sourceVideo = $('sourceVideo');
  const canvas = $('drawCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const playback = $('resultVideo');
  const errorNode = $('error');
  let recordingTimeout = null;
  let uploadGeneration = 0;
  const l = (ja, en) => lang === 'ja' ? ja : en;
  const fmt = seconds => (Number.isFinite(seconds) ? seconds.toFixed(1) + 's' : '—');

  function showError(error) {
    const message = error instanceof Error ? error.message : String(error);
    errorNode.textContent = l('処理に失敗しました: ', 'Failed: ') + message;
    console.error(error);
  }
  function info(text) { $('captureStatus').textContent = text; }
  function setBusy(value) {
    state.busy = value;
    $('sourceFile').disabled = value || Boolean(state.recorder);
    $('startNote').disabled = value || !state.file || Boolean(state.recorder);
    $('playSource').disabled = value || !state.file || Boolean(state.recorder);
    $('seek').disabled = value || Boolean(state.recorder);
    $('export').disabled = value || !state.notes.length;
    $('discard').disabled = value || !state.note;
  }
  function translate() {
    document.documentElement.lang = lang;
    for (const node of document.querySelectorAll('[data-ja][data-en]')) {
      node.textContent = node.dataset[lang];
    }
    $('language').textContent = lang === 'ja' ? 'EN' : 'JA';
    if (state.note) updateSummary();
  }
  $('language').addEventListener('click', () => {
    lang = lang === 'ja' ? 'en' : 'ja';
    translate();
  });
  function releaseUrl(key) {
    if (state[key]) URL.revokeObjectURL(state[key]);
    state[key] = null;
  }
  function clearResult() {
    playback.pause();
    playback.removeAttribute('src');
    playback.load();
    releaseUrl('resultUrl');
    $('result').hidden = true;
    $('resultInfo').textContent = '';
  }
  function resetNotes() {
    if (state.recorder) return;
    clearResult();
    releaseUrl('noteUrl');
    $('notePlayer').removeAttribute('src');
    $('notePlayer').load();
    state.notes=[];
    state.note=null;
    state.nextNoteId=1;
    state.events=[];
    state.strokes=[];
    state.freeze=null;
    $('notePanel').hidden=true;
    $('noteList').replaceChildren();
    canvas.hidden=true;
    sourceVideo.hidden=false;
    info(l('説明を追加する位置を選べます。', 'Choose a source position for narration.'));
    setBusy(false);
  }
  function selectNote(note) {
    if (!note || state.recorder) return;
    state.note=note;
    releaseUrl('noteUrl');
    state.noteUrl=URL.createObjectURL(note.blob);
    $('notePlayer').src=state.noteUrl;
    updateSummary();
  }
  function removeNote(id) {
    if(state.recorder || state.busy) return;
    const index=state.notes.findIndex(item=>item.id===id);
    if(index<0)return;
    clearResult();
    const wasSelected=state.note?.id===id;
    state.notes.splice(index,1);
    if(!state.notes.length) {
      resetNotes();
    }else if(wasSelected) {
      selectNote(state.notes[state.notes.length-1]);
    }else {
      updateSummary();
    }
    setBusy(false);
  }
  function confirmRemoveNote(note) {
    if (window.confirm(l('この説明区間を削除しますか？', 'Delete this explanation segment?'))) {
      removeNote(note.id);
    }
  }
  function renderNotes() {
    const host=$('noteList');
    host.replaceChildren();
    for(const note of state.notes.slice().sort((a,b)=>a.position-b.position || a.id-b.id)) {
      const row=document.createElement('div');
      row.className='note-item';
      const choose=document.createElement('button');
      choose.type='button';
      choose.textContent=fmt(note.position)+' · '+fmt(note.duration)+' · '+l('説明','Explanation')+' '+note.id;
      choose.setAttribute('aria-pressed',String(state.note?.id===note.id));
      choose.addEventListener('click',()=>selectNote(note));
      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent=l('削除','Delete');
      remove.addEventListener('click',()=>confirmRemoveNote(note));
      row.append(choose,remove);
      host.append(row);
    }
  }
  async function loadSource(file) {
    if (!file || state.recorder || state.busy) return;
    errorNode.textContent = '';
    const token = ++uploadGeneration;
    setBusy(true);
    let input = null;
    let url = null;
    try {
      if (file.size === 0 || file.size > MAX_SOURCE_BYTES) throw new Error(l('ファイルサイズは30MiB以内です。','Maximum file size is 30 MiB.'));
      input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error(l('映像トラックがありません。','Source has no video track.'));
      const audio = await input.getPrimaryAudioTrack();
      // Source audio is preserved outside inserted explanations at export.
      const duration = await input.computeDuration();
      if (!(duration > 0 && duration <= MAX_SOURCE_SECONDS))
        throw new Error(l('元動画は15秒以内を選択してください。','Choose a source up to 15 seconds.'));
      const width = await track.getDisplayWidth();
      const height = await track.getDisplayHeight();
      if (!(width > 0 && height > 0)) throw new Error(l('映像のサイズが不明です。','Video dimensions are missing.'));
      // The v0.10.0 test focuses on small SDR clips. No upscaling.
      const factor = Math.min(1, 640 / Math.max(width,height));
      canvas.width = Math.max(2, Math.floor(width * factor / 2) * 2);
      canvas.height = Math.max(2, Math.floor(height * factor / 2) * 2);
      url = URL.createObjectURL(file);
      const loaded = new Promise((resolve,reject) => {
        const timer = setTimeout(() => reject(new Error('Video loading timed out')),15000);
        sourceVideo.addEventListener('loadeddata',()=>{clearTimeout(timer);resolve();},{once:true});
        sourceVideo.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Video could not play'));},{once:true});
      });
      sourceVideo.src = url;
      sourceVideo.load();
      await loaded;
      if (token !== uploadGeneration) { input.dispose(); URL.revokeObjectURL(url); return; }
      if (state.input) state.input.dispose();
      releaseUrl('sourceUrl');
      state.file = file;
      state.input = input;
      state.track = track;
      state.duration = duration;
      state.sourceUrl = url;
      url = null;
      input = null;
      resetNotes();
      $('editor').hidden = false;
      $('seek').value = '0';
      $('position').textContent = fmt(0);
      $('sourceInfo').textContent = file.name + ' · ' + fmt(duration) + ' · ' + width + '×' + height
        + ' · ' + (audio ? l('元音声あり','Original audio present') : l('無音動画','Silent source'));
      info(l('任意の位置へ移動し、「この位置に説明を追加」を押します。','Seek and select Record explanation here.'));
    } catch (e) {
      input?.dispose();
      if (url) URL.revokeObjectURL(url);
      showError(e);
    } finally {
      if (token === uploadGeneration) setBusy(false);
    }
  }
  $('sourceFile').addEventListener('change',e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    void loadSource(f);
  });
  $('playSource').addEventListener('click',async ()=>{
    try {
      if (sourceVideo.paused) await sourceVideo.play();
      else sourceVideo.pause();
    } catch(e) { showError(e); }
  });
  function updatePosition() {
    if (!state.file || state.recorder) return;
    $('seek').value = String(Math.round(1000 * (sourceVideo.currentTime / state.duration)));
    $('position').textContent = fmt(sourceVideo.currentTime);
  }
  sourceVideo.addEventListener('timeupdate',updatePosition);
  sourceVideo.addEventListener('pause',()=>{$('playSource').textContent=l('元動画を再生','Play source');});
  sourceVideo.addEventListener('play',()=>{$('playSource').textContent=l('元動画を停止','Pause source');});
  $('seek').addEventListener('input',e=>{
    if (!state.file || state.recorder) return;
    sourceVideo.pause();
    sourceVideo.currentTime = Math.min(state.duration-.01,Math.max(0, Number(e.target.value)/1000 * state.duration));
    $('position').textContent = fmt(sourceVideo.currentTime);
  });
  function snapshot() {
    const now = Math.max(0, (performance.now() - state.startedAt)/1000);
    const strokes = state.strokes.map(s => s.map(p=>({x:p.x,y:p.y})));
    state.events.push({at:now,strokes});
  }
  function drawStrokes(strokes) {
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const stroke of strokes){
      if (!stroke.length) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * canvas.width,stroke[0].y * canvas.height);
      for(const point of stroke.slice(1)) ctx.lineTo(point.x*canvas.width,point.y*canvas.height);
      ctx.lineWidth=Math.max(3,canvas.width/120);
      ctx.strokeStyle='#141414';ctx.stroke();
      ctx.lineWidth=Math.max(2,canvas.width/170);
      ctx.strokeStyle='#ffe36b';ctx.stroke();
    }
  }
  function showFrozen(strokes = state.strokes) {
    if (!state.freeze) return;
    ctx.drawImage(state.freeze,0,0,canvas.width,canvas.height);
    drawStrokes(strokes);
  }
  function pointerPosition(ev) {
    const rect=canvas.getBoundingClientRect();
    return {
      x:Math.min(1,Math.max(0,(ev.clientX-rect.left)/rect.width)),
      y:Math.min(1,Math.max(0,(ev.clientY-rect.top)/rect.height))
    };
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!state.recorder || state.pointerId!==null) return;
    event.preventDefault();
    state.pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    state.activeStroke=[pointerPosition(event)];
    state.strokes.push(state.activeStroke);
    snapshot();showFrozen();
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==state.pointerId || !state.activeStroke) return;
    event.preventDefault();
    const point=pointerPosition(event);
    const last=state.activeStroke[state.activeStroke.length-1];
    if(state.activeStroke.length<1000 && Math.hypot((point.x-last.x)*canvas.width,(point.y-last.y)*canvas.height)>1.5) {
      state.activeStroke.push(point);snapshot();showFrozen();
    }
  });
  function finishStroke(event){
    if(event.pointerId!==state.pointerId)return;
    event.preventDefault();
    state.pointerId=null;state.activeStroke=null;snapshot();
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
  }
  canvas.addEventListener('pointerup',finishStroke);
  canvas.addEventListener('pointercancel',finishStroke);

  async function beginExplanation() {
    if(!state.file||state.busy||state.recorder) return;
    errorNode.textContent='';
    sourceVideo.pause();
    setBusy(true);
    let mic=null;
    try {
      const position=Math.max(0, Math.min(state.duration, sourceVideo.currentTime));
      // A seek sets currentTime immediately but the destination frame may still
      // be decoding. Never capture an earlier/stale frame as the insertion base.
      if (sourceVideo.seeking || sourceVideo.readyState < 2) {
        await new Promise((resolve,reject)=>{
          const timeout=setTimeout(()=>{cleanup();reject(new Error('Destination frame not ready'));},10000);
          function cleanup(){
            clearTimeout(timeout);
            sourceVideo.removeEventListener('seeked',check);
            sourceVideo.removeEventListener('loadeddata',check);
            sourceVideo.removeEventListener('canplay',check);
          }
          function check(){
            if(!sourceVideo.seeking && sourceVideo.readyState>=2){cleanup();resolve();}
          }
          sourceVideo.addEventListener('seeked',check);
          sourceVideo.addEventListener('loadeddata',check);
          sourceVideo.addEventListener('canplay',check);
          check();
        });
      }
      const freeze=document.createElement('canvas');
      freeze.width=canvas.width;freeze.height=canvas.height;
      const freezeCtx=freeze.getContext('2d',{alpha:false});
      if(sourceVideo.readyState<2) throw new Error(l('動画のフレームを準備できません。','Source frame not available.'));
      freezeCtx.drawImage(sourceVideo,0,0,freeze.width,freeze.height);
      const type=['audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
      if(!type) throw new Error(l('このブラウザはOpusの録音に対応していません。','Opus audio recording is not supported.'));
      mic=await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true }, video:false });
      const recorder=new MediaRecorder(mic,{mimeType:type});
      const chunks=[];
      state.chunks=chunks;state.mic=mic;state.recorder=recorder;
      state.freeze=freeze;state.events=[];state.strokes=[];state.pointerId=null;state.activeStroke=null;
      state.startedAt=performance.now();
      state.insertAt=position;
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
      recorder.onerror=e=>{showError(e.error||new Error('MediaRecorder failure'));};
      recorder.start(250);
      canvas.hidden=false;sourceVideo.hidden=true;showFrozen();
      $('finishNote').hidden=false;$('startNote').hidden=true;
      info(l('説明を録音中。ペンで描けます。元動画の録画はしていません。','Narration recording. Draw with the pen. Source footage is not being recorded.'));
      recordingTimeout=setTimeout(()=>{if(state.recorder)void endExplanation();},MAX_NOTE_SECONDS*1000);
    } catch(e) {
      mic?.getTracks().forEach(t=>t.stop());
      state.mic=null;state.recorder=null;showError(e);
    } finally { setBusy(false); }
  }
  function updateSummary() {
    if (!state.notes.length) {
      $('notePanel').hidden=true;
      $('noteList').replaceChildren();
      return;
    }
    const total=state.notes.reduce((n,item)=>n+item.duration,0);
    $('noteSummary').textContent=l(
      state.notes.length+'件の説明（合計 '+fmt(total)+'）。元動画 '+fmt(state.duration)+'、完成見込み '+fmt(state.duration+total),
      state.notes.length+' explanation(s), total '+fmt(total)+'. Original '+fmt(state.duration)+', estimated output '+fmt(state.duration+total)
    );
    renderNotes();
  }
  async function endExplanation() {
    const recorder=state.recorder;
    if(!recorder||state.busy) return;
    setBusy(true);
    clearTimeout(recordingTimeout);recordingTimeout=null;
    try {
      const stopped = new Promise(resolve => recorder.addEventListener('stop',resolve,{once:true}));
      if(recorder.state!=='inactive') recorder.stop();
      await stopped;
      const blob=new Blob(state.chunks,{type:recorder.mimeType||'audio/webm'});
      state.mic?.getTracks().forEach(t=>t.stop());state.mic=null;state.recorder=null;
      if(blob.size<500) throw new Error(l('音声データが保存されませんでした。','No usable audio was recorded.'));
      const input=new Input({source:new BlobSource(blob),formats:ALL_FORMATS});
      try {
        const audio=await input.getPrimaryAudioTrack();
        if(!audio) throw new Error(l('録音の音声を読み取れません。','Could not parse narration audio.'));
        const duration=await audio.computeDuration();
        if(!(duration>.15 && duration<=MAX_NOTE_SECONDS+1))
          throw new Error(l('録音時間が不正です。','Narration duration is invalid.'));
        const exactPosition=Math.round(state.insertAt*FPS)/FPS;
        const note={id:state.nextNoteId++,position:exactPosition,duration,blob,
          events:state.events.slice(),freeze:state.freeze};
        state.notes.push(note);
        $('notePanel').hidden=false;
        selectNote(note);
        info(l('説明区間を記録しました。元動画の前後はまだ加工していません。','Explanation saved separately. Original footage is still untouched.'));
      } finally { input.dispose(); }
    } catch(e) {
      showError(e);
    } finally {
      state.mic?.getTracks().forEach(t=>t.stop());state.mic=null;state.recorder=null;
      $('finishNote').hidden=true;$('startNote').hidden=false;
      state.pointerId=null;state.activeStroke=null;
      canvas.hidden=true;sourceVideo.hidden=false;
      setBusy(false);
    }
  }
  $('startNote').addEventListener('click',()=>void beginExplanation());
  $('finishNote').addEventListener('click',()=>void endExplanation());
  $('discard').addEventListener('click',()=>{if(state.note)confirmRemoveNote(state.note);});

  async function checkResultPlayable(url) {
    const video=$('resultVideo');
    video.src=url;video.load();
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Output preview timed out')),15000);
      video.addEventListener('loadeddata',()=>{clearTimeout(timer);resolve();},{once:true});
      video.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Output failed to decode'));},{once:true});
    });
    if(!(video.videoWidth>0 && video.videoHeight>0))throw new Error('Output has no video frames');
  }
  async function exportVideo() {
    if(!state.note||state.busy||state.recorder||!state.file)return;
    errorNode.textContent='';clearResult();setBusy(true);
    const note=state.note;
    let videoInput=null,audioInput=null,output=null;
    try {
      if(typeof VideoEncoder==='undefined'||typeof AudioEncoder==='undefined')
        throw new Error(l('このブラウザの動画・音声書き出し機能には未対応です。','WebCodecs video/audio encoding is unavailable.'));
      videoInput=new Input({source:new BlobSource(state.file),formats:ALL_FORMATS});
      audioInput=new Input({source:new BlobSource(note.blob),formats:ALL_FORMATS});
      const vt=await videoInput.getPrimaryVideoTrack();
      const at=await audioInput.getPrimaryAudioTrack();
      if(!vt||!at) throw new Error(l('映像または説明音声を読み込めません。','Missing video or narration track.'));
      const originalAudio=await videoInput.getPrimaryAudioTrack();
      const duration=await vt.computeDuration();
      const voiceDuration=await at.computeDuration();
      const cutFrame=Math.max(0,Math.min(Math.round(duration*FPS),Math.round(note.position*FPS)));
      const sourceFrames=Math.max(1,Math.round(duration*FPS));
      const voiceFrames=Math.max(1,Math.round(voiceDuration*FPS));
      const cutSeconds=cutFrame/FPS;
      const fullFrames=sourceFrames+voiceFrames;
      const fullDuration=fullFrames/FPS;
      if(fullDuration>32)throw new Error('PoC output must be under 32 seconds');
      const renderCanvas=document.createElement('canvas');
      renderCanvas.width=canvas.width;renderCanvas.height=canvas.height;
      const renderCtx=renderCanvas.getContext('2d',{alpha:false});
      output=new Output({format:new WebMOutputFormat(),target:new BufferTarget()});
      const videoSource=new CanvasSource(renderCanvas,{codec:'vp8',quality:new Quality({bitrate:900000})});
      const audioSource=new AudioBufferSource({codec:'opus',quality:new Quality({bitrate:96000})});
      output.addVideoTrack(videoSource,{frameRate:FPS});
      output.addAudioTrack(audioSource);
      $('exportStatus').textContent=l('音声を合成しています…','Composing narration audio…');
      await output.start();
      // Compose source sound and narration on a shared output clock.
      // Source sound plays only before and after the insertion, never over it.
      const sampleRate=48000;
      const channels=originalAudio ? Math.min(2,Math.max(1,await originalAudio.getNumberOfChannels())) : 1;
      const offline=new OfflineAudioContext(channels,Math.ceil(fullDuration*sampleRate),sampleRate);
      function scheduleRange(buffer,chunkTimestamp,start,end,outputStart) {
        const left=Math.max(start,chunkTimestamp);
        const right=Math.min(end,chunkTimestamp+buffer.duration);
        if(right-left<1/sampleRate)return;
        const node=offline.createBufferSource();
        node.buffer=buffer;
        node.connect(offline.destination);
        node.start(Math.max(0,outputStart+(left-start)),
          Math.max(0,left-chunkTimestamp),right-left);
      }
      let seenOriginal=false;
      if(originalAudio) {
        const sourceSink=new AudioBufferSink(originalAudio);
        for await(const {buffer,timestamp} of sourceSink.buffers()){
          scheduleRange(buffer,timestamp,0,cutSeconds,0);
          scheduleRange(buffer,timestamp,cutSeconds,duration,cutSeconds+voiceFrames/FPS);
          seenOriginal=true;
        }
        if(!seenOriginal)throw new Error(l('元動画の音声を読み取れません。','Original audio could not be decoded.'));
      }
      let seenVoice=false;
      const voiceSink=new AudioBufferSink(at);
      for await(const {buffer,timestamp} of voiceSink.buffers()){
        scheduleRange(buffer,timestamp,0,voiceDuration,cutSeconds);
        seenVoice=true;
      }
      if(!seenVoice)throw new Error('No decodable recorded audio');
      const renderedAudio=await offline.startRendering();
      await audioSource.add(renderedAudio);
      $('exportStatus').textContent=l('元動画と説明区間を結合しています…','Composing original frames and inserted explanation…');
      const sink=new VideoSampleSink(vt);
      let eventIndex=0,shownStrokes=[];
      for(let frame=0;frame<fullFrames;frame++){
        if(frame>=cutFrame&&frame<cutFrame+voiceFrames){
          const rel=(frame-cutFrame)/FPS;
          while(eventIndex<note.events.length&&note.events[eventIndex].at<=rel){
            shownStrokes=note.events[eventIndex].strokes;eventIndex++;
          }
          renderCtx.drawImage(note.freeze,0,0,renderCanvas.width,renderCanvas.height);
          renderCtx.save();
          // Drawing is reproduced in the export canvas directly.
          renderCtx.lineCap='round';renderCtx.lineJoin='round';
          for(const stroke of shownStrokes){
            if(!stroke.length)continue;
            renderCtx.beginPath();
            renderCtx.moveTo(stroke[0].x*renderCanvas.width,stroke[0].y*renderCanvas.height);
            for(const p of stroke.slice(1))renderCtx.lineTo(p.x*renderCanvas.width,p.y*renderCanvas.height);
            renderCtx.lineWidth=Math.max(3,renderCanvas.width/120);renderCtx.strokeStyle='#141414';renderCtx.stroke();
            renderCtx.lineWidth=Math.max(2,renderCanvas.width/170);renderCtx.strokeStyle='#ffe36b';renderCtx.stroke();
          }
          renderCtx.restore();
        }else{
          const sourceFrame=frame<cutFrame?frame:frame-voiceFrames;
          const sourceTime=Math.min(Math.max(0,duration-.001),sourceFrame/FPS);
          const sample=await sink.getSample(sourceTime);
          if(!sample)throw new Error(l('元動画のフレームを読み出せません。','Could not decode a source frame.'));
          try {sample.draw(renderCtx,0,0,renderCanvas.width,renderCanvas.height);}
          finally {sample.close();}
        }
        await videoSource.add(frame/FPS,1/FPS,{keyFrame:frame===0||frame===cutFrame||frame===cutFrame+voiceFrames});
        if(frame%15===0){
          $('exportStatus').textContent=l('書き出し中 ','Encoding ') + Math.round((frame+1)/fullFrames*100)+'%';
          await new Promise(resolve=>setTimeout(resolve,0));
        }
      }
      await output.finalize();
      const bytes=output.target.buffer;
      if(!bytes || bytes.byteLength<2048)throw new Error('Encoded output is empty');
      state.resultUrl=URL.createObjectURL(new Blob([bytes],{type:'video/webm'}));
      await checkResultPlayable(state.resultUrl);
      $('result').hidden=false;
      $('resultInfo').textContent=l('完成動画 ', 'Output ') + fmt(fullDuration) + ' · WebM VP8/Opus · '+Math.round(bytes.byteLength/1024)+' KiB'
        + ' · ' + (originalAudio ? l('元音声を保持','Original audio retained') : l('元動画は無音','Silent original'));
      $('exportStatus').textContent=l('動画を作成しました。最後まで再生して確認してください。','Composition complete. Play the full video to check it.');
    }catch(error){
      showError(error);
      $('exportStatus').textContent=l('書き出しできませんでした。説明区間は保持しています。','Export failed. The separate explanation is still available.');
      clearResult();
      if(output && output.state!=='finalized'&&output.state!=='canceled') {
        try {await output.cancel();}catch{}
      }
    }finally{
      videoInput?.dispose();audioInput?.dispose();setBusy(false);
    }
  }
  $('export').addEventListener('click',()=>void exportVideo());
  $('save').addEventListener('click',()=>{
    if(!state.resultUrl)return;
    const a=document.createElement('a');a.href=state.resultUrl;
    a.download=(state.file?.name||'video').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'-')+'-explained.webm';
    a.click();
  });
  window.addEventListener('pagehide',()=>{
    state.mic?.getTracks().forEach(t=>t.stop());
    if(state.input)state.input.dispose();
    for(const k of ['sourceUrl','noteUrl','resultUrl'])releaseUrl(k);
  });
  translate();setBusy(false);
})();