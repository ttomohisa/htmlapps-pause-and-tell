import {createSampleController} from './native-sample-controller.js';
import {encodeNativeSample} from './native-sample-encoder.js';
const byId=id=>document.getElementById(id);
const controller=createSampleController(encodeNativeSample);
let url=null;
byId('generate').onclick=async()=>{
  if(controller.busy)return;
  byId('generate').disabled=true;byId('status').textContent='合成2秒を生成中…（30秒で応答を確認）';
  try {
    const blob=await controller.generate();
    const next=URL.createObjectURL(blob),previous=url;url=next;
    byId('video').src=url;byId('video').hidden=false;
    byId('save').href=url;byId('save').hidden=false;
    if(previous)URL.revokeObjectURL(previous);
    byId('status').textContent=`生成成功: AVC + AAC / 2秒 / ${blob.size} bytes。再生して1秒で赤→緑と音の開始を確認してください。端末保存・同期の精度はまだ未確認です。`;
    byId('status').dataset.result='success';
  }catch(error){
    byId('status').textContent=`生成できませんでした: ${String(error.message||error)}${url?' 前回成功した動画はそのまま再生・保存できます。':''}`;
    byId('status').dataset.result='failed';
  }finally{byId('generate').disabled=controller.timedOut;}
};
byId('save').onclick=()=>{byId('saveStatus').textContent='保存操作を開始しました。端末の保存先でファイルと再生を確認してください。保存完了はこのページでは判定できません。';};
