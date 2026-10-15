Pause & Tell / 動画解説レコーダー
================================

This repository started from the current htmlapps-template and now contains
Pause & Tell v0.6.0, a narrated video recording prototype with partial recovery and an experimental desktop-only audio mixer.

1. Read APP_SPEC.md and DEVELOPMENT_PLAN.md first.
2. Read AGENTS.md, docs/ARCHITECTURE.md and docs/G1_VALIDATION.md through docs/G6_VALIDATION.md.
3. Edit src/index.template.html (not generated dist HTML).
4. Build on Windows with build-standalone.bat; it runs the PowerShell preflight.
5. Check both dist/index.html and dist/index.self-extract.html offline.
6. Complete G1 playback validation (still required) G2/G3/G4/G5/G6 UI, audio, recovery and resource-lifecycle validation on desktop and real Android/iPhone devices
   before calling v0.6.0 verified. Do not claim mobile support from CI alone.
7. This is not yet the 1.0.0 app: audio source mixing is experimental; microphone-only recording remains the default, pending device acceptance.

No runtime CDN, analytics, or uploads. Source media and mic audio stay local.
Pull requests can be created, but only the maintainer merges them.
