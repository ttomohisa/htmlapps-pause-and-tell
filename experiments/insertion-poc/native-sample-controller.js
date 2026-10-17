// Transactional synthetic result: failed/late runs never replace the last success.
export function createSampleController(encode, timeoutMilliseconds=30000) {
  const state={blob:null,busy:false,timedOut:false,async generate(){
    if(state.busy)throw Error('busy');
    if(state.timedOut)throw Error('timeout: save the previous result, then reload before retry');
    state.busy=true;
    const abort=new AbortController();let timer;
    try {
      const candidate=await Promise.race([
        Promise.resolve().then(()=>encode(abort.signal)),
        new Promise((_,reject)=>{timer=setTimeout(()=>{state.timedOut=true;abort.abort();reject(Error('30-second response timeout。前回結果を保存してからページを再読み込みしてください。'));},timeoutMilliseconds);})
      ]);
      if(!(candidate instanceof Blob)||!candidate.size)throw Error('empty encoded output');
      state.blob=candidate;return candidate;
    }finally{clearTimeout(timer);state.busy=false;}
  }};
  return state;
}
