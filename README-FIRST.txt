Pause & Tell / 動画解説レコーダー
================================

This repository started from the current htmlapps-template and now contains
Pause & Tell v0.8.0, a standalone recording prototype with keyboard Point, local media capture, export and partial recovery.

1. Read APP_SPEC.md and DEVELOPMENT_PLAN.md first.
2. Read AGENTS.md, docs/ARCHITECTURE.md and docs/G1_VALIDATION.md through docs/G8_VALIDATION.md.
3. Edit src/index.template.html (not generated dist HTML).
4. Build on Windows with build-standalone.bat; it runs the PowerShell preflight.
5. Check both dist/index.html and dist/index.self-extract.html offline.
6. Complete G1 playback validation (still required) G2–G8 UI, audio, recovery, export, privacy and accessibility validation on desktop and real Android/iPhone devices
   before calling v0.8.0 verified. Do not claim mobile support from CI alone.
7. This is not yet the 1.0.0 app: audio source mixing is experimental; microphone-only recording remains the default, pending device acceptance.

No runtime CDN, analytics, telemetry or automatic uploads. Local source/microphone data stay on-device unless the user explicitly chooses to share a generated output file through the OS.
Pull requests can be created, but only the maintainer merges them.
