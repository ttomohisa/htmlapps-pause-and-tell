# Changelog

## [Unreleased]

### v0.11.2 — optional 30-second endurance test and safe source replacement (PoC only)

- Added manual-only 30/60/180-second longer-video validation. A real 30-second VP8/Opus source successfully exported as a 31.22-second video after inserting roughly 1.22 seconds of separately captured narration. ffprobe/ffmpeg confirmed audio interval switching and video tail preservation; [run and media artifact](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38936670686). The manual workflow never runs on ordinary PR updates.
- Confirm before replacing a source that has saved explanation clips; cancelled or invalid replacements keep the clips. Restore original preview if a new media preview fails to load.
- Let users hear source audio while manually previewing it; pause the source before recording an inserted narration clip.
- The existing v0.9.3 default application is unchanged; physical smartphone and full 5-minute export acceptance remain open.

### v0.11.1 — bounded audio, local temporary-file output and practical test limits (PoC only)

- Expand prototype attempts from 15 seconds / 30MiB input and 32 seconds completed output to 5-minute/250MiB source, 2-minute independent explanation and 10-minute finished video, while retaining a conservative memory fallback budget and explicit unsupported-device errors. These upper limits are experimental, not tested performance claims.
- Render audio in 2-second chunks, and use Mediabunny StreamTarget writing to browser-local OPFS when supported; memory BufferTarget remains a bounded fallback. Clean up app-owned temporary output on normal discard and attempt stale temporary output pruning.
- Test 20-second source acceptance, OPFS versus memory output, original soundtrack transitions, encoded video/audio and multi-insert deletion/re-record. Relax exact output-duration expectations to an actual-segment-based tolerance. Retain privacy and valid-file assertions.
- Split indispensable short PR smoke from longer real-device/performance release tests: see docs/INSERTION_TEST_POLICY.md.

### v0.11.0 — timestamped multiple explanation clips (isolated PoC)

- Extend the separate Mediabunny/WebCodecs experiment to accept multiple independently recorded narration-and-Pen clips, ordered by source timestamp, with clip selection, deletion and rerecording.
- Add a pure deterministic timeline planner and Node unit tests, plus Chromium output validation for two inserts and a delete/rerecord cycle with original soundtrack retained before, between and after explanations.
- [Saved WebM media regression PASS](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38864515775): 4s original + 2 narration clips = 6.74s; video VP8, audio Opus. Main v0.9.3 app remains unchanged.

### v0.10.1 — preserve original soundtrack around explanations (PoC only)

- Permit silent or sound-bearing short source clips; decode and reschedule original audio before and after the inserted narration segment. Original sound is absent during the explanation, and narration does not extend into source intervals.
- Confirmed both source types in Chromium with generated saved WebMs and independent 440/800 Hz signal measurements; main application remains unchanged. [CI evidence](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38863341916).

### v0.10.0 — isolated explanation-insertion PoC (not released)

- Record explanation audio and timestamped Pen strokes independently at one source timestamp, without recording the original video throughout the narration.
- At export, decode and re-encode original source frames offline, insert the explanation, and mux one WebM/VP8/Opus output. The default v0.9.3 recording application is unchanged.
- Synthetic Chromium CI produced a 5.94-second file from four seconds of silent source plus ~1.94 seconds of narration, with measured video frames before/after insertion and audible voice.
- Original soundtrack handling was added in the v0.10.1 PoC extension (synthetic Chromium/ffprobe PASS). Multiple inserted clips, long/mobile media and production compatibility remain unimplemented/untested.

### v0.9.3 — In-recording source seek, default Pen and confirmation (2026-10-16)

- Allow seeking the source video while recording. Seeking pauses only source playback, resets drawing history and keeps output/microphone recording running. Warn in both languages that skipped original footage is not in the output.
- Switch initial drawing tool from Point to **Pen**; retain all four tools, Undo/Redo and keyboard point placement.
- Confirm manual Finish using the existing localized accessible dialog. Pause source behind the dialog, keep recording while waiting, and resume prior playback on Cancel. Automatic duration/capacity/error stops bypass confirmation.
- Update browser smoke checks and specifications. Separately document a future explanation-insertion architecture; **it is not implemented**.

