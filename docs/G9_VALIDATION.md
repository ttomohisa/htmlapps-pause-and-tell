# G9 — Release-candidate verification and release decision (v0.9.0)

> **Release decision: NO-GO / Draft** until required real iPhone Safari and Android Chrome full-flow tests pass. This is an *RC candidate review*, not permission to publish v1.0.0, merge a PR, claim device support or treat trial resource limits as verified.

## Actual scope / fixed prototype limits

- Keep all v0.1–v0.8 behavior. Do not silently remove annotation tools, opt-in desktop Chromium audio mix, protected local microphone-only recording, partial recovery or conditional OS Share.
- **v0.9.2 trial policy:** Following explicit user feedback, input 5min / 250MiB, recording 10min and 256MiB recorded-chunk caps are enabled **without claiming real-device validation**. These are not guaranteed device-supported durations; mobile memory, audio/video synchronization and saved-file testing remain release blockers.
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
| T-16 | Test long inputs and recording on physical devices | Check 5-minute/250MiB input, 10-minute output and 256MiB chunks without corrupting audio or video | **BLOCKER for release (new limits unverified)** |

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


## v0.9.1 usability and recording-insertion regression — 2026-10-16

**User-reported issues targeted:** recording appears not to be inserted into source playback; controls too distant from the preview; lack of Ctrl+Z/Ctrl+Y; developer-only UI clutter; arbitrary-looking size/duration caps.

### Code/UX changes

- The main recording workspace is ordered **Point/Circle/Arrow/Pen → video Canvas → Record & play / Preview or Pause / Finish → two clocks → optional settings**. The transport is no longer a distant fixed mobile footer. A long filename is truncated instead of pushing actions away. 320px action groups are balanced; minimum button targets remain about 44px.
- **Record & play** is the default: capture starts with a live mic/Canvas, then playback of the original source is requested. A separate opt-in checkbox starts on a *paused* first frame, preserving that explanation workflow. If browser playback is blocked, recording continues with a warning and an explicit Play action.
- Undo / Redo of **currently visible** strokes is available through **Ctrl/Cmd+Z**, **Ctrl+Y**, **Ctrl+Shift+Z**, **Cmd+Shift+Z** and nearby icon buttons. Clear itself is undoable while paused. When playback resumes, the current drawing and its history clear, but already captured video is unchanged.
- Development-only Diagnostics and Build Info are hidden from the everyday page, available with `?debug=1`. Product copy and both README files no longer show version-by-version prototype status as the main user guide.
- Source ≤30s, input ≤100 MiB, output ≤90s remain **conservative temporary memory-safety test caps**, not fixed browser API limits. An additional 96 MiB recording chunk budget and recovery-state handling remain; expand caps only after actual phone memory/audio testing. The limits are clearly explained in the product README.

### Recorded-file proof of source pause insertion

**Chromium headless synthetic microphone test; NOT real iOS/Android.** On v0.9.1-generated standalone, a dynamic H.264 source started automatically and was paused after 1.462s of source playback. It was held for **2.2 seconds** of real recording, then resumed and recorded further, saved as a locally decoded **WebM VP8 + Opus**:

- Source position at pause **1.461676s**, after 2.2s pause **1.461676s** (no progression), after resumed playback **2.721319s**.
- Exported video last packet **5.056s**, audio last packet **5.074s**, total **505,709 bytes**.
- Decoded output at 2.0s vs 3.1s inside frozen segment RGB MAE **0.0012**; decoded 3.1s frozen vs 4.4s resumed RGB MAE **16.207**.
- Audio RMS of the 880 Hz simulated microphone tone around output 2.1s/3.2s/4.4s **0.22089 / 0.22074 / 0.22068**, proving continuing simulated audio during source pause and after resume.
- **0 page JavaScript exceptions**, **0 app HTTP(S) requests**.

The above shows recording *duration is inserted while the source is paused* in Chromium's final saved result. It does **not** establish that the exact reported behavior is fixed on an unknown physical device. If a user's browser still fails to record, collect the OS/browser, loaded file codec, explicit error and video output, and reproduce on hardware before claiming resolved.

### Responsive and Undo/Redo checks (synthetic browser)

The UI was checked at desktop **1280×800**, touch **320×568**, **360×740**, **390×844** and touch landscape **844×390**. In all checked sizes, the video-to-transport vertical gap was **under 27px**, no horizontal overflow was detected, and the transport was **position: static**, not fixed. Diagnostics, Build Info and the obsolete progress steps were hidden during editing.

In desktop and 320px cases the exported result had video+audio, with Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Undo Clear, playback clearing and no remaining live synthetic mic tracks. A separate still-first-frame opt-in test preserved the paused source until Play was selected. The saved autoplay output at **0.6s vs 1.8s** changed visibly (frame RGB MAE **16.21**) and included both video and audio streams.

