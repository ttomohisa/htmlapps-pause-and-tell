import {
  Input, BlobSource, ALL_FORMATS, VideoSampleSink, AudioBufferSink,
  Output, WebMOutputFormat, Mp4OutputFormat, BufferTarget, StreamTarget, CanvasSource, AudioBufferSource, Quality, canEncodeVideo, canEncodeAudio
} from 'mediabunny';
import { buildTimeline, sourceSampleTime } from './timeline.js';
import { exportFormat, resultFilename, compositionBudget } from './export-format.js';
import { queryNativeCodecSupport } from './native-codec-support.js';
import { TemporaryCleanup } from './temporary-cleanup.js';

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FPS = 15;
  // Experimental envelopes, not device or codec performance guarantees.
  const MAX_SOURCE_SECONDS = 5 * 60;
  const MAX_SOURCE_BYTES = 250 * 1024 * 1024;
  const MAX_NOTE_SECONDS = 2 * 60;
  const MAX_OUTPUT_SECONDS = 10 * 60;
  const MAX_RAM_EXPORT_ESTIMATE = 96 * 1024 * 1024;
  let lang = 'ja';
  const state = {
    file: null, input: null, track: null, duration: 0, exportSourceDuration: 0,
    sourceUrl: null, noteUrl: null, resultUrl: null, resultTemp: null,
    note: null, notes: [], nextNoteId: 1, recorder: null, mic: null, chunks: [],
    startedAt: 0, drawing: false, pointerId: null, activeStroke: null,
    events: [], strokes: [], freeze: null, busy: false,
    session: null, recoveryBlobs: [], resultBlob: null, capabilities: null
  };
  const sourceVideo = $('sourceVideo');
  const canvas = $('drawCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const playback = $('resultVideo');
  const errorNode = $('error');
  let recordingTimeout = null;
  let recordingClock = null;
  let exportTask = null;
  const pendingExportCleanup=new TemporaryCleanup();
  function renderCleanupWarning() {
    $('cleanupWarning').hidden=!pendingExportCleanup.size;
    $('cleanupWarning').textContent=l('失敗した書き出しの一時ファイルを削除できていません。前回の完成動画と説明は保持しています。先に必要な動画を保存し、このページを開いたまま再試行してください。次の書き出しは削除を再確認してから開始します。サイトデータを削除しないでください。','A failed export temporary file could not be removed. Previous output and explanations are retained. Save any needed output first and retry with this page open. A new export starts only after cleanup succeeds. Do not clear site data.');
  }
  const exportCancelled = new Error('Export cancelled');
  function checkExportCancelled() { if(exportTask?.cancelled) throw exportCancelled; }
  function exportProgress(text) {
    $('exportStatus').textContent=exportTask?.cancelled ? l('中止を待っています。一時ファイルの片付けが終わるまでお待ちください…','Stopping requested. Waiting for processing and temporary-file cleanup…') : text;
  }
  $('cancelExport').addEventListener('click',()=>{
    if(!exportTask)return;
    exportTask.cancelled=true;
    $('cancelExport').disabled=true;
    exportProgress('');
  });
  let uploadGeneration = 0;
  let capabilityGeneration = 0;
  let nativeSupport=null,nativeSupportPending=false;
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
    $('exportFormat').disabled = value || Boolean(state.recorder);
    $('startNote').disabled = value || !state.file || Boolean(state.recorder) || !state.capabilities?.record || !state.capabilities?.encode;
    $('playSource').disabled = value || !state.file || Boolean(state.recorder);
    $('seek').disabled = value || Boolean(state.recorder);
    const budget=renderDurationBudget();
    $('export').disabled = value || Boolean(state.recorder) || !state.notes.length || !state.capabilities?.encode || Boolean(budget?.exceeded);
    $('discard').disabled = value || Boolean(state.recorder) || !state.note;
    $('finishNote').disabled = value;
    $('cancelNote').disabled = value;
    $('rerecord').disabled = value || Boolean(state.recorder) || !state.note || !state.capabilities?.record || !state.capabilities?.encode;
    for(const button of $('noteList').querySelectorAll('button')) button.disabled=value || Boolean(state.recorder);
  }
  function renderRecordingClock() {
    const active=Boolean(state.session && !state.session.finishing && state.recorder?.state==='recording');
    $('recordingClock').hidden=!active;
    if(!active)return;
    const elapsed=Math.max(0,(performance.now()-state.startedAt)/1000);
    const remaining=Math.max(0,MAX_NOTE_SECONDS-elapsed);
    $('recordingElapsed').textContent=l('録音経過 '+fmt(elapsed)+' / 1件の上限 '+fmt(MAX_NOTE_SECONDS)+'。自動停止まで約 '+fmt(remaining),
      'Recording elapsed '+fmt(elapsed)+' / per-clip limit '+fmt(MAX_NOTE_SECONDS)+'. Automatic stop in approximately '+fmt(remaining));
    const notes=state.notes.filter(note=>note!==state.session.replacing);
    notes.push({id:state.session.replacing?.id || state.nextNoteId,position:state.insertAt,duration:Math.max(1/FPS,elapsed)});
    const budget=compositionBudget(state.exportSourceDuration,notes,$('exportFormat').value,FPS);
    const format=exportFormat($('exportFormat').value).extension.toUpperCase();
    $('recordingBudget').textContent=l('現在の録音を含む完成目安 '+fmt(budget.duration)+' / '+format+' 試験上限 '+fmt(budget.limit)+'。',
      'Estimated output including this recording '+fmt(budget.duration)+' / '+format+' experimental limit '+fmt(budget.limit)+'. ')+
      (budget.exceeded ? l('完成尺の上限を超えています。この完成尺の上限では録音は自動停止しません。終了後に短く録り直すか、対応形式を選んでください。',
      'Output limit exceeded. Recording will not stop at this format limit. Rerecord shorter explanations afterward or choose a supported format.') :
      l('録音の上限とは別です。実際の録音時間を確認後に再計算します。','This is separate from the recording limit; recalculated after actual audio validation.'));
    $('recordingBudget').classList.toggle('alert',budget.exceeded);
    $('recordingClock').dataset.elapsed=String(elapsed);
    $('recordingClock').dataset.remaining=String(remaining);
    $('recordingClock').dataset.output=String(budget.duration);
  }
  function stopRecordingClock() {
    clearInterval(recordingClock);recordingClock=null;
    $('recordingClock').hidden=true;
  }
  function renderDurationBudget() {
    const budget=state.file ? compositionBudget(state.exportSourceDuration,state.notes,$('exportFormat').value,FPS) : null;
    $('durationBudget').hidden=!budget;
    $('exportBudget').hidden=!budget?.exceeded;
    if(!budget)return null;
    const format=exportFormat($('exportFormat').value).extension.toUpperCase();
    const text=l('現在確定分の完成見込み '+fmt(budget.duration)+' / '+format+' 試験上限 '+fmt(budget.limit)+
      '。追加できる説明の目安 '+fmt(budget.remaining)+'。',
      'Estimated output from completed clips '+fmt(budget.duration)+' / '+format+' experimental limit '+fmt(budget.limit)+
      '. Approximate narration room '+fmt(budget.remaining)+'.');
    const remedy=format==='MP4' ? l('対応していればWebMを選ぶか、元動画・説明を短くしてください。','Choose WebM if supported, or use a shorter source/explanations.') :
      l('元動画・説明を短くしてください。','Use a shorter source/explanations.');
    const warning=budget.exceeded ? l(' 上限を超えるため書き出せません。',' Export exceeds this limit. ')+remedy+
      l('録音済みの説明と前回の保存結果は変更していません。',' Recorded clips and any previous result are unchanged.') :
      l(' 処理成功の保証値ではありません。',' This is not a device performance guarantee.');
    $('durationBudget').textContent=text+warning;
    $('durationBudget').classList.toggle('alert',budget.exceeded);
    $('exportBudget').textContent=text+warning;
    return budget;
  }
  function translate() {
    document.documentElement.lang = lang;
    for (const node of document.querySelectorAll('[data-ja][data-en]')) {
      node.textContent = node.dataset[lang];
    }
    $('language').textContent = lang === 'ja' ? 'EN' : 'JA';
    if (state.note) updateSummary();
    renderCapabilities();renderRecovery();renderNativeSupport();renderDurationBudget();renderRecordingClock();renderCleanupWarning();
  }
  $('language').addEventListener('click', () => {
    lang = lang === 'ja' ? 'en' : 'ja';
    translate();
  });
  function renderNativeSupport() {
    const labels={supported:l('候補あり','Candidate available'),unsupported:l('候補なし','No candidate'),
      unavailable:l('APIなし','API unavailable'),error:l('確認できません','Could not check'),timeout:l('確認が時間切れ','Query timed out')};
    $('nativeSupportResult').textContent=nativeSupportPending?l('候補を照会中…','Querying candidates…'):
      nativeSupport?`Native AVC: ${labels[nativeSupport.avc]} / Native AAC: ${labels[nativeSupport.aac]}`:
      l('ボタンを押すと、このブラウザの候補を表示します。','Press the button to see candidates on this browser.');
  }
  $('checkNativeSupport').addEventListener('click',async()=>{
    if(nativeSupportPending)return;
    nativeSupportPending=true;$('checkNativeSupport').disabled=true;
    $('nativeSupportResult').dataset.ready='false';renderNativeSupport();
    try{nativeSupport=await queryNativeCodecSupport();}
    catch{nativeSupport={avc:'error',aac:'error'};}
    finally{nativeSupportPending=false;$('checkNativeSupport').disabled=false;
      $('nativeSupportResult').dataset.ready='true';renderNativeSupport();}
  });
  function recordingType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function' || !navigator.mediaDevices?.getUserMedia) return null;
    return ['audio/webm;codecs=opus','audio/webm','audio/mp4;codecs=mp4a.40.2','audio/mp4']
      .find(type => MediaRecorder.isTypeSupported(type)) || null;
  }
  function renderCapabilities() {
    const c=state.capabilities;
    $('capabilities').textContent=!c ? l('録音・書き出し機能を確認中…','Checking recording and export capabilities…') : [
      c.record ? l('録音候補: ','Recording candidate: ')+c.type : l('この環境ではマイク録音APIまたは対応形式を利用できません。HTTPS・権限・ブラウザを確認してください。','Microphone recording API or format unavailable. Check HTTPS, permissions and browser.'),
      exportFormat($('exportFormat').value).label + (c.encode ? l(' 書き出し候補あり。',' encoding candidate available.') : l(' 動画・音声エンコーダーを利用できません。形式を変更してください。',' video/audio encoders unavailable. Choose another format.')),
      l('機能検出は実機での録音・保存成功を保証しません。MP4は完成30秒までの実験です。','Feature detection does not prove recording or saving. MP4 is experimental, limited to 30 seconds of output.')
    ].join(' ');
  }
  async function inspectCapabilities() {
    const generation=++capabilityGeneration;
    const type=recordingType();
    const profile=exportFormat($('exportFormat').value);
    state.capabilities=null;renderCapabilities();setBusy(state.busy);
    let encode=false;
    try {
      encode=typeof VideoDecoder!=='undefined' && typeof AudioDecoder!=='undefined'
        && typeof OfflineAudioContext!=='undefined'
        && await canEncodeVideo(profile.video,{width:canvas.width || 320,height:canvas.height || 180,frameRate:FPS,quality:new Quality({bitrate:900000})})
        && await canEncodeAudio(profile.audio,{numberOfChannels:2,sampleRate:48000,quality:new Quality({bitrate:96000})});
    } catch { /* Capability probes are advisory; unsupported environments fail closed. */ }
    if(generation!==capabilityGeneration)return;
    state.capabilities={type,record:Boolean(type),encode};
    renderCapabilities();setBusy(state.busy);
  }
  $('exportFormat').addEventListener('change',()=>void inspectCapabilities());
  function releaseUrl(key) {
    if (state[key]) URL.revokeObjectURL(state[key]);
    state[key] = null;
  }
  function clearResult() {
    playback.pause();
    playback.removeAttribute('src');
    playback.load();
    releaseUrl('resultUrl');
    const expired=state.resultTemp;
    state.resultTemp=null;
    state.resultBlob=null;
    if(expired) void expired.directory.removeEntry(expired.name).catch(()=>{});
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
  function selectNote(note,preparedUrl=null) {
    if (!note || state.recorder) return;
    const nextUrl=preparedUrl || URL.createObjectURL(note.blob);
    state.note=note;
    releaseUrl('noteUrl');
    state.noteUrl=nextUrl;
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
      choose.addEventListener('click',()=>{if(!state.busy)selectNote(note);});
      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent=l('削除','Delete');
      remove.addEventListener('click',()=>confirmRemoveNote(note));
      choose.disabled=remove.disabled=state.busy || Boolean(state.recorder);
      row.append(choose,remove);
      host.append(row);
    }
  }
  async function loadSource(file) {
    if (!file || state.recorder || state.busy) return;
    if ((state.notes.length || state.recoveryBlobs.length) && !window.confirm(l(
      '元動画を変更すると、現在の説明区間と未検証の回収音声はすべて削除されます。変更しますか？',
      'Changing the source video will discard all recorded explanations and recovered audio. Continue?'
    ))) return;
    errorNode.textContent = '';
    const token = ++uploadGeneration;
    setBusy(true);
    let input = null;
    let url = null;
    let changedPreview = false;
    const oldTime=sourceVideo.currentTime;
    const oldGeometry={width:canvas.width,height:canvas.height};
    try {
      if (file.size === 0 || file.size > MAX_SOURCE_BYTES) throw new Error(l('動画は250MiB以内を選んでください。','Choose a video up to 250 MiB.'));
      input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error(l('映像トラックがありません。','Source has no video track.'));
      const audio = await input.getPrimaryAudioTrack();
      if (!await track.canDecode() || (audio && !await audio.canDecode())) {
        throw new Error(l('元動画の映像または音声をこのブラウザで変換できません。','This browser cannot decode the source video or soundtrack for composition.'));
      }
      // Source audio is preserved outside inserted explanations at export.
      const duration = await input.computeDuration();
      const exportSourceDuration=await track.computeDuration();
      if(!(exportSourceDuration>0 && Number.isFinite(exportSourceDuration)))throw new Error('Video duration is invalid');
      if (!(duration > 0 && duration <= MAX_SOURCE_SECONDS))
        throw new Error(l('元動画は5分以内を選択してください。','Choose a source up to five minutes.'));
      const width = await track.getDisplayWidth();
      const height = await track.getDisplayHeight();
      if (!(width > 0 && height > 0)) throw new Error(l('映像のサイズが不明です。','Video dimensions are missing.'));
      // The v0.10.0 test focuses on small SDR clips. No upscaling.
      const factor = Math.min(1, 640 / Math.max(width,height));
      canvas.width = Math.max(2, Math.floor(width * factor / 2) * 2);
      canvas.height = Math.max(2, Math.floor(height * factor / 2) * 2);
      // Keep the interactive canvas at the actual visible video dimensions
      // even for narrow portrait footage. Avoid the invisible letterbox area
      // that would misalign normalized pointer coordinates on small screens.
      canvas.parentElement.style.setProperty('--media-ratio',String(canvas.width/canvas.height));
      url = URL.createObjectURL(file);
      const loaded = new Promise((resolve,reject) => {
        let settled=false;
        const cleanup=()=>{
          clearTimeout(timer);
          sourceVideo.removeEventListener('loadeddata',ready);
          sourceVideo.removeEventListener('error',failed);
        };
        const finish=(error)=>{
          if(settled)return;
          settled=true;
          cleanup();
          if(error)reject(error);
          else resolve();
        };
        const ready=()=>finish();
        const failed=()=>{
          const code=sourceVideo.error?.code;
          const reason=code===4
            ? l('このブラウザは動画の形式またはコーデックに対応していません。別のブラウザか形式で試してください。',
                'This browser cannot play the video format or codec. Try a different browser or format.')
            : l('動画を再生できませんでした。ファイルの形式や破損を確認してください。',
                'Video could not be decoded. Check its format or integrity.');
          finish(new Error(reason));
        };
        const timer=setTimeout(()=>finish(new Error('Video loading timed out')),15000);
        sourceVideo.addEventListener('loadeddata',ready);
        sourceVideo.addEventListener('error',failed);
      });
      sourceVideo.pause();
      sourceVideo.src = url;
      changedPreview=true;
      sourceVideo.load();
      await loaded;
      if (token !== uploadGeneration) { input.dispose(); URL.revokeObjectURL(url); return; }
      if (state.input) state.input.dispose();
      releaseUrl('sourceUrl');
      state.file = file;
      state.input = input;
      state.track = track;
      state.duration = duration;
      state.exportSourceDuration=exportSourceDuration;
      state.sourceUrl = url;
      url = null;
      input = null;
      resetNotes();setBusy(true);
      state.recoveryBlobs=[];$('recovery').hidden=true;
      await inspectCapabilities();
      if(token!==uploadGeneration)return;
      $('outputName').value=file.name.replace(/\.[^.]+$/,'')+'-explained';
      $('editor').hidden = false;
      $('seek').value = '0';
      $('position').textContent = fmt(0);
      $('sourceInfo').textContent = file.name + ' · ' + fmt(duration) + ' · ' + width + '×' + height
        + ' · ' + (audio ? l('元音声あり','Original audio present') : l('無音動画','Silent source'));
      info(l('元動画の再生では音声も聞けます。説明の録音を始めると元動画は停止します。',
        'Playing the original also plays its soundtrack. Starting narration pauses the source.'));
    } catch (e) {
      canvas.width=oldGeometry.width;canvas.height=oldGeometry.height;
      canvas.parentElement.style.setProperty('--media-ratio',String(canvas.width/canvas.height));
      if(changedPreview) {
        sourceVideo.pause();
        if(state.sourceUrl) {
          sourceVideo.src=state.sourceUrl;
          sourceVideo.load();
          sourceVideo.addEventListener('loadeddata',()=>{
            sourceVideo.currentTime=Math.min(Math.max(0,oldTime),Math.max(0,state.duration-.01));
          },{once:true});
        }else{
          sourceVideo.removeAttribute('src');
          sourceVideo.load();
        }
      }
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

  async function beginExplanation(replacing=null) {
    if(!state.file||state.busy||state.recorder||!state.capabilities?.record||!state.capabilities?.encode) return;
    if(replacing && !state.notes.includes(replacing))return;
    errorNode.textContent='';
    // Prevent existing narration/output previews from feeding the microphone.
    // Pause without rewinding; failure/cancellation must not auto-resume sound.
    $('notePlayer').pause();playback.pause();
    sourceVideo.pause();
    if(replacing)sourceVideo.currentTime=Math.min(replacing.position,Math.max(0,state.duration-.01));
    setBusy(true);
    let mic=null;
    try {
      const position=replacing ? replacing.position : Math.max(0, Math.min(state.duration, sourceVideo.currentTime));
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
      // A replacement keeps the original insertion's exact frozen frame.
      freezeCtx.drawImage(replacing?.freeze || sourceVideo,0,0,freeze.width,freeze.height);
      const type=recordingType();
      if(!type) throw new Error(l('対応する録音形式がありません。','No supported narration recording format.'));
      mic=await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true }, video:false });
      if(document.hidden) throw new Error(l('画面に戻ってから録音を開始してください。','Return to this page before starting recording.'));
      const recorder=new MediaRecorder(mic,{mimeType:type});
      const chunks=[];
      state.chunks=chunks;state.mic=mic;state.recorder=recorder;
      state.freeze=freeze;state.events=[];state.strokes=[];state.pointerId=null;state.activeStroke=null;
      state.startedAt=performance.now();
      state.insertAt=position;
      const session={recorder,chunks,replacing,cancelled:false,stopped:false,finishing:false,error:null,requested:false,failed:false,recoveryIndex:null,generation:uploadGeneration};
      state.session=session;
      session.done=new Promise(resolve=>{session.resolve=resolve;});
      recorder.ondataavailable=e=>{
        if(e.data?.size)chunks.push(e.data);
        if(session.failed && session.generation===uploadGeneration) retainRecovery(session);
      };
      recorder.addEventListener('stop',()=>{
        session.stopped=true;session.resolve();
        if(!session.requested && !session.error) session.error=new Error(l('録音が中断されました。回収データは未検証です。','Recording was interrupted. Recovered audio is unverified.'));
        if(state.session===session) void endExplanation();
      },{once:true});
      recorder.onerror=e=>{
        if(state.session!==session)return;
        session.error=e.error||new Error('MediaRecorder failure');
        void endExplanation();
      };
      recorder.start(250);
      state.startedAt=performance.now();
      renderRecordingClock();
      recordingClock=setInterval(renderRecordingClock,250);
      canvas.hidden=false;sourceVideo.hidden=true;showFrozen();
      $('finishNote').hidden=false;$('cancelNote').hidden=false;$('startNote').hidden=true;
      info(replacing ? l('選択した説明を録り直しています。新しい音声を確認できるまで元の説明を保持します。ペンは描き直してください。','Rerecording selected explanation. The original is retained until the new audio is validated. Draw new pen annotations.') : l('説明を録音中。ペンで描けます。元動画の録画はしていません。','Narration recording. Draw with the pen. Source footage is not being recorded.'));
      recordingTimeout=setTimeout(()=>{if(state.recorder)void endExplanation();},MAX_NOTE_SECONDS*1000);
    } catch(e) {
      mic?.getTracks().forEach(t=>t.stop());
      stopRecordingClock();
      state.mic=null;state.recorder=null;state.session=null;showError(e);
    } finally { setBusy(false); }
  }
  function updateSummary() {
    if (!state.notes.length) {
      $('notePanel').hidden=true;
      $('noteList').replaceChildren();
      return;
    }
    const total=state.notes.reduce((n,item)=>n+item.duration,0);
    const composed=buildTimeline(state.exportSourceDuration,state.notes,FPS).duration;
    $('noteSummary').textContent=l(
      state.notes.length+'件の説明（合計 '+fmt(total)+'）。元動画 '+fmt(state.duration)+'、完成見込み '+fmt(composed),
      state.notes.length+' explanation(s), total '+fmt(total)+'. Original '+fmt(state.duration)+', estimated output '+fmt(composed)
    );
    renderNotes();
  }
  async function endExplanation() {
    const session=state.session;
    const recorder=session?.recorder;
    if(!recorder||session.finishing) return;
    session.finishing=true;session.requested=true;
    setBusy(true);
    clearTimeout(recordingTimeout);recordingTimeout=null;
    stopRecordingClock();
    try {
      if(recorder.state!=='inactive') recorder.stop();
      let timer;
      try {
        await Promise.race([session.done,new Promise((_,reject)=>{
          timer=setTimeout(()=>reject(new Error(l('録音終了を確認できませんでした。','Recorder did not finish.'))),5000);
        })]);
      } finally { clearTimeout(timer); }
      if(session.cancelled) {
        info(l('録音を取り消しました。元の説明と前回の完成動画は保持しています。','Recording cancelled. Original explanations and previous output are retained.'));
        return;
      }
      const blob=new Blob(session.chunks,{type:recorder.mimeType||'audio/webm'});
      if(session.error) throw session.error;
      state.mic?.getTracks().forEach(t=>t.stop());state.mic=null;state.recorder=null;
      if(blob.size<500) throw new Error(l('音声データが保存されませんでした。','No usable audio was recorded.'));
      const input=new Input({source:new BlobSource(blob),formats:ALL_FORMATS});
      let candidateNoteUrl=null;
      try {
        const audio=await input.getPrimaryAudioTrack();
        if(!audio || !await audio.canDecode()) throw new Error(l('録音の音声を読み取れません。','Could not decode narration audio.'));
        const duration=await audio.computeDuration();
        if(!(duration>.15 && duration<=MAX_NOTE_SECONDS+1))
          throw new Error(l('録音時間が不正です。','Narration duration is invalid.'));
        // A capability query and container duration do not prove payload validity.
        // Decode sequentially without retaining a whole-note PCM buffer. A slow
        // or broken decoder fails closed, leaving the original clip untouched.
        let validationTimer;
        try {
          await Promise.race([(async()=>{
            let decodedSeconds=0;
            for await(const item of new AudioBufferSink(audio).buffers()) {
              if(!(item.buffer.length>0 && item.buffer.sampleRate>0))throw new Error('Empty decoded narration');
              decodedSeconds+=item.buffer.length/item.buffer.sampleRate;
              if(decodedSeconds>MAX_NOTE_SECONDS+2)throw new Error('Decoded narration exceeds limit');
            }
            if(decodedSeconds<Math.max(.15,duration-.15))throw new Error('Narration audio is incomplete');
          })(),new Promise((_,reject)=>{
            validationTimer=setTimeout(()=>reject(new Error(l('録音音声の確認が時間切れになりました。元の説明は保持しています。','Narration validation timed out. The original is retained.'))),30000);
          })]);
        }finally{clearTimeout(validationTimer);}
        const exactPosition=Math.round(state.insertAt*FPS)/FPS;
        const note={id:session.replacing?.id ?? state.nextNoteId++,position:exactPosition,duration,blob,
          events:state.events.slice(),freeze:state.freeze};
        candidateNoteUrl=URL.createObjectURL(blob);
        if(session.replacing) {
          const index=state.notes.indexOf(session.replacing);
          if(index<0)throw new Error('Original explanation changed during rerecording');
          state.notes[index]=note;
        }else state.notes.push(note);
        // Only a committed edit invalidates the old composition. Failed/cancelled
        // recording must keep its download and the original explanation intact.
        clearResult();
        $('exportStatus').textContent='';
        $('notePanel').hidden=false;
        selectNote(note,candidateNoteUrl);candidateNoteUrl=null;
        info(l('説明区間を記録しました。元動画の前後はまだ加工していません。','Explanation saved separately. Original footage is still untouched.'));
      } finally { if(candidateNoteUrl)URL.revokeObjectURL(candidateNoteUrl);input.dispose(); }
    } catch(e) {
      session.failed=true;retainRecovery(session);
      showError(e);
      info(l('録音は完了していません。既存の説明区間は保持しています。','Recording did not complete. Existing explanations are retained.'));
    } finally {
      state.session=null;
      state.mic?.getTracks().forEach(t=>t.stop());state.mic=null;state.recorder=null;
      $('finishNote').hidden=true;$('cancelNote').hidden=true;$('startNote').hidden=false;
      state.pointerId=null;state.activeStroke=null;
      canvas.hidden=true;sourceVideo.hidden=false;
      setBusy(false);
    }
  }
  $('startNote').addEventListener('click',()=>void beginExplanation());
  $('finishNote').addEventListener('click',()=>void endExplanation());
  $('rerecord').addEventListener('click',()=>void beginExplanation(state.note));
  $('cancelNote').addEventListener('click',()=>{
    if(!state.session || state.session.finishing)return;
    state.session.cancelled=true;void endExplanation();
  });
  $('discard').addEventListener('click',()=>{if(state.note)confirmRemoveNote(state.note);});

  async function checkResultPlayable(url) {
    const video=document.createElement('video');
    video.muted=true;video.playsInline=true;
    try {
      await new Promise((resolve,reject)=>{
        const cleanup=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',ready);video.removeEventListener('error',failed);};
        const ready=()=>{cleanup();resolve();};
        const failed=()=>{cleanup();reject(new Error('Output failed to decode'));};
        const timer=setTimeout(()=>{cleanup();reject(new Error('Output preview timed out'));},15000);
        video.addEventListener('loadeddata',ready);video.addEventListener('error',failed);
        video.src=url;video.load();
      });
      if(!(video.videoWidth>0 && video.videoHeight>0))throw new Error('Output has no video frames');
    } finally {video.removeAttribute('src');video.load();}
  }
  async function exportVideo() {
    if(!state.notes.length||state.busy||state.recorder||!state.file||!state.capabilities?.encode)return;
    const profile=exportFormat($('exportFormat').value);
    errorNode.textContent='';
    exportTask={cancelled:false};
    $('cancelExport').hidden=false;
    $('cancelExport').disabled=false;
    setBusy(true);
    let videoInput=null,output=null,temporaryResult=null,candidateUrl=null,cancelled=false;
    const audioInputs=[];
    try {
      if(pendingExportCleanup.size) {
        exportProgress(l('残った一時ファイルを片付けています…','Retrying temporary-file cleanup…'));
        const cleaned=await pendingExportCleanup.retry();
        renderCleanupWarning();
        checkExportCancelled();
        if(!cleaned)throw new Error(l('一時ファイルの削除がまだ完了していません。新しい書き出しは開始しません。','Temporary cleanup is still pending. No new export was started.'));
      }
      if(typeof VideoEncoder==='undefined'||typeof AudioEncoder==='undefined') {
        throw new Error(l('このブラウザの動画・音声書き出し機能には未対応です。','WebCodecs video/audio encoding is unavailable.'));
      }
      videoInput=new Input({source:new BlobSource(state.file),formats:ALL_FORMATS});
      const vt=await videoInput.getPrimaryVideoTrack();
      const originalAudio=await videoInput.getPrimaryAudioTrack();
      if(!vt)throw new Error(l('元動画の映像を読み込めません。','Source video track is unavailable.'));
      const duration=await vt.computeDuration();
      const ordered=state.notes.map(note=>({...note})).sort((a,b)=>a.position-b.position || a.id-b.id);
      for(const note of ordered) {
        const input=new Input({source:new BlobSource(note.blob),formats:ALL_FORMATS});
        audioInputs.push({input});
        const track=await input.getPrimaryAudioTrack();
        if(!track)throw new Error(l('説明音声を読み込めません。','An explanation has no decoded audio.'));
        const actual=await track.computeDuration();
        if(!(actual>.15&&actual<=MAX_NOTE_SECONDS+1))throw new Error('Invalid explanation duration');
        // Keep note id and video/pen events but honor the actual decoded audio duration.
        note.duration=actual;
        audioInputs[audioInputs.length-1]={input,note,track};
      }
      checkExportCancelled();
      const timeline=buildTimeline(duration,ordered,FPS);
      const fullDuration=timeline.duration;
      if(fullDuration>Math.min(MAX_OUTPUT_SECONDS,profile.maxSeconds))throw new Error(profile.extension==='mp4' ? l('MP4の試験上限は完成30秒です。説明を短くするかWebMを選んでください。','MP4 experimental output limit is 30 seconds. Shorten the composition or choose WebM.') : l('完成動画は試験上限10分を超えています。','Experimental output exceeds the 10-minute limit.'));
      const renderCanvas=document.createElement('canvas');
      renderCanvas.width=canvas.width;renderCanvas.height=canvas.height;
      const renderCtx=renderCanvas.getContext('2d',{alpha:false});
      // Prefer a local temporary file, so long output doesn't continually
      // grow and duplicate one giant in-memory ArrayBuffer.
      let outputTarget=null;
      if(navigator.storage?.getDirectory && crypto.randomUUID) {
        try {
          const directory=await navigator.storage.getDirectory();
          const name='pause-and-tell-temp-'+crypto.randomUUID()+'.'+profile.extension;
          const handle=await directory.getFileHandle(name,{create:true});
          temporaryResult={directory,handle,name};
          const writable=await handle.createWritable();
          outputTarget=new StreamTarget(writable,{chunked:true,chunkSize:2**20});
        }catch(storageError) {
          console.warn('Local temporary file unavailable:',storageError);
          if(temporaryResult) {
            const cleaned=await pendingExportCleanup.remove(temporaryResult);
            temporaryResult=null;
            renderCleanupWarning();
            if(!cleaned)throw new Error(l('一時ファイルの削除が完了していないため、書き出しを停止しました。','Export stopped because temporary cleanup is pending.'));
          }
          temporaryResult=null;
        }
      }
      if(!outputTarget) {
        const estimate=fullDuration*(900000+96000)/8*1.5;
        if(estimate>MAX_RAM_EXPORT_ESTIMATE) {
          throw new Error(l('この端末では長い動画を一時保存できません。短くして再試行してください。',
            'Temporary storage is unavailable; try a shorter composition.'));
        }
        outputTarget=new BufferTarget();
      }
      output=new Output({format:profile.extension==='mp4'?new Mp4OutputFormat():new WebMOutputFormat(),target:outputTarget});
      const videoSource=new CanvasSource(renderCanvas,{codec:profile.video,quality:new Quality({bitrate:900000})});
      const audioSource=new AudioBufferSource({codec:profile.audio,quality:new Quality({bitrate:96000})});
      output.addVideoTrack(videoSource,{frameRate:FPS});
      output.addAudioTrack(audioSource);
      exportProgress(l('元音声と説明音声を合成しています…','Composing source audio and explanations…'));
      await output.start();
      checkExportCancelled();

      // Bound peak audio memory independently of completed movie length.
      // AudioBufferSource.add() appends each 2-second rendered block with
      // encoder backpressure; we no longer allocate one movie-long PCM buffer.
      const sampleRate=48000;
      const channels=profile.extension==='mp4' ? 2 : originalAudio ? Math.min(2,Math.max(1,await originalAudio.getNumberOfChannels())) : 1;
      const maxAudioBlockSamples=sampleRate*2;
      const sinks=new Map();
      const seenAudio=new Set();
      if(originalAudio) sinks.set('original',new AudioBufferSink(originalAudio));
      for(const item of audioInputs) sinks.set(item.note.id,new AudioBufferSink(item.track));
      let audioSamplesWritten=0;
      for (const seg of timeline.segments) {
        const outputStartSamples=Math.round(seg.outputStart/FPS*sampleRate);
        const outputEndSamples=Math.round((seg.outputStart+seg.length)/FPS*sampleRate);
        const totalSamples=outputEndSamples-outputStartSamples;
        const sink=seg.kind==='original' ? sinks.get('original') : sinks.get(seg.note.id);
        const segmentSourceStart=seg.kind==='original' ? seg.sourceStart/FPS : 0;
        const trackId=seg.kind==='original' ? 'original' : seg.note.id;
        for (let offset=0;offset<totalSamples;offset+=maxAudioBlockSamples) {
          checkExportCancelled();
          const count=Math.min(maxAudioBlockSamples,totalSamples-offset);
          const start=segmentSourceStart+offset/sampleRate;
          const end=start+count/sampleRate;
          const context=new OfflineAudioContext(channels,count,sampleRate);
          if(sink) {
            function addAudioSlice({buffer,timestamp}) {
              const left=Math.max(start,timestamp);
              const right=Math.min(end,timestamp+buffer.duration);
              if(right-left<1/sampleRate)return;
              const node=context.createBufferSource();
              node.buffer=buffer;
              node.connect(context.destination);
              node.start(Math.max(0,left-start),Math.max(0,left-timestamp),right-left);
              seenAudio.add(trackId);
            }
            // Include the sample that began before the requested block edge.
            const preceding=await sink.getBuffer(start);
            if(preceding) addAudioSlice(preceding);
            for await(const item of sink.buffers(start,end)) {
              checkExportCancelled();
              if(preceding&&Math.abs(item.timestamp-preceding.timestamp)<1e-7) continue;
              addAudioSlice(item);
            }
          }
          const rendered=await context.startRendering();
          checkExportCancelled();
          await audioSource.add(rendered);
          checkExportCancelled();
          audioSamplesWritten+=count;
        }
      }
      if(audioSamplesWritten!==Math.round(timeline.frames/FPS*sampleRate)) {
        throw new Error('Audio timeline sample count mismatch');
      }
      if(originalAudio&&!seenAudio.has('original')) {
        throw new Error(l('元動画の音声を読み取れません。','Could not decode source soundtrack.'));
      }
      for(const item of audioInputs) {
        if(!seenAudio.has(item.note.id))throw new Error('Explanation audio missing: '+item.note.id);
      }
      exportProgress(l('元動画と説明を結合しています…','Composing original frames and explanations…'));

      const sink=new VideoSampleSink(vt);
      const firstVideoTimestamp=await vt.getFirstTimestamp();
      let segIndex=0;
      const clipEvents=new Map();
      const clipDrawings=new Map();
      for(let frame=0;frame<timeline.frames;frame++) {
        checkExportCancelled();
        while(frame>=timeline.segments[segIndex].outputStart+timeline.segments[segIndex].length)segIndex++;
        const seg=timeline.segments[segIndex];
        if(!seg)throw new Error('Timeline segment not found at output frame '+frame);
        if(seg.kind==='explanation') {
          const rel=(frame-seg.outputStart)/FPS;
          let index=clipEvents.get(seg.note.id)||0;
          let strokes=clipDrawings.get(seg.note.id)||[];
          while(index<seg.note.events.length&&seg.note.events[index].at<=rel) {
            strokes=seg.note.events[index].strokes;
            index++;
          }
          clipEvents.set(seg.note.id,index);
          clipDrawings.set(seg.note.id,strokes);
          renderCtx.drawImage(seg.note.freeze,0,0,renderCanvas.width,renderCanvas.height);
          renderCtx.save();
          renderCtx.lineCap='round';renderCtx.lineJoin='round';
          for(const stroke of strokes) {
            if(!stroke.length)continue;
            renderCtx.beginPath();
            renderCtx.moveTo(stroke[0].x*renderCanvas.width,stroke[0].y*renderCanvas.height);
            for(const p of stroke.slice(1))renderCtx.lineTo(p.x*renderCanvas.width,p.y*renderCanvas.height);
            renderCtx.lineWidth=Math.max(3,renderCanvas.width/120);
            renderCtx.strokeStyle='#141414';
            renderCtx.stroke();
            renderCtx.lineWidth=Math.max(2,renderCanvas.width/170);
            renderCtx.strokeStyle='#ffe36b';
            renderCtx.stroke();
          }
          renderCtx.restore();
        }else{
          const originalFrame=seg.sourceStart+(frame-seg.outputStart);
          const sourceTime=sourceSampleTime(originalFrame,FPS,duration,firstVideoTimestamp);
          const sample=await sink.getSample(sourceTime);
          if(!sample)throw new Error(l('元動画のフレームを読み出せません。','Could not decode an original frame.'));
          try {sample.draw(renderCtx,0,0,renderCanvas.width,renderCanvas.height);}
          finally {sample.close();}
        }
        checkExportCancelled();
        await videoSource.add(frame/FPS,1/FPS,{keyFrame:frame===seg.outputStart});
        if(frame%15===0){
          exportProgress(l('書き出し中 ','Encoding ')+Math.round((frame+1)/timeline.frames*100)+'%');
          await new Promise(resolve=>setTimeout(resolve,0));
        }
      }
      checkExportCancelled();
      await output.finalize();
      checkExportCancelled();
      const encoded=temporaryResult ? await temporaryResult.handle.getFile() : output.target.buffer;
      checkExportCancelled();
      const resultBlob=encoded && new Blob([encoded],{type:profile.mime});
      if(!resultBlob||resultBlob.size<2048)throw new Error('Encoded output is empty');
      candidateUrl=URL.createObjectURL(resultBlob);
      await checkResultPlayable(candidateUrl);
      checkExportCancelled();
      // Commit only after the candidate passes decode. A failed retry keeps the prior output.
      clearResult();
      state.resultBlob=resultBlob;
      state.resultUrl=candidateUrl;candidateUrl=null;
      playback.src=state.resultUrl;playback.load();
      $('resultExtension').textContent='.'+profile.extension;
      updateShare();
      state.resultTemp=temporaryResult;
      temporaryResult=null;
      $('result').dataset.storage=state.resultTemp ? 'temporary-file' : 'memory';
      $('result').hidden=false;
      $('resultInfo').textContent=l('完成動画 ','Output ')+fmt(fullDuration)
        +' · '+profile.label+' · '+Math.round(resultBlob.size/1024)+' KiB'
        +' · '+ordered.length+l('件の説明',' inserted explanation(s)');
      $('exportStatus').textContent=l('完成動画を生成しました。最後まで再生して確認してください。',
        'Composition complete. Play the entire output to check it.');
    }catch(error){
      cancelled=error===exportCancelled;
      if(!cancelled) showError(error);
      if(error===exportCancelled) exportProgress('');
      else
      $('exportStatus').textContent=l('書き出しできませんでした。説明区間と前回の完成動画（ある場合）は保持しています。前回の動画を先に保存してください。このページを開いたまま、端末の空き容量を確認して再試行できます。ページの再読み込みやサイトデータの削除は避けてください。',
        'Export failed. Your explanations and previous successful output (if any) are retained. Save the previous output first. Keep this page open, check available device storage and retry. Avoid reloading or clearing site data.');
      if(output && output.state!=='finalized' && output.state!=='canceled'){
        try {await output.cancel();}catch{}
      }
    }finally{
      if(candidateUrl) URL.revokeObjectURL(candidateUrl);
      if(temporaryResult) await pendingExportCleanup.remove(temporaryResult);
      renderCleanupWarning();
      videoInput?.dispose();
      for(const item of audioInputs) item.input?.dispose();
      exportTask=null;
      $('cancelExport').hidden=true;
      if(cancelled && pendingExportCleanup.size) $('exportStatus').textContent=l('書き出しは停止しましたが、一時ファイルの削除が未完了です。下の案内を確認してください。','Export stopped, but temporary-file cleanup is pending. Follow the cleanup guidance.');
      else if(cancelled) $('exportStatus').textContent=l('書き出しを中止しました。説明と前回の完成動画は保持しています。再試行できます。','Export cancelled. Explanations and the previous output are retained. You can retry.');
      setBusy(false);
    }
  }
  $('export').addEventListener('click',()=>void exportVideo());
  function outputName() {return resultFilename($('outputName').value,state.resultBlob?.type);}
  function outputFile() {return new File([state.resultBlob],outputName(),{type:state.resultBlob.type});}
  function updateShare() {
    let supported=false;
    try {supported=Boolean(state.resultBlob && navigator.share && navigator.canShare?.({files:[outputFile()]}));}catch{}
    $('share').hidden=!supported;
  }
  $('outputName').addEventListener('input',updateShare);
  $('save').addEventListener('click',()=>{
    if(!state.resultUrl)return;
    const a=document.createElement('a');a.href=state.resultUrl;a.download=outputName();
    document.body.append(a);a.click();a.remove();
    $('saveStatus').textContent=l('保存操作を開始しました。端末の保存先を確認してください。結果は再保存できます。','Save requested. Check your device for the file; the result remains available to save again.');
  });
  $('share').addEventListener('click',async()=>{
    if(!state.resultBlob)return;
    try {
      await navigator.share({files:[outputFile()]});
      $('saveStatus').textContent=l('共有操作を終了しました。結果は保持しています。','Share action completed. The result is retained.');
    }catch(e){
      $('saveStatus').textContent=e.name==='AbortError'
        ? l('共有を取り消しました。結果は保持しています。','Sharing cancelled. The result is retained.')
        : l('共有できませんでした。保存を試してください。結果は保持しています。','Sharing failed. Try Save; the result is retained.');
    }
  });
  function retainRecovery(session) {
    const blob=new Blob(session.chunks,{type:session.recorder.mimeType||'audio/webm'});
    if(!blob.size)return;
    if(session.recoveryIndex===null) {
      session.recoveryIndex=state.recoveryBlobs.length;
      state.recoveryBlobs.push(blob);
    }else state.recoveryBlobs[session.recoveryIndex]=blob;
    renderRecovery();
  }
  function renderRecovery() {
    $('recovery').hidden=!state.recoveryBlobs.length;
    $('recoveryFiles').replaceChildren();
    state.recoveryBlobs.forEach((blob,index)=>{
      const button=document.createElement('button');button.type='button';
      button.textContent=l('未検証の音声を保存 ','Save unverified audio ')+(index+1);
      button.addEventListener('click',()=>{
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download='unverified-narration-'+(index+1)+'.'+(blob.type.includes('mp4')?'m4a':'webm');
        document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      });
      $('recoveryFiles').append(button);
    });
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden && state.session && !state.session.finishing) {
      state.session.error=new Error(l('画面が非表示になり録音を中断しました。','Recording interrupted because the page became hidden.'));
      void endExplanation();
    }
  });
  window.addEventListener('beforeunload',event=>{
    if(state.notes.length || state.session || state.recorder || state.recoveryBlobs.length) {event.preventDefault();event.returnValue='';}
  });
  async function cleanupStaleTemporaryOutput() {
    // OPFS is persistent across abnormal shutdowns. Remove only this app's own
    // expired temporary outputs; never touch user-selected/saved video files.
    if(!navigator.storage?.getDirectory) return;
    try {
      const directory=await navigator.storage.getDirectory();
      for await (const [name,handle] of directory.entries()) {
        if(handle.kind!=='file' || !/^pause-and-tell-temp-[0-9a-f-]+\.(webm|mp4)$/.test(name)) continue;
        try {
          const file=await handle.getFile();
          if(Date.now()-file.lastModified>24*60*60*1000) await directory.removeEntry(name);
        }catch{/* Another tab may be writing; leave it untouched. */}
      }
    }catch{/* OPFS can be unavailable under file://, privacy or storage restrictions. */}
  }
  void cleanupStaleTemporaryOutput();
  window.addEventListener('pagehide',event=>{
    // Back/forward cache retains this live page; keep its inputs and URLs valid.
    if(event.persisted)return;
    stopRecordingClock();
    state.mic?.getTracks().forEach(t=>t.stop());
    if(state.input)state.input.dispose();
    clearResult();
    for(const k of ['sourceUrl','noteUrl'])releaseUrl(k);
  });
  translate();setBusy(false);void inspectCapabilities();
})();