### v0.9.2 — Recording extension and restored hero (2026-10-16)

- Raised experimental input caps from 30s / 100MiB to **5min / 250MiB** and output duration from 90s to **10min**. Increased the in-memory chunk guard from 96MiB to **256MiB** while retaining the 2.4Mbps video target; recording can still end early under memory pressure.
- Restored the hero description and three-step progress in loaded, recording and result states on desktop and mobile, without moving recording controls away from the video.
- Aligned Japanese/English help, error strings, README, APP_SPEC, development plan and optional browser regression with the new limits.
- **No release approval:** longer session stability and actual iPhone/Android save/playback still require physical verification.

### v0.9.1 — Video-first recording, Undo/Redo and UI cleanup (2026-10-16)

- Compact recording workspace: drawing tools above the video, source play/record/finish actions immediately below the video, followed by clocks and optional audio controls. Removed the mobile bottom-fixed recording bar and unnecessary progress panels during editing.
- Record now starts source playback **after** microphone/recorder startup by default, while offering an explicit first-frame paused start. If muted autoplay is blocked, the recording remains active and the UI explains to press Play.
- Added drawing Undo/Redo using Ctrl/Cmd+Z, Ctrl+Y and Ctrl/Cmd+Shift+Z, plus an accessible Redo button. The current Clear can be undone; resuming source playback intentionally clears drawing history, without rewriting recorded frames.
- Consolidated user-facing help and README, removed development-only messages from the ordinary workflow and kept local diagnostics/build internals accessible only through an explicit `?debug=1` query.
- Explained that source 30s / 100MiB and recording 90s are provisional memory-safety limits rather than browser-defined maximums. Physical iPhone/Android and direct `file://` compatibility remain G9 release blockers.



### v0.9.0 — Release-candidate verification (2026-10-15)

- Prepared a G9 full-flow acceptance plan (T-01–T-16 and AC-01–AC-12) with explicit **NO-GO** until actual iPhone Safari and Android Chrome recorded files can be saved and replayed natively.
- Preserved v0.1–v0.8 recorder, annotated Canvas, recovery, local privacy constraints, JA/EN, template standalone formats, and optional experimental desktop-only source-audio mixing.
- Kept cautious prototype limits (30s source, 100 MiB source input, 90s output, 96 MiB accumulated chunks) pending measured physical-device support for the proposed 60s/250MiB/180s.
- Added G9 test plan for landscape/portrait/square/rotated clips, 0/1/3/10 pauses, encoded-frame/audio onset synchronization, failure paths, device compatibility, and screenshots.
- Fresh automated v0.9 G9 evidence: 8s play + 20s pause + finish saved a VP8/Opus WebM through 40.159/40.176s; 7 pause/orientation cases passed including actual 90° MP4 display-matrix metadata; first/last frame narration and Circle/Arrow/Pen regressions rechecked.
- Repeated visual marker / synthetic audio onset measurements were −23ms/−11ms/−27ms. A development-only `tests/g9-browser-regression.py` was committed so the seven-case Chromium test can be rerun without adding browser packages to release HTML or everyday CI.
- Japanese/English screenshots were captured from actual v0.9 UI and packaged for review; binary screenshot assets are still not committed to `assets/` / README.
- A CI/Chromium auto-pass alone is insufficient for G9/v1.0.0 release approval.



### v0.8.0 — Single-HTML privacy and accessibility review (2026-10-15)

