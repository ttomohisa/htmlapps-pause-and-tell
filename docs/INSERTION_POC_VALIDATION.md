# Pause & Tell v0.10.0 — Insertion PoC verification

**Status:** Synthetic Chromium proof passed; product release and actual phone support are NOT approved. This is separate from the existing default v0.9.3 application.

## Verified (2026-10-16)

- CI: https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38854488665
- HTML, MP4/WebM test media, output WebM and screenshot artifact: https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38854488665/artifacts/12026996278
- Original input: moving 4.00-second silent 320x180 VP8 WebM, 253310 bytes.
- An independently captured explanation was inserted at original source time 2 seconds; approximately 1.94 seconds of voice and timestamped Pen actions.
- Final output: 5.94-second WebM / VP8 video + Opus audio, 328195 bytes, produced offline at export (NOT by re-recording the whole source in real time).
- Output has decodable narration signal: RMS 0.2127 in the explanation interval, silence asserted before and after the insertion.
- Original content checked using actual decoded RGB frames: frame difference before insertion at 0.4 seconds was 2.024; after insertion, a source frame at 3.1 seconds compared with its shifted output frame was 2.008 (per-channel mean absolute error; threshold 35).
- JavaScript runtime errors: 0. External application HTTP(S) requests: 0. Synthetic microphone tracks left active after completion: 0.

## Important limits

- One insertion, one Pen tool, silent source only. Source with any audio track is explicitly rejected (never silently discarded).
- Experiment uses a maximum 15-second source and 30 MiB input; insertion maximum 15 seconds, output under 32 seconds. This is NOT equivalent to the current v0.9.3 trial limits.
- Encoding uses Mediabunny 1.61.5, WebCodecs and memory-only OfflineAudioContext/BufferTarget, generating WebM (VP8/Opus). It re-encodes original video frames; not lossless.
- No physical iPhone Safari, Android Chrome, native save/share, large-file, phone interruption, original source audio, multiple insertions, VFR/rotation or accessibility acceptance has been completed.
- Mediabunny is MPL-2.0; esbuild build pin is 0.25.12. Dependencies are embedded at build time; evaluate distribution license obligations before release.

## Next gate

1. Preserve audio from the original source outside explanations, with narration only during the inserted region, validated from independently decoded output.
2. Add ordered multiple independent explanations, per-segment editing, delete/re-record, and robust stop/cancel.
3. Add streaming output for larger files, audio/video codec and rotation coverage, MP4 options, and physical Android/iPhone testing.
4. Only after acceptance, integrate the insertion mode into the normal app while preserving the tested one-take recorder as a fallback.
