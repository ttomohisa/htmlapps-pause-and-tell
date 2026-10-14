# Changelog

## [Unreleased]

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
