# Pause & Tell insertion PoC — v0.10.0–v0.11.4 verification

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

Tests also check that original sound remains between the two explanation segments, that the second narration is present and the source sound absent inside it, and that the microphone tracks are released. Same-source-timestamp insertion ordering and 0s/end positions have **unit coverage**, not yet decoded-video acceptance. The 320px phone-width horizontal-overflow check also passed in this run. Release remains **NO-GO**.

**Known limitations:** audio and frames are decoded and re-encoded; no lossless stream copy; video 15 FPS, VP8/Opus WebM only; ≤15s source, ≤30MiB input, ≤15s per explanation and ≤32s final output. Entire output is held by an in-memory BufferTarget, and an OfflineAudioContext covers the final timeline. Physical iOS Safari/Android Chrome, rotated/VFR inputs and unrelated source audio codecs remain unverified.


## v0.11.1: bounded audio and temporary-file export — 2026-10-17

**Confirmed via Chromium synthetic-media smoke:** [GitHub Actions 38933128931](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38933128931) · [real WebMs, standalone HTML and reports](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38933128931/artifacts/12059274594).

- A source clip **20 seconds long** loads (unlike the obsolete 15-second prototype cap). The test does **not** claim 5-minute output was encoded.
- Original and narration audio are assembled with at most 2 seconds of decoded output per OfflineAudioContext; MediaSource/AudioBufferSource backpressure is awaited. The former single completed-movie PCM allocation was eliminated.
- Silent-source output from memory fallback: 5.94s VP8/Opus, source image preserved at start and end, explanation tone confined to its interval, no unexpected network or page errors.
- Source-with-sound output using OPFS StreamTarget: 5.94s WebM, original 440 Hz tone before and after, microphone 800 Hz tone inside insertion. Output mode explicitly marked as `temporary-file` in the DOM for smoke verification; memory fallback is marked as `memory`.
- Two narrated inserts with source soundtrack and OPFS: 6.74s WebM, delete/rerecord cycle, original sound before, between and after the inserted sections, 320px layout without horizontal scroll. Image comparisons passed.
- Runtime ceilings now **source up to 5 minutes/250MiB; each explanation up to 2 minutes; completed video up to 10 minutes**. These *allow attempts* within the limit, not guaranteed successful renders. Memory-only fallback can reject an output if its estimated encoded size exceeds 96MiB, while OPFS depends on quota and browser support.
- OPFS may preserve temporary data after abrupt termination; normal result discard attempts deletion, and the application prunes its own older-than-24-hour expired temporary output files on startup where available. User-saved media is not deleted.

**Unverified:** actually exporting videos near the new duration/size ceilings; file://; interrupted/low-memory devices; iOS Safari and Android Chrome real audio/save, codec/rotation variation. These belong to explicit extended/device testing, **not mandatory every-commit smoke**. Release stays NO-GO.

## v0.11.2: longer-video output and safer source replacement — 2026-10-17

**Measured 30-second full export**, not just source-file load: [GitHub Actions run 38936670686](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38936670686) ([actual source and output WebM, JSON report and HTML artifact](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38936670686/artifacts/12061556814)).

| Metric | Measured result |
| --- | --- |
| Generated source | 30.00s, 320×180 at 15 FPS, VP8 video + 440 Hz Opus source audio |
| Captured narration | Approximately 1.22s, 800 Hz synthetic microphone |
| Final WebM | **31.22s**, VP8 + Opus |
| Original source bytes | 1,589,521 |
| Composed output bytes | 2,683,846 |
| Local output path | OPFS temporary file + verified downloaded WebM |
| Source-tail frame mean absolute RGB difference | **2.1765** (threshold 35) |
| Uncaught page errors / external app requests | 0 / 0 |
| Environment | Linux Chromium on GitHub Actions; **not physical iPhone/Android** |

The browser test independently decodes the output and checks the 440 Hz source sound before and after the insertion, the 800 Hz narration only in the inserted interval, source audio absent during insertion, output duration, and tail-frame preservation. The export was measured at approximately 28.3s elapsed for the whole automated test, including synthetic file generation and voice capture; this is **not an isolated encoding performance metric**.

Added source-switch guard: after clips have been recorded, replacing the source prompts the user; cancel keeps the original and recordings. Invalid replacement inputs do not erase the explanation list. Failure of the candidate preview should restore the prior video. The source's original sound is audible on user-triggered playback, and the player pauses before microphone recording.

