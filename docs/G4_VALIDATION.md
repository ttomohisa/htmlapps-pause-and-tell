# G4 — One-tap point and mobile operation (v0.4.0)

> Status: implementation in Draft PR #1; **physical-device G1–G4 sign-off not complete**. Green CI and headless Chromium checks are not proof of iPhone Safari/Android Chrome reliability.

## Definition of the point marker

- Select **指差し / Point** (default selection) and tap once on an in-video position.
- The tap must **pause source playback only** if the source is playing; continuous microphone/MediaRecorder capture remains running.
- Add one persistent, **outlined visible ring with a center dot** at the tapped point. This marker is composited into the same Canvas as the video, so the exported file contains it but excludes toolbar/status/transport elements.
- The ring remains visible while source playback is paused. It is removed by **Undo**, **Clear**, source **Play**, file replacement or re-recording. Previous captured frames must not be altered.
- Dragging after a tap in Point mode does not create a long freehand stroke or multiple rings; a non-primary multitouch pointer must not add another marker.
- Positions must be normalized relative to **the displayed video Canvas rectangle**, not the viewport. Position should remain stable for 16:9, 9:16 and portrait/landscape rotation.

## Mobile UX definition

- One accessible 4-tool selector (Point/Circle/Arrow/Pen), visually adjacent to the video, with touch targets of **at least 44 CSS px**.
- Colors, Undo and Clear stay adjacent to the tools; tools precede the video on the recording screen.
- The **contextual transport bar** stays at the mobile viewport bottom in Ready and Recording phases:
  - Ready: **Record explanation** and **Play source video**.
  - Recording: **Pause/Play source** and **Finish recording**.
  - Preparing / Finalizing / Result: no inert transport bar.
- The bar must respect `env(safe-area-inset-bottom)`, not hide the last content or help content, and not duplicate another fixed bottom navigation.
- Recording status is visible near the source video, but **not present in exported pixels**.
- At 320/360/390px width, portrait video, 844x390 coarse-pointer landscape and short screens: no horizontal overflow, overlapping buttons, clipped tools, or offscreen dialog.
- Loading a source should scroll compact layouts to the drawing/video area; finishing should scroll to output preview, reducing extra scrolling. Desktop navigation must remain stable.
- Drawing touch gestures apply `touch-action:none` only on the video drawing surface; page scrolling outside it must remain possible.
- Help modal keeps body-scroll lock and inner help scroll; mobile footer remains hidden.

## Test matrix

| ID | Scenario | Expected evidence |
| --- | --- | --- |
| G4-01 | Load 20s landscape source and choose Point | Point selected, color selected, four 44px+ tools |
| G4-02 | Start recording; play source; tap video center | Source pauses, output timer increases and ring appears at tapped position |
| G4-03 | Wait 6s with source paused | Ring persists in a decoded saved-video frame over whole interval |
| G4-04 | Tap again at another point | Two rings (single ring per tap); no accidental pen line |
| G4-05 | Undo, Clear, Play | Latest ring removed by Undo; Clear wipes visible rings; Play wipes all visible marks |
| G4-06 | Recorded before and after playback resume | Earlier exported frames have ring, later frames do not |
| G4-07 | Change to Circle/Arrow/Pen | Existing tools still work and pause only source |
| G4-08 | Portrait source 9:16 at 320px | Ring position matches final decoded video; drawing-stage scroll works |
| G4-09 | 320/360/390/844×390 coarse touch viewport | Transport reachable, 44px targets, no horizontal overflow or fixed-bar collision |
| G4-10 | JA↔EN while ready/recording | Active tool, source/video status and clocks retained |
| G4-11 | Open Help near bottom; scroll inside; close | Underlying position fixed and restored, Help reaches last item |
| G4-12 | Tap near video corners and outside Canvas | Inside marks aligned; outside pointer must not create marks |
| G4-13 | Start recording, stop, save, record again, replace source | No stale ring, recording result or microphone track |
| G4-14 | `file://` standalone and HTTPS Preview | Independent mic / save / CSP/no-network verification |
| G4-15 | Physical Android Chrome & iPhone Safari | Actual touch, voice, ring, saved video and native playback verified |

## Required test artifacts

A G4 smoke record must include the exact Git SHA, built HTML identifier, browser/OS, test video duration, orientation/size, output format and length, source/record time at the tap, ring appearance and disappearance times, and a **decoded frame from the actual saved output**. Distinguish synthetic microphone audio from a hardware microphone. Record screen size, safe-area and clip/overlap findings.

## Physical gate status

| Platform | Tap/drag | Audio recording | Mobile transport | Save and native playback | Status |
| --- | --- | --- | --- | --- | --- |
| Windows Chrome/Edge | Not yet tested on physical target | Not tested | N/A | Not tested | PENDING |
| Android Chrome (physical) | Not yet tested | Not tested | Not tested | Not tested | **PENDING** |
| iPhone Safari (physical) | Not yet tested | Not tested | Not tested | Not tested | **PENDING** |

**G4 must not be marked complete** until physical devices are tested and the previous G1/G2/G3 blockers are resolved. The next-stage v0.5.0 audio mixing feature remains conditional on separate real-device evidence.

## Automated smoke evidence (2026-10-15; G4 remains unapproved)

Source: commit `9fff11e70b759fab60f2224dfc25324cf4238e60`, GitHub Actions-generated `dist/index.html`; Linux headless Chromium 144 / Playwright with WebAudio oscillator replacing the physical microphone. **This does not establish iPhone/Android device support.**

- Source pause after a tap: landscape time stayed **1.0494s**, portrait stayed **0.994s** while output recording continued for about 1.7s.
- Saved output: **640×360 VP8+Opus WebM** (landscape) and **360×640 VP8+Opus WebM** (portrait); 0 JS errors; no HTTP(S) requests. `blob:` references only.
- Decoded video frames (0.4 / 2.2 / 3.6 seconds) around a test ring on a dark fixture: yellow-like pixel counts **0 / 108 / 0** (landscape) and **0 / 216 / 0** (portrait). Ring is present in the middle recorded frame and absent from earlier/later ones.
- Initial mobile rendering: 320×740 portrait had full visible video rect **181.5–558.8px**, bottom transport starts **661px**; 844×390 coarse-touch landscape video rect **95.6–294.5px**, bottom transport starts **319px**. Both fully visible above transport.
- 320, 360, 390px portrait-touch widths; 844×390 touch landscape; 1280×900 desktop: no horizontal overflow; 44px+ tool height; footer hidden only on mobile; fixed transport visible. JA/EN and help background-scroll lock preserved.
- Build/Preview CI success on the tested commit. Real devices and direct `file://` opening remain UNTESTED (sandbox blocks file navigation).

**Gate decision:** G4 automated subset PASS; overall **G4 PENDING** until physical Android Chrome / iPhone Safari, real microphone, saved-file playback and rotation tests are completed. G1/G2/G3 physical gates are also pending.
