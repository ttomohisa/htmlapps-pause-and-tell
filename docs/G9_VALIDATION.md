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
| T-01 / AC-01 | 20s source, play 8s → pause 20s → finish remaining 12s | ~40s real output, no frame/audio drop during pause | **v0.9 Chromium automated PASS** (40.159s video / 40.176s audio); physical PENDING |
| T-02 | Narrate 10s at first frame before play | Output contains still first frame + voice at start | **Partial automated PASS**: initial 2s silent-source pause with voice; exact 10s physical PENDING |
| T-03 / AC-04 | Source ends, narrate 10s more | Last frame and voice preserved until stop | **Partial automated PASS**: v0.9 extra ~2s after end; prior v0.6 90s; 10s/device test PENDING |
| T-04 / AC-02 | Circle, arrow, pen on playing source | Source only pauses; coordinates recorded into output | **v0.9 Chromium automated PASS** on UI gestures, saved frames; physical PENDING |
| T-05 / AC-03 | Undo/Clear/Play after marker | Prior captured marks remain; subsequent frames clear | **Partial v0.9 PASS** on playback clearing; prior G3 undo/clear; physical PENDING |
| T-06 / AC-05 | 16:9, 9:16, square, rotated metadata, variable CSS scale | Correct orientation, picture frame, positions | **v0.9 Chromium PASS**: 480×270 / 270×480 / 360×360 / 90° rotation → 270×480; physical PENDING |
| T-07 / AC-06 | Deny microphone permission then retry | No broken or silent success | Prior G6 simulated; physical required |
| T-08 | Unsupported codec/invalid/zero-second input | Explicit localized errors | Prior G6 simulated; verify RC |
| T-09 | Source audio present/absent, Voice only | No unintended source audio | Prior G5 simulated; verify RC |
| T-10 / AC-08 | Tab hidden, screen locked, call interrupted | State/recovery correct, no falsely complete file | Simulate browser event; physical OS tests pending |
| T-11 | Double click start/stop, replace input mid-session, 3 takes | No stale sources, active mic leaks, duplicate recorders | Prior G6 3 takes; verify RC |
| T-12 / AC-09 | Cancel save, retry with edited filename | Output kept, actual MIME/extension correct | Prior G7 simulated; real OS pending |
| T-13 | Smartphone native Save / Share | Saved file opens in file app / recipient | **BLOCKER: iOS + Android untested** |
| T-14 / AC-11 | HTTPS and direct file:// readable + self-extract | Real mic/save/CSP without hidden network | **BLOCKER: file:// untested** |
| T-15 / AC-12 | JA/EN, 320px, long name, landscape, help and error | No clipping/scroll trap/collisions | Prior G8 Chromium PASS; v0.9 JA/EN screenshots acquired (not yet in repo); physical PENDING |
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

## Fresh automated G9 evidence — 2026-10-16

**Exact production artifact used:** GitHub Actions-built single HTML from `e170086a3c0f95ee9b44622c116473b02f79894c` (v0.9.0). Playback/recording tests used headless **Linux Chromium 144**, with an **880 Hz simulated WebAudio microphone**. The HTML was loaded into an `about:blank` Playwright context; **this is not a direct `file://` or HTTPS test**. All measurements below are from locally exported WebM files, not just UI state.

### T-01 / AC-01: 8s play → 20s frozen → remaining source → save

- Input: **20.000s** H.264 test video, source 480×270.
- After first play, the source paused at **8.043858s** and remained at **exactly 8.043858s** after **20 seconds** of wall-clock waiting.
- Output file: **4,206,891 bytes**, WebM **VP8 video + Opus audio**. Source finished, then the user-like stop action finalized successfully.
- `ffprobe` last packet end: **video 40.159s**, **audio 40.176s**.
- Decoded frames at output **12s and 20s** were pixel-identical (RGB mean absolute error **0.0**); at output 26s the difference from 12s was **0.00114** (only compression noise); at output 37s the source had resumed (difference **19.807**).
- Decoded audio RMS in 0.8s windows at output 12, 20, 26, 37s: **0.12997 / 0.12974 / 0.12975 / 0.12993**. Synthetic microphone continued through freeze and resumed playback.
- No page JavaScript exceptions, unexpected CSP violations or external HTTP(S) requests were detected.
- **Result:** fresh G9 Chromium automated **PASS**. Physical device G1 / G9 remains **PENDING**.

### Stop-count, orientation and repeated-take matrix

Seven independently saved and decoded recordings passed:

| Source | Pause count | Source → encoded Canvas size | Recorded bytes | Video/Audio | Simulated mic tracks live after result |
| --- | ---: | --- | ---: | --- | ---: |
| 16:9 | 0 | 480×270 → 480×270 | 866,663 | VP8/Opus | 0 |
| 16:9 | 1 | 480×270 → 480×270 | 852,157 | VP8/Opus | 0 |
| 16:9 | 3 | 480×270 → 480×270 | 864,810 | VP8/Opus | 0 |
| 16:9 | 10 | 480×270 → 480×270 | 905,756 | VP8/Opus | 0 |
| Portrait | 3 | 270×480 → 270×480 | 977,748 | VP8/Opus | 0 |
| Square | 1 | 360×360 → 360×360 | 831,173 | VP8/Opus | 0 |
| 90° display-matrix rotation | 1 | 270×480 → 270×480 | 868,819 | VP8/Opus | 0 |

All seven cases reported **zero page exceptions** and **zero external HTTP requests**. The rotated test source was regenerated with *actual* `display_rotation=90` metadata; an initial file merely labeled "rotated" lacked rotation metadata, so its earlier result was **not counted** as a rotation pass.

### T-02/T-03/T-04/T-05: first/last still frame, drawings, output

One additional saved **1,136,289-byte WebM** contained VP8 video and Opus audio until **11.740s / 11.797s** packet endings. Started with ~2 seconds of source paused and synthetic microphone recording; decoded first-frame windows at 0.5s/1.3s had pixel MAE **0.006**, and audio RMS **0.12969 / 0.12973**. Then Circle/Arrow/Pen mouse gestures each auto-paused a playing source (at source positions 0.760s, 1.591s, 2.404s). Decoded frames show drawn outlines during their associated paused segments and clearing after playback resumes. The source reached its 5s end; output continued ~2s with microphone (audio RMS at 10.5s **0.12951**). This is shorter than the 10s-specific planned T-02/T-03 physical acceptance tests.

### Audio–visual sync target (±250ms)

Using a separate dark 480×270 source video, the **same pointerdown** both placed a yellow Point ring into the captured Canvas and triggered a short 1400 Hz test pulse in the *simulated* microphone MediaStream. The decoded exported video first contained the ring and the decoded PCM first exceeded an RMS threshold in these three independent takes:

| Run | First ring frame PTS | First mic pulse | Ring minus pulse |
| --- | ---: | ---: | ---: |
| 1 | 2.067s | 2.090s | **−23ms** |
| 2 | 2.069s | 2.080s | **−11ms** |
| 3 | 2.033s | 2.060s | **−27ms** |

The analysis uses pass-through video frame decoding (no FFmpeg synthetic duplicate frames), source-level yellow-pixel threshold and 10ms audio RMS windows. Timestamp uncertainty is approximately one output-video frame plus one audio window; this is a **headless Chromium laboratory result**, not a physical audio/video synchronization guarantee. All three measured offsets fall within the ±250ms RC target.

### What this does NOT prove

- iPhone Safari, Android Chrome and Windows desktop with actual microphone/OS file saving and separate player are **UNTESTED**.
- Real `file://` navigation remains **blocked by this browser test environment** (`ERR_BLOCKED_BY_ADMINISTRATOR`), not diagnosed as an app defect. HTTPS Preview also needs a real-device full flow.
- Native Web Share, actual screen-reader announcements, low-memory mobile performance, phone lock/call recovery, and proposed 60s/250MiB/180s increased limits remain **UNTESTED**.
- Japanese/English 1360×950 screenshots were captured from the actual v0.9.0 recording workspace; **the PNGs are evidence artifacts, not yet committed to `assets/screenshot.png` / README as release screenshots**.
- **G9 decision: NO-GO / keep Draft PR unmerged.** Automated regression success must not be conflated with physical AC-10 acceptance.


### Reproducing the seven-case smoke

An optional, source-controlled test harness is available at `tests/g9-browser-regression.py`. Its dependencies are **development-only** and are not embedded into Pause & Tell:

```bash
python -m pip install playwright
# Install Chromium with Playwright or supply an existing binary.
python tests/g9-browser-regression.py --html dist/index.html --out ./g9-test-output --chromium /path/to/chromium
```

Requires `ffmpeg` and `ffprobe` on PATH. The script creates local H.264 test fixtures, including an MP4 with a **real display-rotation side data matrix**, runs the seven pause/orientation cases, checks exported video dimensions and the audio/video tracks, and verifies that no synthetic mic tracks remain live. It generates `g9_matrix.json`. Tests use a synthetic WebAudio microphone and an `about:blank` injected page: passing does **not** prove true `file://` loading or physical device support. Full-flow 40s and sync-probe scripts and saved clip evidence are also included in the G9 evidence ZIP delivered in this review.

## Status and decision

G9 **NO-GO** until iOS and Android pass AC-10 and the full-flow tests, the synchronization target is measured in actual saved output, and hard errors are resolved. All G1–G8 real-device gates remain open even if automated headless tests pass. Keep existing Draft PR #1 unmerged, and do not modify Browser Kitty main.