**Test split**: short correctness regression stays on PR; [extended endurance workflow](../.github/workflows/insertion-endurance.yml) is opt-in only (manual dispatch, or an explicit `[run-endurance]` Draft PR title edit before merge). A single 30s passing test does not validate 60s/180s/300s, nonstandard codecs, abrupt interruption, storage quota failure, long-form memory use or real mobile devices.

## v0.11.3 — longer source and MP4 input evidence (2026-10-17)

**Two opt-in independently verified output files** (synthetic microphone, Ubuntu GitHub Actions):

| Original fixture | Browser | Saved WebM | Verified media | Evidence |
| --- | --- | --- | --- | --- |
| 60.00s VP8/Opus WebM | Chromium | **61.22s**, 5,379,665 bytes | original tail RGB error 2.188; original 440 Hz sound before/after, 800 Hz explanation inside; no app HTTP/errors | [Run 38943079843](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38943079843) · [files](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38943079843/artifacts/12063569028) |
| 30.00s H.264/AAC MP4 | **Google Chrome** | **31.22s**, 3,145,773 bytes | original tail RGB error 11.361; original soundtrack and narration before/inside/after; no app HTTP/errors | [Run 38943039604](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38943039604) · [files](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38943039604/artifacts/12063813211) |

**Limits of these results:** The runner's ordinary Chromium did not play H.264 MP4 (input stage returned unsupported); Google Chrome on the same runner succeeded. This is a browser codec/packaging difference. Do not extrapolate Chrome success to all browsers, MOV/HEVC, all MP4 profiles, phone hardware or MP4 *output*. The output remains WebM (VP8/Opus). Both original sources were 320×180 at 15 FPS. Longer/more complex files remain unverified.

**60s regression investigation:** An earlier test failed extracting a tail frame with fast `ffmpeg -ss ... -i output.webm`. The test was changed to decode sequentially `-i ... -ss` with bounded FFmpeg threads and preserve actual stderr on any failure. The updated 60s regression passed; no supported conclusion about universal indexed seeking follows from this test.

**Accepted next tests:** At milestones, check 180-second original in a desktop browser with actual saved file, then portrait/rotation and audio channel/sample-rate variations. Physical Android Chrome and iPhone Safari microphone/export/playback and storage interruption remain mandatory before release. See [test policy](INSERTION_TEST_POLICY.md).

## v0.11.4 — aspect-accurate portrait annotations and MP4 display rotation (2026-10-17)

**Portrait WebM proof**: [Chromium CI run 38951138278](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38951138278), [raw fixture/composed WebM, screenshots, report](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38951138278/artifacts/12069241050).
A 4-second, 180×320 VP8/Opus portrait source received a timestamped Pen and microphone narration and saved a 5.94-second VP8/Opus portrait WebM (180×320). The actual displayed `canvas` aspect ratio matches the source, and the regression asserts that a region crossed by the pointer-drawn line differs from the corresponding original frame **in the encoded explanation interval**. Opening and trailing original frames remain present (mean per-channel RGB errors 1.99 and 1.98); original soundtrack plays only in source intervals and narration only inside the inserted clip; no JavaScript errors or external HTTP requests. Other existing silent, source-audio and multi-insert cases passed in the same run.

**MP4 track rotation proof**: [Google Chrome CI run 38950823277](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38950823277), [input/output media and report](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38950823277/artifacts/12068911322). A 30-second 320×180 H.264/AAC MP4 with an actual 90° display matrix (verified with ffprobe) was imported, annotated, and exported to a 31.14-second **180×320** VP8/Opus WebM. Original tail video remained recognizable (mean absolute RGB difference 11.367) and audio intervals preserved. This is **MP4 input to WebM output**, not MP4 output or lossless passthrough.

**Limitations:** Both desktop tests use 15 FPS synthetic media, supported WebCodecs, and an available microphone signal simulator. They do not establish end-to-end physical smartphone support, rotate metadata correctness for every MOV/HEVC file, VFR timing/accurate timestamp handling, differing aspect ratios or audio channel layouts, or actual 5-minute mobile output acceptance.


## v0.11.5 smartphone preparation and failure safety (2026-10-17)

Scope is the isolated PoC only. Runtime feature detection selects a supported microphone MIME candidate (WebM/Opus first, MP4/AAC audio second), checks source decode capability and checks VP8/Opus encoder configurations. A positive probe is not a successful device recording/export test. Composed video remains 15fps VP8/Opus WebM; MP4 microphone audio does not imply MP4 video output.

Interrupted recording, an encoder error, or a missing stop event must restore controls, release microphone tracks and preserve completed explanations. Partial narration is offered as **unverified** audio, never silently inserted. Multiple recovery items are retained until confirmed source replacement. Reload/crash recovery is not implemented. Visibility loss deliberately interrupts narration; background capture is not promised.

