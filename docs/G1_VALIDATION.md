# G1 — Continuous recording validation (v0.1.0)

> Status: **UNVERIFIED**. No real iPhone/Android capture or playback proof has been collected yet. Do not mark G1 as passed based on a passing build or syntax check.

## Objective

Prove that a local 20-second source video can be played for 8 seconds, paused for 20 seconds while microphone narration continues, then played for another 12 seconds, resulting in about 40 seconds of playable output with static frames during the pause.

The implementation intentionally starts the source **paused at 0 seconds**. Start talking/replaying promptly if the target duration is important, and record any initial gap separately. The recorder stops only when the user presses **Finish recording** (or the 90-second guard is reached). Source end does not stop it.

## Input fixtures

Use browser-decodable 20-second MP4 video without original audio, preferably with visible second counters. Test:

- Landscape 1920×1080, 20s, no audio.
- Portrait 1080×1920, 20s, no audio.
- A still/low-motion source (static section verification).
- Unsupported codec, empty file, more than 30s, more than 100MiB for rejection behavior.

Example using a locally installed FFmpeg (not required at app runtime):

```bash
ffmpeg -f lavfi -i "testsrc2=size=640x360:rate=30" -t 20 -an -c:v libx264 -pix_fmt yuv420p fixture-20s.mp4
```

Record the exact input codec with `ffprobe` if available. Browser support depends on codec, not just extension.

## Manual procedure

1. Open a generated `dist/index.html` over HTTPS or direct `file://` where microphone access works. Start with no previously granted permission.
2. Confirm the initial page does not request microphone access. Load a playable, 20s clip.
3. Preview and seek before recording. Press **Record explanation**, grant mic permission, and verify the source is paused at 00:00 while **output recording time** increases.
4. Press **Play source video**, measure 8 seconds of source play, then press **Pause source video**.
5. Say a distinctive phrase every ~5 seconds for 20 seconds of pause. Confirm the source time stays still while output time continues. Visually observe the static frame.
6. Resume source playback for the remaining ~12 seconds, let it end, and optionally add a brief final phrase on the final frame.
7. Press **Finish recording**. Review the output directly in the result player, start to finish, including narration throughout the freeze.
8. Download the output and **open the downloaded file in the device/OS player**. Verify playable audio, freeze length, frame content, actual format and duration. Do not rely only on `MediaRecorder.isTypeSupported`.
9. Open **Local technical diagnostics** and note the selected MIME type, elapsed wall time, output byte length, parsed duration, and browser/OS version.
10. Repeat on desktop Chrome/Edge, physical Android Chrome, and physical iPhone Safari. Test both portrait and landscape sources.

**Expected duration:** 8s + 20s + 12s = about 40s, plus the lead-in before pressing Play or any time after the source ends. Initial tolerance target ±1.5s after adjusting for manual timing. This is a target, not an observed claim.

## Gate G1 matrix

Environment | Browser/OS version | Source orientation | Actual output MIME/container | Actual duration | Static 20s | Mic continuity | Result
--- | --- | --- | --- | --- | --- | --- | ---
Desktop Chrome | *not measured* | landscape | — | — | — | — | **UNTESTED**
Desktop Edge | *not measured* | landscape | — | — | — | — | **UNTESTED**
Android Chrome (physical) | *not measured* | both | — | — | — | — | **UNTESTED**
iPhone Safari (physical) | *not measured* | both | — | — | — | — | **UNTESTED**

## Failure scenarios

- Microphone permission denied/unavailable: app does not start an audio-less recording or request permission on page load.
- Unsupported MediaRecorder/captureStream/codec: visible error, no false success.
- Source 30s+/100MiB+, invalid duration, 0-byte, unsupported codec: reject safely.
- Source reaches end while recording: last frame remains visible and mic continues.
- Background tab/screen locked: try to finalize available chunks and **warn**; no guarantee of recovery.
- Start/stop rapid clicks: only one active recorder and no double-commit.
- Retry multiple recordings: old Blob URLs, mic tracks and video captures are released.
- iOS MP4 and Chromium WebM: extension follows actual Blob MIME; downloaded output plays in a native player.
- `file://` standalone and HTTPS preview should be tested **separately**; secure context and browser permission behavior may differ.

## Decision after G1

If real smartphone playback drops the static interval, has black frames, or truncates the audio, **do not advance to v0.2 or add annotation UI**. Investigate captureStream stationary frame production, encoding timestamps, autoplay, and audio/video muxing; consider an offline event-recording + render alternative if necessary.

If all mandatory cases pass, document verified device/browser versions and attach an output recording fixture where sharing it is appropriate. Retain the explicit limitations for unsupported environments.

## Automated Chromium smoke result — not a G1 pass

- Date: 2026-10-14. Platform: headless Linux Chromium 144 in an isolated test browser.
- Input: 20-second landscape H.264 fixture, 640×360.
- Procedure: start recorder with simulated audio from an in-page WebAudio oscillator (not a physical microphone); play source for ~3.1s, pause for ~4.2s, resume, stop after a ~12.1s total session.
- Observed before MIME priority adjustment: output source clock remained at 00:03 throughout pause while output clock moved from 00:04 to 00:08; exported 12.1075s video/audio file, 640×360, with non-silent simulated audio. Static interval retained matching frames.
- Initial Chromium generic-MP4 selection resulted in VP9 + Opus **inside MP4**; format priority changed to prefer explicit WebM VP8/Opus before generic MP4. New emitted file format must be reverified after that change.
- 360px viewport: no horizontal overflow (scrollWidth 360px). Start button label shortened for narrow touch screens.
- This test loads the generated standalone HTML into a test page; real `file://` or HTTPS permission flows, hardware mic, physical iOS Safari/Android Chrome and real device playback have **not been tested**. These remain blocking items for G1.
