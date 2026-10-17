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

### Corrected VFR case: PASS at d51aab7

https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39005916146

The same fixture passes after the first-PTS correction: four-second input with
frame intervals 33/34/66/83/84ms and 44.1kHz stereo audio becomes a 6.74-second
VP8/Opus file with two narration inserts. Independent decode checks original
head/tail frames, left 440Hz/right 660Hz separation before/after, narration on
both channels and no original soundtrack during explanation. OPFS output was
used; browser errors and external HTTP requests were zero. Artifact 12091127151
contains the synthetic source, saved output, screenshot and report. This verifies
one irregular-timestamp fixture, not arbitrary VFR cameras or long-term drift.
Native codec results were unchanged: Chromium unsupported AVC/AAC; Chrome
video-only AVC MP4 because AAC was unavailable.

The Windows PR-preview build also exposed URL pathname handling (`D:/D:/...`);
`fileURLToPath(import.meta.url)` now resolves build entries on Windows and Linux.
The generated Linux app bytes did not change from this portability correction.

## Optional AAC extension: CI-only CSP investigation

Read-only inspection of official `@mediabunny/aac-encoder@1.61.5` found:

- The package declares MPL-2.0 and provides its bridge/TypeScript source. Its
  AAC encoder uses bundled FFmpeg WASM in a blob Worker, SIMD and growable memory.
  npm package size is 1,287,885 bytes compressed / 4,701,888 unpacked; the shipped
  minified module is 992,505 bytes. These are package sizes, not measured runtime
  memory or the app's incremental bundle size.
- The package README provides FFmpeg build flags but does not pin the source
  revision. A binary string identifies libavcodec 62.23.103; this does not establish
  exact source correspondence or distribution compliance. The tarball includes
  no separate FFmpeg source archive/license notice. Do not redistribute this
  optional generated bundle until matching source/license requirements are resolved.
- Current app CSP disallows Workers and WASM compilation. The new CI-only check
  copies that CSP unchanged and expects the AAC Worker to fail visibly, even if
  canEncodeAudio advertises support. Its generated HTML is not uploaded as an
  artifact or placed in the public preview. Only diagnostics are preserved.
- A future actual-encoding sandbox would need explicit blob Worker and
  `wasm-unsafe-eval` allowances, with `connect-src 'none'` retained, plus timeout,
  worker cleanup and resource measurements. No such CSP change is made here.
  Current product/preview CSP and all app encoder dependencies are unchanged.

References:
https://mediabunny.dev/guide/extensions/aac-encoder
https://registry.npmjs.org/@mediabunny/aac-encoder/-/aac-encoder-1.61.5.tgz
https://ffmpeg.org/legal.html

Independent review found no blocker in timestamp/preview changes. Follow-up
assertions now reject both stereo source tones in both narration intervals, and
measure the decoded MP4 color-transition frame instead of inferring it from two
sparse color samples. These strengthened assertions passed in the final measured run below.

### Strengthened measurements and AAC negative test: PASS at 277bb62

https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39006381204

- The VFR/stereo case again produced a decoded 6.74-second WebM. Both source
  tones are absent from both channels during both narration intervals.
- Chrome's video-only MP4 changes color at decoded frame 15 / 1.000 seconds.
  AAC remains unavailable natively; no audio/video alignment pass is claimed.
- Optional AAC registration advertises support, but actual encoding fails with
  a Worker error and a console CSP violation of `worker-src 'none'`. This expected
  negative result passed, with zero external requests. The CI-only bundled HTML
  was 1,151,071 bytes; it was excluded from artifacts and public preview.
- Evidence artifact: 12091181736. All four routine workflows also passed at
  277bb62. App dependencies, public CSP and WebM output remain unchanged.

Remaining next gate: resolve the exact FFmpeg source/license correspondence and
agree the permissions for a separate actual-encoding sandbox before relaxing any
CSP. Physical phone microphone/export/save tests remain open.

### Exact optional WASM provenance checked (2026-10-17)

The embedded WASM from the official 1.61.5 tarball was decoded as data, without
executing it: 509,386 bytes, SHA-256
`8488acb0bc9f43055b83600cc4c2c07d20f07675aa65671f91ac1d75515845d9`.
This exactly matches the binary discussed in upstream issue 544 for 1.56.0/1.56.3.
The maintainer states that the FFmpeg checkout was unmodified and Emscripten
4.0.21 was used. The request for the exact historical FFmpeg commit/configuration
was closed without that revision being identified. The library version string
alone is not an exact source mapping. This is incomplete build provenance, not
a finding of license noncompliance. Product redistribution remains deferred.

