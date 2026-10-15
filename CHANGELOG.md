# Changelog

## [Unreleased]

### v0.8.0 — Single-HTML privacy and accessibility review (2026-10-15)

- Added keyboard Point placement (arrow keys 5%, Shift+arrows 1%, Enter/Space commits), with a DOM-only cursor omitted from the captured video.
- Added skip-to-app link, localized phase announcements, accessible seek position, focus changes after source import and recording result, and explanatory Help text for pointer-only drawing.
- Strengthened CSP to `default-src 'none'`, `connect-src 'none'`, `worker-src 'none'`, with only local Blob/data resources and inline HTML-embedded code allowed. Retained self-contained template build and canonical SVG favicon.
- Updated G8 verification plan, source contract, bilingual README, security/privacy boundary and CI marker checks.
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