- Added keyboard Point placement (arrow keys 5%, Shift+arrows 1%, Enter/Space commits), with a DOM-only cursor omitted from the captured video.
- Added skip-to-app link, localized phase announcements, accessible seek position, focus changes after source import and recording result, and explanatory Help text for pointer-only drawing.
- Strengthened CSP to `default-src 'none'`, `connect-src 'none'`, `worker-src 'none'`, with only local Blob/data resources and inline HTML-embedded code allowed. Retained self-contained template build and canonical SVG favicon.
- Updated G8 verification plan, source contract, bilingual README, security/privacy boundary and CI marker checks.
- Headless Chromium v0.8 keyboard Point, recorded WebM VP8+Opus, 5 viewport sizes, bilingual Help, gzip HTML loader, canonical SVG and strict CSP fetch blocking passed; 163 JA/EN translation keys match.
- Physical iPhone/Android recording and file:// runtime, real screen-reader testing (NVDA/VoiceOver), and overall G1–G8 acceptance remain **PENDING**.



### v0.7.0 — Download, share and help polish (2026-10-15)

- Kept output preview and editable filename while adding user-visible save instructions that distinguish a **download request** from confirmed storage.
- Hardened export filenames (path separators, control/bidi characters, trailing dots/spaces, extensions, reserved names and empty fallback).
- Added native **Share video** only when the browser supports sharing the playable MP4/WebM `File` via `navigator.canShare({files})` in a secure context. Suppresses Share for interrupted/unverified recovery outputs.
- Native share calls happen directly from a user click with transient activation; cancellation retains the result and other failures preserve Download fallback.
- Downloading/sharing no longer exempts the user from a discard confirmation on source replacement or re-recording. The browser cannot prove an actual save.
- Updated JA/EN Help to explain that explicit user-selected sharing may transmit generated files to other destinations, unlike completely local automatic processing.
- Added G7 file export and OS/browser acceptance matrix. Chromium automated checks covered safe download names, supported/unsupported Share states, cancellation/failure, recovery restrictions, compact mobile widths and self-extract HTML; physical iOS/Android export and direct `file://` tests remain outstanding.



### v0.6.0 — Recording interruptions and partial recovery (2026-10-15)

- Introduced `recovery` result state with localized interrupted/partial/unverified output notices. Unverifiable data is not displayed as a successfully created or playable video; users can optionally save recovered bytes with an explicit corruption warning.
- Added bounded (9s) MediaRecorder stop-event watchdog, one-time finalization guard and best-effort chunk salvage after browser recorder errors or missing stop callbacks.
- Monitored microphone `ended` / sustained `mute` (3.2s grace), output video/audio track endings, source decode errors and page visibility interruptions.
- Added 96MiB in-memory recording chunk limit while retaining input 30s/100MiB and output 90s prototype constraints. Never silently expand limits before real-device measurements.
- Hardened startup abort handling, stream/audio graph cleanup, media source replacement guards, and safe filename/format messaging for unverified raw recovered bytes.
- Added G6 verification plan. Browser build checks are not a substitute for physical iPhone/Android recording, native file playback or actual microphone tests.
- Fixed controlled duration-limit output classification and unexpected early MediaRecorder `onstop` handling; de-duplicated recovery warnings and showed decimal seconds for very short recordings.
- Headless Chromium simulated G6 recovery states, a 27s capture and a **full real-time 90s limit recording** (saved WebM packet endings: video 90.040s / audio 90.082s), repeated audio-mix takes, Blob URL cleanup and mobile recovery UX. Physical-device acceptance is still pending.



### v0.5.0 — Opt-in original-audio mix prototype (2026-10-15)

- Kept direct microphone-only recording as the default, with no source speaker playback or new runtime network dependencies.
- Added an advanced, explicitly experimental desktop Chromium-only source+microphone mode (unavailable on mobile/Safari/Firefox before actual-device verification).
- Routed the original video through MediaElementAudioSourceNode and a selectable 15%/30%/50% GainNode, and microphone through a separate 100% GainNode into a recording-only MediaStreamAudioDestinationNode; neither connects to speakers.
- Preserved source pause / microphone continuity / Canvas drawing through the same MediaRecorder.
- Reused the Web Audio element binding across repeat captures; disconnected per-take nodes, stopped mic/capture tracks and suspended unused AudioContext.
- Added localized errors and final mode/gain metadata plus `docs/G5_VALIDATION.md`.
- G1–G5 real-device acceptance is **still pending**; experimental mixed mode may be excluded from v1.0.0 if unsupported.



