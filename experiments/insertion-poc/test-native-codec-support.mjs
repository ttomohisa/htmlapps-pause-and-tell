import assert from 'node:assert/strict';
import {queryNativeCodecSupport} from './native-codec-support.js';
assert.deepEqual(await queryNativeCodecSupport({}),{avc:'unavailable',aac:'unavailable'});
const calls=[];
class Video {constructor(){throw new Error('Must never construct encoder');} static async isConfigSupported(c){calls.push(c);return {supported:true};}}
class Audio {constructor(){throw new Error('Must never construct encoder');} static async isConfigSupported(c){calls.push(c);return {supported:false};}}
assert.deepEqual(await queryNativeCodecSupport({VideoEncoder:Video,AudioEncoder:Audio}),{avc:'supported',aac:'unsupported'});
assert.deepEqual(calls,[{codec:'avc1.42001e',width:320,height:180,framerate:15,bitrate:900000},{codec:'mp4a.40.2',sampleRate:48000,numberOfChannels:2,bitrate:96000}]);
assert.deepEqual(await queryNativeCodecSupport({VideoEncoder:{isConfigSupported(){throw new Error('query failed');}},AudioEncoder:{async isConfigSupported(){return {};}}}),{avc:'error',aac:'error'});
assert.deepEqual(await queryNativeCodecSupport({VideoEncoder:{isConfigSupported(){return new Promise(()=>{});}}},20),{avc:'timeout',aac:'unavailable'});
console.log('PASS native codec support query: no constructors, supported/unsupported, missing API, error, timeout');