### Gate decision

**v0.9.1 Chromium smoke PASS**, but **G9 / release remains NO-GO**. The source duration/file size caps have *not* been raised, physical iPhone Safari and Android Chrome real recording/save/decoded replay remain missing, and direct `file://` operation remains untested in the current browser harness. No PR merge or Browser Kitty site deployment is authorized by these results.


### Final v0.9.1 exact-artifact reproduction (2026-10-16)

**CI HTML tested:** `5c0c7be684022bf25940cc062be1aa8295b9e5cd` (v0.9.1), using Playwright/headless Linux Chromium and a synthetic 880 Hz mic track. The production source and build checks passed. This is **not** a real microphone/device test.

- **Viewport/layout:** Desktop 1280×800, smartphone-size 320×568, 360×740, 390×844, and short landscape 844×390 all avoided horizontal overflow. Tools, video and transport were adjacent; measured gap from Canvas to recording controls **14–15px**, with `position: static` (no distant/fixed buttons). The two recording smoke cases saved actual playable files with video **VP8 + Opus audio**, no remaining live synthetic mic tracks, and no application HTTP or JS errors.
- **Drawing history:** Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Undo Clear and playback-clears-history passed in both desktop and 320px Chromium contexts. First-frame paused-start option also passed.
- **Ordinary default Record & play:** Original video advances after recording begins, without the user having to locate a second Play button. Saved output frames at 0.6s and 1.8s differed visibly in a separate dynamic-content regression.
- **2.2s paused narration segment, actual saved WebM:** Source time was **1.447564s** before and after 2.2s pause, then **2.708551s** after resuming. Output last packets were **video 5.043s / audio 5.075s**, file **515,484 bytes**. Pixel MAE paused frames **0.00035**, paused vs resumed frame **16.22**. Synthetic microphone RMS around output 2.1/3.2/4.4s was **0.22089 / 0.22074 / 0.22068**. Output includes both the paused explanation interval and resumed source motion.
- **20s paused narration segment, actual saved WebM:** Source time stayed **1.045225s** for the entire 20s hold. Exported **1,393,928-byte** video has packet end times **video 25.140s / audio 25.178s**. Output frames at 5s vs 17s in the freeze region have RGB MAE **0.38** from lossy VP8 compression, versus **17.32** between frozen 17s and resumed 24s. Synthetic audio RMS at 5/17/24s **0.17980 / 0.18053 / 0.18016**. The first overly tight test threshold (MAE below 0.2) was a **test threshold issue**, not missing video; independent decoded output and source position show the freeze correctly. No JS exceptions or external HTTP requests.
- **Developer UI:** Diagnostics and build information were hidden by default, with `?debug=1` opt-in only. User README, Help and transport controls now describe actual behavior rather than successive technical prototype stages.
- **Automation:** The existing optional `tests/g9-browser-regression.py` was updated to match Record & play autoplay semantics, and `tests/recording-ux-smoke.py` added for browser/filename, Undo/Redo and pause continuity. These developer-only harnesses are **not** runtime app dependencies or real-device certification.

**Gate:** automated v0.9.1 usability + output-media subset PASS. **Overall G9 NO-GO** continues because actual iOS/Android microphone, pause/replay, native file save/playback, device rotation and `file://` testing remain unverified. Source 30s/100 MiB and output 90s remain trial limits; the observed Chromium successes do not justify raising them for all smartphones yet.


## v0.9.2 longer-recording / hero regression — 2026-10-16

The user requested more recording time and the previous hero / three-step progress back. Application code now accepts **5-minute source video, 250 MiB input file and 10-minute output recording**, guarded by an in-memory **256 MiB chunk budget** (previously 30s / 100MiB / 90s and 96MiB chunks). The encoder still targets **2.4 Mbps video**. This is an experimental software cap, not a guarantee of a ten-minute capture on every phone; output may stop early on memory pressure, chunk limit or device interruption.

The hero heading, description, local-processing badge and three-step progress remain in the DOM and visible through ready, recording and result phases. The video-first drawing tools and inline playback/record/finish buttons remain unchanged. Narrow-view hero typography is compact.

**Not yet tested on physical devices:** real-time recording exceeding 90 seconds, sessions of at least 5 minutes, near-10-minute output, 250 MiB inputs, low-memory recovery, independent saved-file playback, and audio synchronization after long pauses. Manual Playwright/Chromium can exercise the 95-second branch with the option --long-recording in tests/recording-ux-smoke.py; this does not replace actual phone testing. Standalone build/contract checks are also not proof of long-session reliability. **G9 NO-GO** remains.
