Pause & Tell / 動画解説レコーダー
================================

This repository started from the current htmlapps-template and now contains
Pause & Tell v0.3.0, an annotated recording workflow prototype.

1. Read APP_SPEC.md and DEVELOPMENT_PLAN.md first.
2. Read AGENTS.md, docs/ARCHITECTURE.md and docs/G1_VALIDATION.md.
3. Edit src/index.template.html (not generated dist HTML).
4. Build on Windows with build-standalone.bat; it runs the PowerShell preflight.
5. Check both dist/index.html and dist/index.self-extract.html offline.
6. Complete G1 playback validation (still required) and G2 workflow validation on desktop and real Android/iPhone devices
   before calling v0.3.0 verified. Do not claim mobile support from CI alone.
7. This is not yet the 1.0.0 app: drawings are planned for later releases.

No runtime CDN, analytics, or uploads. Source media and mic audio stay local.
Pull requests can be created, but only the maintainer merges them.
