import assert from 'node:assert/strict';
import { buildTimeline } from './timeline.js';
function minimal(source,notes,expected) {
  const timeline=buildTimeline(source,notes,15);
  assert.deepEqual(timeline.segments.map(x=>[x.kind,x.sourceStart,x.outputStart,x.length]),expected);
  assert.equal(timeline.frames,timeline.segments.reduce((sum,x)=>sum+x.length,0));
  return timeline;
}
minimal(4,[],[['original',0,0,60]]);
minimal(4,[{id:1,position:2,duration:2}],[
  ['original',0,0,30],['explanation',30,30,30],['original',30,60,30]
]);
const first={id:1,position:1,duration:1},second={id:2,position:3,duration:2};
const two=minimal(4,[second,first],[
  ['original',0,0,15],['explanation',15,15,15],
  ['original',15,30,30],['explanation',45,60,30],
  ['original',45,90,15]
]);
assert.equal(two.duration,7);
minimal(4,[{id:1,position:2,duration:1},{id:2,position:2,duration:1}],[
  ['original',0,0,30],['explanation',30,30,15],
  ['explanation',30,45,15],['original',30,60,30]
]);
minimal(4,[{id:1,position:0,duration:1},{id:2,position:4,duration:1}],[
  ['explanation',0,0,15],['original',0,15,60],['explanation',60,75,15]
]);
assert.throws(()=>buildTimeline(4,[{id:0,position:1,duration:0}],15));
assert.throws(()=>buildTimeline(0,[],15));
console.log('PASS insertion timeline: empty, single, multi, same-point, boundaries, invalid');
