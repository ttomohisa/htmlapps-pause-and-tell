// Session-local drawing. Immutable snapshots preserve edits at narration time.
export const PAINT_COLORS=Object.freeze({yellow:'#ffe36b',white:'#ffffff',red:'#ff6262'});
export const cloneStrokes=strokes=>structuredClone(strokes);
export const createDrawing=()=>({tool:'pen',color:'yellow',strokes:[],undoStack:[],redoStack:[]});
export function captureDrawingHistory(d) {
  return {strokes:cloneStrokes(d.strokes),undoStack:d.undoStack.slice(),redoStack:d.redoStack.slice()};
}
export function restoreDrawingHistory(d,before) {
  d.strokes=before.strokes;d.undoStack=before.undoStack;d.redoStack=before.redoStack;
}
export function rememberDrawing(d) {
  d.undoStack.push(cloneStrokes(d.strokes));
  if(d.undoStack.length>48)d.undoStack.shift();
  d.redoStack=[];
}
export function undoDrawing(d) {
  if(!d.undoStack.length)return false;
  d.redoStack.push(cloneStrokes(d.strokes));d.strokes=d.undoStack.pop();return true;
}
export function redoDrawing(d) {
  if(!d.redoStack.length)return false;
  d.undoStack.push(cloneStrokes(d.strokes));d.strokes=d.redoStack.pop();return true;
}
export function paintStrokes(ctx,strokes,w,h) {
  for(let stroke of strokes) {
    // Older PoC fixtures are arrays of normalized pen coordinates.
    if(Array.isArray(stroke)) {
      if(!stroke.length)continue;
      stroke={tool:'pen',color:'yellow',from:stroke[0],to:stroke.at(-1),points:stroke};
    }
    const a=stroke.from,b=stroke.to;
    const x0=a.x*w,y0=a.y*h,x1=b.x*w,y1=b.y*h;
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
    if(stroke.tool==='point') {
      ctx.arc(x0,y0,Math.max(15,Math.min(31,Math.min(w,h)*.051)),0,Math.PI*2);
    } else if(stroke.tool==='ellipse') {
      if(Math.hypot(x1-x0,y1-y0)<12) {
        const radius=Math.max(12,Math.min(w,h)*.025);ctx.ellipse(x0,y0,radius,radius,0,0,Math.PI*2);
      } else ctx.ellipse((x0+x1)/2,(y0+y1)/2,Math.max(5,Math.abs(x1-x0)/2),Math.max(5,Math.abs(y1-y0)/2),0,0,Math.PI*2);
    } else if(stroke.tool==='arrow') {
      let dx=x1-x0,dy=y1-y0;
      if(Math.hypot(dx,dy)<12){dx=35;dy=-25;}
      const ex=x0+dx,ey=y0+dy,angle=Math.atan2(dy,dx),length=Math.max(12,Math.min(24,Math.hypot(dx,dy)*.25));
      ctx.moveTo(x0,y0);ctx.lineTo(ex,ey);
      ctx.moveTo(ex-length*Math.cos(angle-.58),ey-length*Math.sin(angle-.58));ctx.lineTo(ex,ey);
      ctx.lineTo(ex-length*Math.cos(angle+.58),ey-length*Math.sin(angle+.58));
    } else {
      const points=stroke.points||[a];ctx.moveTo(x0+.01,y0);
      if(points.length===1)ctx.lineTo(x0,y0);
      else {ctx.moveTo(points[0].x*w,points[0].y*h);for(const p of points.slice(1))ctx.lineTo(p.x*w,p.y*h);}
    }
    const width=Math.max(3,Math.min(8,Math.min(w,h)*.008));
    ctx.lineWidth=width+5;ctx.strokeStyle='rgba(0,0,0,.92)';ctx.stroke();
    ctx.lineWidth=width;ctx.strokeStyle=PAINT_COLORS[stroke.color]||PAINT_COLORS.yellow;ctx.stroke();
    if(stroke.tool==='point') {
      ctx.beginPath();ctx.arc(x0,y0,Math.max(2.8,Math.min(w,h)*.007),0,Math.PI*2);
      ctx.fillStyle=PAINT_COLORS[stroke.color]||PAINT_COLORS.yellow;ctx.fill();
      ctx.lineWidth=2.5;ctx.strokeStyle='rgba(0,0,0,.92)';ctx.stroke();
    }
    ctx.restore();
  }
}
