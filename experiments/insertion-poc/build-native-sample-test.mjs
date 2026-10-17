// CI fixture only: replace the encoder dependency, never the UI/controller.
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
const html=await readFile(new URL('dist/native-mp4.html',import.meta.url),'utf8');
const result=await build({entryPoints:[fileURLToPath(new URL('native-sample-page.js',import.meta.url))],bundle:true,format:'iife',write:false,plugins:[{name:'test-encoder',setup(b){
  b.onResolve({filter:/native-sample-encoder\.js$/},()=>({path:'encoder',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export async function encodeNativeSample(){ return window.testEncode(); }'}));
}}]});
await writeFile(new URL('dist/native-mp4-ui-test.html',import.meta.url),html.replace(/<script>[\s\S]*<\/script>/,()=>`<script>${result.outputFiles[0].text}</script>`));