### v0.4.0 — One-tap point marker & mobile transport (2026-10-15)

- Added a default **Point** tool: one tap places a persistent, outlined ring with center dot on the original video's frame. It pauses only source playback, never the microphone or output recorder.
- Reused normalized drawing coordinates, visible-stroke Undo/Clear and clear-on-source-play for markers, with no stale markers after a new source or take.
- Grouped four drawing tools before the video on smartphones with 44px+ targets; added fixed, phase-aware two-action transport with safe-area padding, additional bottom spacing and landscape/coarse touch handling. Importing a video now focuses the drawing/video workspace (prioritizing the full video in portrait or short landscape), and finishing recording focuses the result preview on compact layouts. Fixed an overlap with the bottom transport on 320px portrait and 844px short landscape screens.
- Displayed recording source status beside the video as DOM-only UI that is not included in exported pixels.
- Added G4 acceptance matrix and explicit physical iPhone Safari/Android Chrome **unverified** status; retained template build/CSP/local-only behavior.


### v0.3.0 — Annotated recording preview (2026-10-15)

- Added circle/ellipse, arrow and freehand pen tools with pointer/touch input and three outlined paint colors.
- Drawing automatically pauses source playback without pausing MediaRecorder or microphone capture.
- Normalized video coordinates map CSS pointer positions to captured Canvas pixels, including portrait source videos and scaled stages.
- Drawing and voice are recorded together in the same Canvas+microphone MediaStream; toolbar/buttons are never in the captured canvas.
- Added visible-stroke Undo/Clear, default clear-on-source-play, per-source/reset cleanup, and explicit notice that past recorded content is irreversible.
- Bilingual UI and Help updated, plus a dedicated G3 validation matrix. Source audio and tap rings remain deferred.
- G1/G2 physical-device gates and G3 physical-device validation remain unverified; do not present as an approved release.



### v0.2.0 — Workflow preview (2026-10-14)

- Added three clear workflow stages, an explicit video-loading state and current file summary in the studio.
- Added a microphone-permission explanation and differentiated interrupted/time-limited output warnings.
- Set the language switch to **JA / EN**, changed the badge to **完全ローカル処理 / Fully local processing**, and hid the footer on smartphones.
- Locked background page scrolling while Help is open while preserving scroll inside the dialog and restoring the page position on close.
- Replaced `assets/favicon.svg` with the provided SVG, reused by the template as both favicon and header icon.
- Updated the G2 validation plan. v0.1 G1 physical-device tests remain outstanding; this is not a release approval.


### v0.1.0 — recording engine technical prototype (2026-10-14)

- Replaced the template text demo with Pause & Tell's file/video/microphone recording experiment.
- Added independent source-video play/pause and continuous Canvas + microphone capture via MediaRecorder.
- Added paused-source frame rendering, a 90-second output guard, browser-selected MP4/WebM MIME types, output preview and editable download filenames.
- Added basic interruption handling, microphone-permission errors, per-session state cleanup, two clocks, and local diagnostics.
- Replaced starter metadata and favicon, and added the full APP_SPEC / DEVELOPMENT_PLAN and Japanese/English README files.
- Preserved the upstream template build, CSP `connect-src 'none'`, bilingual shell, canonical icon, confirmation dialog, toast, and self-contained HTML outputs.

**Verification status:** Template CI, local playback and real smartphone G1 results are not implied by this changelog; see `docs/G1_VALIDATION.md`. Drawing and source audio are not implemented in v0.1.0.

### Framework provenance

Repository created from `ttomohisa/htmlapps-template` (template framework version 1.3.0); upstream template changes prior to this app are documented in the template repository.