- Maintainer statement: https://github.com/Vanilagy/mediabunny/issues/544#issuecomment-5936012964
- Exact-source follow-up: https://github.com/Vanilagy/mediabunny/issues/544#issuecomment-5985412361
- The tagged repository's latest committed AAC WASM build change is
  https://github.com/Vanilagy/mediabunny/commit/0f6c374750d0f2d95f4a435c96ba8da75312a93f

A reproducible replacement built from an explicitly pinned FFmpeg source,
recorded flags/toolchain and matching notices is a possible later route. It is
not part of the current dependency set or a completed verification.

## Approved CI-only actual-encoding sandbox (pending measurement)

A separate generated localhost page now allows only blob Workers and
`wasm-unsafe-eval` beyond the existing policy, with `connect-src 'none'` retained.
This explicitly bounded test uses only two seconds of synthetic red/green video
and stereo tones, no microphone/user media/secrets. The browser is closed after
the attempt; an encoding wait is bounded at 30 seconds. Only diagnostics and the
synthetic MP4 may be uploaded as evidence; the generated HTML/WASM is excluded.
The actual app and public preview retain their original CSP and dependencies.
Source/license provenance remains a separate unresolved product-distribution gate.

The isolated generated sandbox is 1,222,787 bytes. This is a file-size measurement,
not runtime memory evidence. A result must independently decode H.264/AAC,
measure the video transition and audio onset, and contain no external requests
before the synthetic test is considered successful. Product MP4 support remains
unimplemented regardless of this laboratory result.

### First sandbox result: synthetic AVC/AAC MP4 PASS at 2c4559c

https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39006907030

Official optional AAC plus native AVC produced a 16,342-byte two-second MP4 on
Linux Google Chrome 155 in the approved CI-only sandbox. FFprobe/FFmpeg decoded
H.264 video and two-channel AAC. The decoded video transition was 1.000s and the
left-channel audio onset 1.01917s (about 19ms later). Measured encoding took
259ms in that runner; this is not a phone/performance guarantee. Browser errors
and external requests were zero. Artifact 12091715103 contains the synthetic
MP4 and diagnostics, not the AAC HTML/WASM bundle.

Independent scope review found no blocker. The final assertion follow-up adds
right-channel tone/onset checks and guarantees browser.close in finally even on
navigation/evaluation exceptions. Its rerun will be recorded in the PR.

This is a small synthetic encoding result only. The insertion app still outputs
WebM; MP4 composition, OPFS MP4 behavior, phone memory/performance and actual OS
save/share are unverified. The exact FFmpeg source correspondence/distribution
gate also remains unresolved.

### Final stereo sandbox result and next bounded route

At 97251d3, the strengthened test passes for both channels: left 440Hz/right 660Hz,
no cross-channel tone leakage beyond the diagnostic threshold, both onsets
1.01917s against video transition 1.000s. Generated MP4: 16,342 bytes; runner encoding
292.8ms; no browser errors/external requests. Browser closure is now in finally.
https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39007079797/artifacts/12091199100

The public PoC now offers an optional native support-query disclosure. It calls
only VideoEncoder/AudioEncoder.isConfigSupported for the displayed configuration,
without constructors, microphone, input media, Workers or WASM. It is advisory,
separate from WebM recording/export controls, and never enables MP4 export.

Next-route comparison (no additional implementation or upstream message yet):

1. **Preferred first:** measure native AVC/AAC candidates on the intended phone,
   then separately validate actual native encoding on that device. This avoids
   adding the optional FFmpeg binary but may leave some platforms unsupported.
2. If cross-platform fallback is essential, plan a reproducible AAC build from
   pinned FFmpeg/toolchain sources with recorded flags, hashes and matching
   source/notices/reconstruction materials. This is a new build/distribution
   milestone, not a solved license review or an instruction to ship now.
3. Ask upstream for the historical source revision/build receipt. Existing issue
   544 did not resolve it, so timing/outcome are uncertain. No outreach is sent.

