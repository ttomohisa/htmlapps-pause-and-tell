// Silent explanations use elapsed wall time, bounded by the same note cap.
export function silentDuration(startedAt, endedAt, maximum) {
  const seconds=(endedAt-startedAt)/1000;
  if(!Number.isFinite(seconds)||seconds<=.15)throw new Error('Explanation is too short');
  return Math.min(seconds,maximum);
}
export function isExplanationActive(session) {
  return Boolean(session && !session.finishing &&
    (session.mode==='silent' || session.recorder?.state==='recording'));
}
