# G9 — Release-candidate verification and release decision (v0.9.0)

> **Release decision: NO-GO / Draft** until required real iPhone Safari and Android Chrome full-flow tests pass. This is an *RC candidate review*, not permission to publish v1.0.0, merge a PR, claim device support or raise resource limits.

## Actual scope / fixed prototype limits

- Keep all v0.1–v0.8 behavior. Do not silently remove annotation tools, opt-in desktop Chromium audio mix, protected local microphone-only recording, partial recovery or conditional OS Share.
- Do not increase the **source 30s / 100MiB**, **recording 90s** or **96MiB recording-chunk** caps to proposed 60s / 250MiB / 180s without physical memory, performance and audio/video verification.
- Current automatic processing remains local, with strict `default-src 'none'`, `connect-src 'none'`, `worker-src 'none'`. Explicit user-initiated OS Share may deliver *generated* output to an external recipient; don't misstate it as on-device only.
- Do not promise MP4; the browser selects an actual MediaRecorder-supported MP4 or WebM container.
- Template release artifacts: `dist/index.html`, `dist/index.self-extract.html`, `pause-and-tell.html` (readable root copy) and canonical `assets/favicon.svg`. Exact content paths must be derived from the current build, not guessed.

## Full-flow regression matrix

| Case | Steps | Required evidence | Status |
| --- | --- | --- | --- |
| T-01 / AC-01 | 20s source, play 8s → pause 20s → finish remaining 12s | ~40s real output, no frame/audio drop during pause | Pending fresh v0.9 automatic and physical tests |
| T-02 | Narrate 10s at first frame before play | Output contains still first frame + voice at start | Pending |
| T-03 / AC-04 | Source ends, narrate 10s more | Last frame and voice preserved until stop | Prior v0.6 90s automated sample; verify RC |
| T-04 / AC-02 | Circle, arrow, pen on playing source | Source only pauses; coordinates recorded into output | Prior v0.3 automated; verify RC |
| T-05 / AC-03 | Undo/Clear/Play after marker | Prior captured marks remain; subsequent frames clear | Prior v0.3 automated; verify RC |
| T-06 / AC-05 | 16:9, 9:16, square, rotated metadata, variable CSS scale | Correct orientation, picture frame, positions | Rotation physical required |
| T-07 / AC-06 | Deny microphone permission then retry | No broken or silent success | Prior G6 simulated; physical required |
| T-08 | Unsupported codec/invalid/zero-second input | Explicit localized errors | Prior G6 simulated; verify RC |
| T-09 | Source audio present/absent, Voice only | No unintended source audio | Prior G5 simulated; verify RC |
| T-10 / AC-08 | Tab hidden, screen locked, call interrupted | State/recovery correct, no falsely complete file | Simulate browser event; physical OS tests pending |
| T-11 | Double click start/stop, replace input mid-session, 3 takes | No stale sources, active mic leaks, duplicate recorders | Prior G6 3 takes; verify RC |
| T-12 / AC-09 | Cancel save, retry with edited filename | Output kept, actual MIME/extension correct | Prior G7 simulated; real OS pending |
| T-13 | Smartphone native Save / Share | Saved file opens in file app / recipient | **BLOCKER: iOS + Android untested** |
| T-14 / AC-11 | HTTPS and direct file:// readable + self-extract | Real mic/save/CSP without hidden network | **BLOCKER: file:// untested** |
| T-15 / AC-12 | JA/EN, 320px, long name, landscape, help and error | No clipping/scroll trap/collisions | Prior G8 simulated; verify RC |
| T-16 | Progressively increase input/output size after device profiling | Determine 60s/250MiB/180s feasibility | **BLOCKER for increasing limits** |

## AC acceptance and release blockers

| AC | Automated/source evidence | Physical acceptance |
| --- | --- | --- |
| AC-01 source pause/narration | G1/G6 prior headless recordings | iOS/Android full 40s clip **PENDING** |
| AC-02 annotate while playing | G3 prior decoded frames | Touch/mic on iOS/Android **PENDING** |
| AC-03 clear on resume | G3 prior decoded frames | Native saved output **PENDING** |
| AC-04 keep last source frame | G6 prior 90s output | Native saved output **PENDING** |
| AC-05 portrait/orientation/canvas | G3/G4 prior viewport tests | Rotation metadata/physical device **PENDING** |
| AC-06 permission/invalid input | G6 synthetic failure tests | Real OS permission paths **PENDING** |
| AC-07 format/output integrity | Real VP8/Opus from headless Chromium | Native MP4/WebM player compatibility **PENDING** |
| AC-08 interruptions/resource cleanup | G6 synthetic and 3-take test | Lock/call/background hardware **PENDING** |
| AC-09 filename/save/retry | G7 browser download + mock Share | Real filesystem, OS Share **PENDING** |
| AC-10 browser/device matrix | — | **BLOCKER: iOS Safari/Android Chrome/Windows Chrome+Edge** |
| AC-11 offline one-file | G8 build/CSP/standalone checks | Real file:// microphone/save **PENDING** |
| AC-12 bilingual/mobile/help | G8 browser JA/EN and viewport | Actual screen readers/physical mobile **PENDING** |

## Method for temporal sync claim

For a controlled headless test, inject an audible test pulse and place a visual ring via the same user-like click. Decode exported audio to PCM and video to frames, estimate the earliest non-background audible pulse and first colored ring frame timestamps, report signed offset and uncertainty. The project's **±250ms target** is not automatically guaranteed by an app API. Measure on the **actual exported file** rather than using JS timestamps or `MediaRecorder` chunk counts, and repeat on physical iOS/Android before claiming it meets G9.

For fixed time stamps in WebM with indefinite container duration, use `ffprobe` packet PTS and decoded frames. Save exact file MIME/codecs, source/container size, resolution, output size, browser version, viewport, OS, microphone type, source play/pause timestamps, network trace and any exceptions.

## Physical-device execution (required; not automatable from this environment)

**Run the following on every required target** (Windows Chrome/Edge, Android Chrome physical, iPhone Safari physical): open HTTPS Preview and direct standalone `file://` (where OS permits). Grant real microphone, load 16:9 and portrait short clips, record a pause of at least 10–20s while speaking, annotate during source playback, finish recording, save, locate in Files/Downloads, reopen in a native file viewer and listen to the full output. Repeat denial, background interruption, rotate viewport, Help, Share Cancel/unsupported and 90s cap as appropriate. Record actual OS and browser version, input codec, export MIME, native player result and screen/video evidence. Do not substitute user-agent emulation or fake microphone for this evidence.

## Status and decision

G9 **NO-GO** until iOS and Android pass AC-10 and the full-flow tests, the synchronization target is measured in actual saved output, and hard errors are resolved. All G1–G8 real-device gates remain open even if automated headless tests pass. Keep existing Draft PR #1 unmerged, and do not modify Browser Kitty main.
