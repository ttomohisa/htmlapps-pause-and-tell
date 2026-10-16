# Pause & Tell insertion PoC — v0.10.0–v0.11.0 verification

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

- Historical v0.10.0 test: one insertion, one Pen tool, silent source only. v0.10.1 adds support for original soundtrack before and after one insertion, validated separately below.
- Experiment uses a maximum 15-second source and 30 MiB input; insertion maximum 15 seconds, output under 32 seconds. This is NOT equivalent to the current v0.9.3 trial limits.
- Encoding uses Mediabunny 1.61.5, WebCodecs and memory-only OfflineAudioContext/BufferTarget, generating WebM (VP8/Opus). It re-encodes original video frames; not lossless.
- No physical iPhone Safari, Android Chrome, native save/share, large-file, phone interruption, multiple insertions, VFR/rotation, diverse original audio formats or accessibility acceptance has been completed.
- Mediabunny is MPL-2.0; esbuild build pin is 0.25.12. Dependencies are embedded at build time; evaluate distribution license obligations before release.

## Next gate

1. Preserve audio from the original source outside explanations, with narration only during the inserted region, validated from independently decoded output.
2. Add ordered multiple independent explanations, per-segment editing, delete/re-record, and robust stop/cancel.
3. Add streaming output for larger files, audio/video codec and rotation coverage, MP4 options, and physical Android/iPhone testing.
4. Only after acceptance, integrate the insertion mode into the normal app while preserving the tested one-take recorder as a fallback.

## v0.10.1 original-soundtrack proof — 2026-10-16

The isolated PoC now preserves the original audio outside a narrated insert, using Mediabunny AudioBufferSink and an OfflineAudioContext timeline. Each original sample chunk is clipped to the pre-insert or post-insert interval and scheduled at the corresponding output timestamp; the narration track occupies the insert only. This is source *audio content preservation through decode/re-encode*, **not bit-exact stream-copy**.

**Verified artifact**: [Chromium/ffprobe CI run 38863341916](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38863341916) · [standalone HTML, silent and audio-bearing WebMs, JSON measurement reports](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38863341916/artifacts/12030545189).

| Source fixture | Output | Original 440 Hz before / during / after insert | Narration 800 Hz during insert | Result |
| --- | --- | --- | --- | --- |
| 4s silent VP8 source | 5.88s VP8/Opus WebM | 0 / ~0 / 0 | ~0.302 | PASS |
| 4s VP8/Opus source with 440 Hz tone | 5.94s VP8/Opus WebM | **0.12491 / 0.000005 / 0.12497** | **0.30182** | **PASS** |

Both pass actual opening/closing source frame comparisons (mean RGB absolute channel error ~2.02 / 2.01), show zero JavaScript exceptions and no external HTTP requests. The artificial microphone signal does not occur in original intervals. Source audio does not leak into the explanation interval. The test also verifies microphone tracks are released.

**As of v0.10.1**, multiple explanation segments were still missing. v0.11.0 now covers basic multi-clip insertion in a separate validation below. Still missing for production: native saved-file playback on iPhone/Android, varied source audio sample rate/channels and drift, VFR/rotation, interruption recovery, streaming output and broad codec support.

## v0.11.0 multi-insertion PoC — 2026-10-16

**Automated Chromium/ffprobe PASS**: [run 38864515775](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38864515775) · [generated HTML, source/output files, screenshots, JSON measurements](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38864515775/artifacts/12030473749).

The time-axis builder (`timeline.js`) passes Node unit tests for empty/single/multiple inserts, identical source timestamps, source-start/end insertions and invalid input. The browser test adds a voice-and-pen segment at source 2.0s, adds another at 3.0s, **deletes the second and rerecords it**, then exports and decodes the complete original footage with two insertions.

| Measured result | Value |
| --- | --- |
| Original VP8/Opus audio-bearing source | 4.00s |
| Finished WebM with 2 independent explanations | **6.74s** |
| Output video / audio codec | VP8 / Opus |
| Source 440 Hz tone before/after insertion | 0.12491 / 0.12502 amplitude |
| Original 440 Hz tone inside first insertion | 0.000005 amplitude |
| Narration 800 Hz inside first insertion | 0.30182 amplitude |
| Decoded RGB frame difference opening / final source segment | 2.02 / 2.04 (mean absolute per channel) |
| Uncaught page errors / external HTTP requests | 0 / 0 |

Tests also check that original sound remains between the two explanation segments, that the second narration is present and the source sound absent inside it, and that the microphone tracks are released. Same-source-timestamp insertion ordering and 0s/end positions have **unit coverage**, not yet decoded-video acceptance. The 320px responsive assertion is under test separately; release is still **NO-GO**.

**Known limitations:** audio and frames are decoded and re-encoded; no lossless stream copy; video 15 FPS, VP8/Opus WebM only; ≤15s source, ≤30MiB input, ≤15s per explanation and ≤32s final output. Entire output is held by an in-memory BufferTarget, and an OfflineAudioContext covers the final timeline. Physical iOS Safari/Android Chrome, rotated/VFR inputs and unrelated source audio codecs remain unverified.
