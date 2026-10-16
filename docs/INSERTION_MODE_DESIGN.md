# Pause & Tell — explanation insertion mode

> Design proposal only (2026-10-16), not implemented in v0.9.3. Not proof of mobile performance.

## User goal

Given a 30-second original clip, seek to 10.0 seconds and record a 15-second spoken explanation with still-frame pen/arrow markup. The exported 45-second video should contain every original frame in order, with a 15-second annotated still-frame and voice inserted at 10.0 seconds. The source file must never be modified. For source video containing sound, preserve the original soundtrack before/after the insertion and stop it during the insert.

## Intended workflow

1. Choose an original video; freely seek to a timestamp.
2. Start a standalone explanation clip at that timestamp; keep the source frame still while recording only narration and annotations.
3. Finish the explanation clip and store `{ sourceTime, explanationDuration, voice, frames }` (with a stable clip ID).
4. Add multiple clips at arbitrary positions. Allow delete, redo, and adjustment before final export.
5. Export one new video composed as source [0, t1] + explanation at t1 + source [t1, t2] + ... + the source tail, keeping all original footage and preserving source-audio timing.

## Difference from v0.9.3

Current implementation records Canvas video + mic audio continuously using MediaRecorder. Seeking the original after recording starts simply changes the displayed source position in the live output; skipped frames and original audio cannot be restored from that recording. It would be misleading to present this as an insertion workflow.

## Implementation options

- **Browser APIs, real-time final rendering:** Keep the original file as a Blob URL, capture each explanation independently, then render the complete composition from start to finish through Canvas + Web Audio + MediaRecorder. This can avoid large new WASM dependencies but requires the entire composition duration to elapse again during export; re-encoding quality and background interruptions remain real concerns.
- **Local FFmpeg/WASM composition:** Retain time-stamped explanation segments; mux or re-encode source intervals and inserted segments entirely in the browser. Works in principle without server upload, but codec/container mismatches, keyframe cuts, original-audio mixing, higher memory/CPU cost, Worker/WASM/CSP and single-HTML size must all be tested. Do not assume arbitrary MP4 source clips can be concatenated without re-encoding.
- **WebCodecs + muxing:** Could give explicit control over time stamps with compatible codecs but does not guarantee cross-browser demuxing/muxing or iOS native playback. More engineering and compatibility work.

## Recommended proof and acceptance

1. One insertion into a short *silent* landscape clip: compare original frames before and after the insertion, and verify output duration is `sourceDuration + explanationDuration`.
2. Verify a short original soundtrack survives before/after insertion, narration is present in insert, and there is no duplicated original audio.
3. Multiple inserts, deletions, editing order, portrait/rotation and saved-file playback in an independent player.
4. Verify memory recovery, interrupted export and resource cleanup, then run Android Chrome and iPhone Safari device tests before claiming long or mobile support.

Treat a working one-insertion output as the gate before replacing the current one-take recorder. Keep the existing Draft PR unmerged until the user confirms the desired primary workflow.
