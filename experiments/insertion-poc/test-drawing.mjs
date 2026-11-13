import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
assert.ok(existsSync(new URL('./drawing.js',import.meta.url)), 'shared drawing renderer and history exist');
const { createDrawing, rememberDrawing, undoDrawing, redoDrawing, cloneStrokes, paintStrokes, captureDrawingFrame }=await import('./drawing.js');
const d=createDrawing();assert.equal(d.tool,'pen');assert.equal(d.color,'yellow');
const stroke={tool:'arrow',color:'red',from:{x:.1,y:.2},to:{x:.8,y:.7}};
rememberDrawing(d);d.strokes.push(stroke);
const snapshot=cloneStrokes(d.strokes);stroke.to.x=.9;assert.equal(snapshot[0].to.x,.8);
assert.equal(undoDrawing(d),true);assert.equal(d.strokes.length,0);
assert.equal(redoDrawing(d),true);assert.equal(d.strokes[0].color,'red');
rememberDrawing(d);d.strokes=[];assert.equal(undoDrawing(d),true);assert.equal(d.strokes.length,1);
rememberDrawing(d);d.strokes.push({...stroke,tool:'point'});assert.equal(redoDrawing(d),false);
const calls=[];const ctx=new Proxy({}, {get:(o,k)=>o[k]??((...args)=>calls.push([k,...args])),set:(o,k,v)=>(calls.push([k,v]),o[k]=v,true)});
for(const tool of ['point','ellipse','arrow','pen'])paintStrokes(ctx,[{...stroke,tool,points:[stroke.from,stroke.to]}],320,180);
assert.ok(calls.some(c=>c[0]==='arc'));assert.ok(calls.some(c=>c[0]==='ellipse'));assert.ok(calls.some(c=>c[0]==='strokeStyle'&&c[1]==='#ff6262'));
assert.ok(calls.some(c=>c[0]==='lineWidth'&&c[1]===8));
paintStrokes(ctx,[[{x:.1,y:.2},{x:.2,y:.3}]],320,180);
assert.ok(calls.some(c=>c[0]==='strokeStyle'&&c[1]==='#ffe36b'));
console.log('Drawing tools, colors, history, immutable snapshots and legacy arrays passed');
const drawingModule=await import('./drawing.js');
assert.equal(typeof drawingModule.captureDrawingHistory,'function','gesture captures full pre-edit history');
assert.equal(typeof drawingModule.restoreDrawingHistory,'function');
const cancelled=createDrawing();
for(let i=0;i<50;i++){rememberDrawing(cancelled);cancelled.strokes=[{...stroke,color:String(i)}];}
undoDrawing(cancelled);
const before=structuredClone(cancelled),checkpoint=drawingModule.captureDrawingHistory(cancelled);
rememberDrawing(cancelled);cancelled.strokes.push(stroke);
drawingModule.restoreDrawingHistory(cancelled,checkpoint);
assert.deepEqual(cancelled,before,'Cancellation preserves redo and all bounded undo entries');
assert.equal(redoDrawing(cancelled),true);
console.log('Cancelled gesture preserves complete undo/redo history');
const fullHistory=structuredClone(cancelled),fullCheckpoint=drawingModule.captureDrawingHistory(cancelled);
assert.equal(cancelled.undoStack.length,48);
rememberDrawing(cancelled);cancelled.strokes=[];
drawingModule.restoreDrawingHistory(cancelled,fullCheckpoint);
assert.deepEqual(cancelled,fullHistory,'Cancellation restores the oldest undo entry at the 48-entry cap');

// Event history stays frame-bounded and immutable even with high-frequency pen
// movement. Finished strokes may be shared; only the active gesture is copied.
const trace=createDrawing();
const finished={tool:'point',color:'red',from:{x:.25,y:.35},to:{x:.25,y:.35}};
trace.strokes.push(finished);
const pen={tool:'pen',color:'yellow',from:{x:0,y:0},to:{x:0,y:0},points:[{x:0,y:0}]};
trace.activeStroke=pen;trace.strokes.push(pen);
const frames=[];
captureDrawingFrame(frames,trace,.01,15);
assert.equal(frames.length,1);
for(let i=1;i<=1200;i++){
  const point={x:i/1200,y:i/1200};
  pen.to=point;pen.points.push(point);
  captureDrawingFrame(frames,trace,.01+i/200,15);
}
assert.ok(frames.length<=92,'200Hz pointer updates must not create unbounded drawing events');
assert.ok(frames.every(event=>event.strokes[0]===finished),'completed strokes are reused');
const frozen=frames[0].strokes[1].to.x;
pen.to={x:-1,y:-1};pen.points.push(pen.to);
assert.equal(frames[0].strokes[1].to.x,frozen,'prior frames remain immutable after a later move');
assert.ok(!frames.some((event,i)=>i>0 && event.frame<=frames[i-1].frame),'frames are strictly increasing');
trace.activeStroke=null;
captureDrawingFrame(frames,trace,6.1,15);
assert.equal(frames.at(-1).strokes[1],pen,'completed stroke no longer requires a copy');
trace.strokes=[];
captureDrawingFrame(frames,trace,6.2,15);
assert.equal(frames.at(-1).strokes.length,0);
assert.equal(frames.at(-2).strokes.length,2,'clearing does not affect earlier frames');
console.log('Bounded drawing-frame snapshots preserve completed strokes, in-progress geometry and temporal edits');
