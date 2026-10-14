# Changelog

## [Unreleased]

### v0.4.0 — One-tap point marker & mobile transport (2026-10-15)

- Added a default **Point** tool: one tap places a persistent, outlined ring with center dot on the original video's frame. It pauses only source playback, never the microphone or output recorder.
- Reused normalized drawing coordinates, visible-stroke Undo/Clear and clear-on-source-play for markers, with no stale markers after a new source or take.
- Grouped four drawing tools before the video on smartphones with 44px+ targets; added fixed, phase-aware two-action transport with safe-area padding, additional bottom spacing and landscape/coarse touch handling. Importing a video now focuses the drawing/video workspace, and finishing recording focuses the result preview on compact layouts.
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