Export builds and validates a candidate before replacing the prior successful output. Failed retry keeps the prior preview and downloadable bytes. Save uses an editable sanitized filename; file sharing is offered only after canShare checks the actual File. A save request is not proof of OS storage completion; share cancellation/failure keeps the result.

Local build, JavaScript parse and timeline tests pass. Local Chromium could not start because the execution sandbox disallows its Unix socket; local browser suites therefore did **not** run. CI evidence for the new resilience suite is recorded separately once complete. No physical-phone, long-duration, MP4-output or VFR pass is claimed.

### MP4 video output feasibility and next gate

The pinned Mediabunny API contains Mp4OutputFormat and AVC/AAC encoder probes; this provides a candidate implementation path, not evidence that every phone supplies both encoders. Before exposing MP4, probe the exact AVC dimensions/profile and AAC channel/sample-rate configuration, encode a short real MP4, independently decode its audio/video, verify insert boundaries and device save/share, and review distribution/license requirements. Do not rename a WebM extension or transcode through an external service.

VFR remains a separate milestone: the current renderer samples source timestamps onto a 15fps output clock; it does not preserve source frame rate. Test irregular timestamps with audible/visible boundary markers, 44.1kHz stereo source audio and multiple insertion points. Measure duration, original head/tail, boundary drift and narration alignment on the actual saved file. None of these cases is marked verified by this change.

## 2026-10-17 — bounded native MP4 and VFR/stereo probe

- Native MP4 laboratory at d51aab7: Linux Chromium 155 AVC/AAC unavailable;
  Google Chrome 155 AVC available, AAC unavailable. A video-only two-second
  MP4 independently decoded. Narration-capable MP4 output remains unverified
  and unavailable in the app.
- VFR/stereo RED → GREEN: first video PTS +3ms caused timestamp-zero retrieval
  to return null. Holding the first visible frame before its positive start,
  without shifting the rest of the source/audio clock, fixed this fixture.
- Saved 6.74s VP8/Opus file from 4s irregular-timestamp 44.1kHz stereo input:
  two insertions, delete/rerecord, source head/tail, separate left/right source
  tones and narration verified; OPFS, zero page errors/external requests.
- Evidence: https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39005916146/artifacts/12091127151
- Not verified: real phone VFR, longer drift, native phone codecs, microphone
  interruptions/OS saving. See INSERTION_CODEC_PROBE.md for exact probe limits.

## Cooperative export cancellation (2026-10-17)

The insertion PoC offers Cancel export during composition. Cancellation is checked
between bounded audio blocks/video frames and after finalization, file retrieval,
and candidate playback validation. It cannot interrupt an in-flight codec call;
controls remain locked until cancellation and temporary-file cleanup settle.
Completed explanations and the previous successful download are retained. A real
encoding/storage failure after a stop request remains a failure, not a successful
cancellation. No native codec, timeline, public CSP, or normal-app behavior changes.

The existing short failed-export regression now injects cancellation at writable
creation, the first encoded frame, and finalized-file retrieval; it also injects a
real error after a stop request. Cleanup is deliberately held to assert the UI lock,
then released to check exact temporary-file inventory, old download SHA, explanation
retention, and retry via the existing storage/retry cases. These are synthetic
browser tests, not physical-device interruption or storage-exhaustion evidence.
Local syntax, build and timeline/profile tests pass. [Browser CI 39027054306](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39027054306) passed at 39fa4c4, including all four media scenarios and seven resilience cases. All four routine workflows passed. The first run stopped at a test-only string-predicate/CSP error; changing the wait to a function fixed it without relaxing CSP. Independent code review found no remaining blocker after writable ownership and error-versus-cancellation fixes.

## Recording-time guidance and remaining delivery scope

The isolated editor now shows elapsed narration time and the approximate time to
its existing 120-second per-clip automatic stop. A separate, frame-rounded estimate
includes the in-progress narration in the selected output format's duration budget.
Rerecording substitutes the candidate for the old clip in this estimate. Crossing
the MP4 30-second output limit does not automatically stop or delete a recording;
actual decoded duration is validated again when recording finishes. The estimate
is guidance, not an encoder performance promise. The display stops on finishing,
cancellation or error. [Browser CI 39027570070](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39027570070) passed at b32e4cf, including elapsed/remaining display, replacement budget, language switch, stopped display, portrait pointer targeting and saved Pen pixels. All four routine workflows passed. These remain synthetic desktop checks, not additional phone acceptance.

The original handoff priorities now have these bounded outcomes:

