# Isolated MP4/VFR feasibility probe

This is an opt-in laboratory, not a new export option. Normal v0.9.3 and the insertion app's WebM encoder settings are unchanged.

## Questions and measured outcomes

1. Can the installed browser encode AVC at 320×180/15fps/900kbps and AAC at 48kHz/two channels/96kbps? `probe-codecs.js` checks these configurations, then actually writes a two-second MP4 when AVC is available. Missing AAC produces an explicitly **video-only** result, not a narration-capable MP4 success. Unsupported is a useful measured outcome.
2. Does the actual MP4 decode independently? FFprobe checks H.264, dimensions, duration and AAC/two channels where present. FFmpeg verifies red-to-green frames around one second and, where AAC exists, the audio onset within 80ms of that transition.
3. Can existing WebM composition preserve a source with irregular frame timestamps and 44.1kHz stereo Vorbis? The opt-in fixture verifies its own timestamp variability, sample rate and channels before using the ordinary insertion path. It checks two insertions, source head/tail, 440Hz-left/660Hz-right channel separation before/after, narration on both channels and the existing output/privacy checks.

The MP4 probe does not prove insertion composition, real microphone AAC recording, OPFS MP4 output, phone support or OS saving/sharing. The VFR fixture is one synthetic case, not arbitrary camera footage or long-term A/V drift proof. Video output from the app remains fixed 15fps WebM.

## Run only at a milestone

`.github/workflows/insertion-codec-probe.yml` runs via workflow_dispatch, or an explicit temporary `[run-codec-probe]` tag on the Draft PR title. Remove the tag after admission. Ordinary pushes do not run this probe. Results, generated MP4 when available, the VFR input/output and standalone probe HTML are retained for seven days as `insertion-codec-vfr-probe`.

Locally build the normal PoC and `node build-codec-probe.mjs`, serve `experiments/insertion-poc/dist`, then run `test-codec-probe.py --out <evidence>` and `test-smoke.py --vfr-stereo --multiple --out <evidence>`. The ordinary short suite does not use `--vfr-stereo`.

## Dependency and distribution boundary

The pinned Mediabunny 1.61.5 package supplies Mp4OutputFormat, canEncodeVideo, canEncodeAudio, CanvasSource and AudioBufferSource. Its codec availability still depends on the browser. No optional AAC encoder, WASM package or server processing is added.

Mediabunny's package license is MPL-2.0; its exact source package includes src/ and LICENSE. THIRD_PARTY_NOTICES.md and the standalone PoC now include the license/source information. Library source remains unmodified. Optional software encoders and codec patent/distribution considerations require a separate review before shipping; this document does not provide legal clearance.

Primary references checked 2026-10-17:
- https://mediabunny.dev/guide/supported-formats-and-codecs
- https://registry.npmjs.org/mediabunny/-/mediabunny-1.61.5.tgz
- https://www.mozilla.org/en-US/MPL/2.0/FAQ/

## Next decision

If AVC and AAC both actually encode/decode, the next bounded experiment is the existing insertion timeline with an isolated MP4 output adapter and equivalent source/narration/boundary checks. Do not expose MP4 in the app until that result and the intended device save path are verified. If AAC is unavailable, retain WebM and evaluate a separately licensed local audio encoder only after measuring bundle/memory cost; do not silently emit video without narration.

## 2026-10-17 first measured result (d9c6ff3)

Run: https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39005592114

- Ubuntu Chromium 155: AVC false, AAC false, `UNSUPPORTED_AVC`.
- Ubuntu Google Chrome 155: AVC true, AAC false. A 1,747-byte video-only MP4 was produced and independently decoded, including its red/green frames and two-second duration. This cannot carry the narration. No MP4 product support is established.
- Both browsers reported no page errors or external requests in the codec probe.
- The VFR/stereo fixture failed existing export with “Could not decode an original frame.” Its first video PTS is +0.003 seconds; Mediabunny explicitly returns null for a request before the first track timestamp. The export requested timestamp zero. This is a nonzero-start failure exposed by the VFR fixture, not proof that all VFR itself fails.
- A bounded correction holds the first frame for the initial timestamp gap without shifting the source clock or audio. Pure clock tests cover positive/negative first PTS, later frame timestamps and tail clamp. Browser rerun is required before marking the fixture verified.

AAC fallback remains a separate investigation. The immediate next goal is to pass the actual VFR/stereo insertion fixture and test the HTTPS PoC on physical iOS/Android; no unverified MP4 option is shown.