FFmpeg's own checklist stresses exact binary/source correspondence and build
instructions: https://ffmpeg.org/legal.html . Emscripten provides version-selectable
SDK installation: https://emscripten.org/docs/getting_started/downloads.html .
Alternative encoder replacement is deferred rather than expanding this probe.

## Native-only device sample follow-up (2026-10-17)

Owner reported `Native AVC: 候補あり / Native AAC: 候補あり`. Device model, OS and browser were not specified. This is a support-query result only, not encoding, sync, playback or save validation.

A dedicated non-production PR-preview page `/insertion-poc/native-mp4/` now offers an explicit synthetic 2-second generation button, separate playback and download. AVC and AAC must both be available; it never presents silent-only MP4 as a successful result. It uses only core Mediabunny/native codecs, copies the existing PoC CSP unchanged, and does not access user media, microphone or network. No optional AAC extension, Worker or WASM is included. The previous successful result remains available after a failed or timed-out retry. A 30-second response deadline requests cancellation and permanently disables retries on that page; late completion cannot replace the saved result. Mediabunny cancel is a no-op during finalization, so this is not a guaranteed encoder termination deadline. Save any previous result before reloading to retry. This prevents accumulating timed-out attempts in one page.

Verification is split: Node tests cover transactional result retention, empty output, double-click/busy, timeout and late completion. The short CI browser test checks actual native unsupported handling and uses an explicitly synthetic test dependency for UI-only success/save/failure retention. That fixture is not evidence of real native AAC encoding; its generated test HTML is excluded from the preview allowlist. At this diagnostic milestone, real smartphone encoding/playback/save were pending; subsequent owner reports are recorded below. No long-duration sync, insertion MP4, VFR MP4 or OS-save guarantee follows from a 2-second success.

## Native insertion MP4 experimental integration

Owner subsequently reported all three synthetic native steps succeeded: generation, in-page playback/color-tone transition, and saving then replaying the downloaded file. Device/OS/browser remain unspecified. This is owner-reported 2-second success, not independently measured synchronization or general phone compatibility.

The insertion PoC now defaults to unchanged WebM, with an explicit experimental native MP4 choice limited to **30 seconds of completed output**. Native AVC/AAC capability is checked for the actual canvas dimensions before recording/export. MP4 audio rendering uses stereo 48kHz blocks; source 44.1kHz audio passes through the existing OfflineAudioContext resampling. Frame sampling, first-PTS hold and timeline block boundaries remain shared with WebM. No optional codec, WASM or CSP change is introduced.

Result MIME, filename/extension, sharing and OPFS suffix follow the successful output, never the current selector. Selecting unavailable MP4 or failing a retry leaves prior WebM bytes and metadata intact. Previous results are replaced only after the existing detached-video decode check. Short routine CI retains four real WebM media cases and seven resilience cases; the existing failed-export case now also checks unavailable MP4 selection and previous-output saving/sharing. `test-smoke.py --output-format mp4` is prepared for a real native AAC-capable browser; it does not inject AAC or count unsupported as success. Independent native MP4 insertion measurements, identified MP4 OPFS/RAM paths and 44.1kHz/VFR MP4 remain pending. The later owner acceptance below covers a short manual insertion/save/replay case only.


## Owner acceptance: short native MP4 insertion (2026-10-17)

After an explicit clarification distinguishing the earlier 2-second diagnostic from insertion export, the owner confirmed that a short source video with inserted narration exported as MP4, saved, and replayed successfully, with no perceived audio-sync issue. Record this as **owner-reported short insertion MP4 acceptance**, not an automated or independently measured media result.

Unknown: device model, OS/browser versions, exact media dimensions/duration/codecs, OPFS versus RAM, and numerical audio/video offset. This does not establish general iPhone/Android support, arbitrary VFR, 44.1kHz MP4 resampling, long-duration drift, full-capacity limits, interruption behavior on that device or sharing completion. The experimental MP4 completed-output cap stays 30 seconds; WebM remains default. Draft PR is not merged.

Recommended next bounded milestone (not yet executed): retain the 30-second cap and check **one source with original audio plus two narration inserts**, including original sound before/between/after both inserts and saved-file replay. Capture device/OS/browser and actual output metadata if available, without requiring private source-media upload. If that passes, separately schedule a known irregular-PTS/44.1kHz stereo fixture under the same cap using the existing optional media test; avoid treating this first manual acceptance as VFR proof. No new encoder, CSP permission or long-duration expansion is proposed now.