- **Mobile recording/export/save path:** capability-guided microphone MIME,
  native-only experimental AVC/AAC MP4 (30-second completed output), WebM default,
  separate playback/save/share, safe rerecording and explicit cancellation.
- **MP4 feasibility and synchronization:** actual native Windows AVC/AAC output
  with two insertions, VFR/nonzero first PTS and 44.1-to-48 kHz audio was decoded
  and measured; one owner device also reported short insertion MP4 save/replay/sync
  success. These are bounded evidence, not universal smartphone acceptance.
- **Failure protection:** decode/URL/encoder/storage faults and cancellation
  retain completed notes and the last valid output until a new candidate commits.
  Synthetic fault injection does not establish behavior under physical OS memory
  pressure, eviction, screen locking or device storage exhaustion.
- **Routine versus milestone testing:** short synthetic regressions run normally;
  native Windows/extended-duration checks remain explicit milestone work. No
  routine long test or additional codec fallback was introduced.

For a release decision, consolidate one identified iPhone/Safari and one identified
Android/Chrome session covering input, narration, short composed saved playback and
an interrupted/retried operation. Record actual device/OS/browser and supported
output format; an unsupported native AAC result is a limitation, not a failed WebM
feature. Run longer-duration checks only if claiming a higher accepted operating
range; do not infer that the trial caps are accepted ranges. Preserve the normal
v0.9.3 entry point while deciding whether to offer the insertion editor as a second
mode. Production promotion/merge and replacing the normal app are separate steps,
not completed by this Draft. Optional AAC WASM provenance remains unresolved and
is not required for the native-only path.

## Failed candidate cleanup remains owned (2026-10-17)

A targeted reassessment found that a rejected OPFS `removeEntry` in export cleanup
was ignored, followed by ordinary cancellation/retry text. A Node harness executed
that exact cleanup block with an injected rejection and observed no cleanup warning.
This establishes a missing cleanup-failure path, not loss of previous output or an
encoder leak. Previously tested delayed cleanup did not cover rejection.

The exporter now retains only its own failed-candidate cleanup handle, shows a
separate bilingual warning, and retries removal before allocating another output.
Repeated deletion failure prevents new export allocation while leaving existing
save/edit controls usable. `NotFoundError` means the candidate is already removed.
A cancellation requested during this retry waits for settlement; pending deletion
is still disclosed afterward. Failed writable-creation fallback also retains an
undeletable candidate instead of silently abandoning it. No user-selected files or
previous successful output are placed in this failed-candidate queue.

Local Node fault tests cover repeated rejection, deferred settlement, ownership
and NotFound, and the bundle builds successfully. The existing browser failed-export
case adds real temporary files plus injected deletion failure, no-new-allocation
checks, cancellation/retry, old download SHA and note preservation, and excluded
last-good deletion targets. Browser CI passed at `a8f8f8d`: [PoC run 39069488464](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39069488464), including the extended `failed_export` case and all ordinary composition/recording regressions. Normal-app smoke, standalone validation, and preview deployment also passed. The normal template remains byte-identical to the v0.9.3 handoff baseline `07d044a`. Local Chromium
could not start because its singleton socket was denied by this execution environment;
that is an unrun local browser test, not an application failure or a device pass.
Physical device storage exhaustion remains unverified.

## 180-second WebM milestone — PASS (2026-10-17)

At `fe2da99`, the single opted-in [run 39077865330](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39077865330) generated a 180-second 320×180/15fps VP8/Opus synthetic source and inserted 1.22 seconds of recorded synthetic narration. The saved OPFS-backed output is 181.22 seconds, 16,130,382 bytes, VP8 plus mono 48kHz Opus. The test took 81.29 seconds including fixture preparation and verification. Source audio before/after, narration-only insertion, and the original tail frame passed independent FFmpeg checks (tail mean RGB error 2.21144); no page errors or external media requests.

The [artifact 12117756567](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39077865330/artifacts/12117756567) was downloaded and independently decoded in full with FFmpeg, exit 0. Output SHA256: `1e60ffc53d6deb98a9a82885246524f891b092ad729c8d226d7078954891c8c5`. All four ordinary workflows at this revision passed. The temporary `[run-endurance-180]` title tag was removed after acceptance; its removal produced only a skipped endurance job, not a second run. This remains milestone-only and adds no routine endurance run.

This closes the handoff's specific 180-second desktop WebM check. It does not establish 180-second MP4, physical-phone performance, all trial ceilings, or arbitrary real-camera VFR/long-drift compatibility. Native MP4 remains experimental with a 30-second output cap. Normal v0.9.3 and app runtime were unchanged for this milestone.
