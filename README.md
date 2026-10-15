# Pause & Tell

[日本語 README](README.ja.md) · [Product specification](APP_SPEC.md) · [Development plan](DEVELOPMENT_PLAN.md)

Pause a source video while recording your spoken explanation. The output recording keeps running even while the source video is paused.

**Current status: v0.7.0 recording, review and export prototype — not a production release.** Real iPhone and Android touch/recording reliability is **not yet verified**.

## What works in v0.7.0

- **Review → Name → Download**: preview the recording, confirm video and audio, edit the filename and download the exact MP4 or WebM that the browser generated.
- Filename sanitization removes directory separators, unsafe/control/bidi characters, trailing spaces/dots, and known duplicate video extensions; empty input falls back to `pause-and-tell`.
- **File Share** appears *only* when the browser reports support for `navigator.canShare({files})` and an actual playable output is available in a secure context. The user selects an OS destination; recovered/corrupt outputs **cannot** be shared.
- **Download/Share requests are not proof of a saved or delivered file.** The recording stays in memory for retry or another save attempt. Changing the source or re-recording asks for confirmation even after Download/Share was attempted.
- Share cancellation is not an error; failure shows a localized warning with Download as a fallback. **Sharing is user-initiated and may send the chosen file outside the device**, unlike automatic app processing.
- Updated bilingual help, export status and [G7 acceptance matrix](docs/G7_VALIDATION.md). Direct iOS/Android native-file and `file://` tests are not yet verified.



- Added **bounded MediaRecorder finalization** (9-second stop-event watchdog) and at-most-once finalization. Available data chunks are retained if a browser fails to dispatch the expected stop callback.
- Monitors microphone track end and sustained mute (3.2-second grace), Canvas capture video end, MediaRecorder errors, source decoding errors and background interruptions.
- **Normal output** is separate from **partially recovered / unverified output**. Recovered media has an explicit caution, and undecodable data is downloadable only as an unverified file with no preview; zero-byte captures are never reported as success.
- Keeps provisional limits of **30s source, 100MiB input, 90s output** and adds a **96MiB recorded-chunk safety limit**. These are not expanded until physical smartphone testing.
- Defensive capture cleanup: no dropped stop chunks, cleanup of recorder/MediaStream/Blob URLs, no repeated startup while finalizing, and file replacement disabled during active recording.
- A **real-time 90-second limit** sample in headless Chromium with synthetic microphone was exported and decoded: VP8/Opus through ~90s, stable final source frame and continued simulated audio. This does **not** establish physical mobile performance. See [G6 failure/recovery acceptance matrix](docs/G6_VALIDATION.md). Physical iPhone/Android and real microphone cases remain **UNTESTED**.



- **Voice only is still the default.** Source audio is never included unless the user explicitly opts in.
- The collapsed **Audio options** section adds **Source sound + voice (experimental)** for desktop Chromium when Web Audio APIs are present. Mobile, Safari and Firefox are deliberately gated off pending testing.
- Three source-volume presets (15% / **30% default** / 50%) feed only the recording mix; microphone stays at 100%. Source audio stops with source-video pause while narration and output keep recording.
- Audio graph does **not connect to speakers**, avoiding doubled monitoring. A failed mixing attempt produces an explicit error instead of silently switching to voice-only.
- Repeated takes reuse a single MediaElementAudioSourceNode/AudioContext binding, disconnect their per-take nodes and suspend the context between takes.
- **Experimental is not supported.** Audio gain, saved-file sound and timing still need exported-file validation; G1–G4 hardware gates and [G5 original-audio tests](docs/G5_VALIDATION.md) remain open.



- **Point / one-tap ring** is now the default drawing tool. Tap once to place a persistent outlined ring at the selected video position; the source video pauses automatically, while microphone/recording continue.
- Marker rings and all other drawings persist while the source is paused. **Undo**, **Clear**, or **Play** remove only currently visible marks; earlier recorded frames stay unchanged.
- On mobile, the four drawing tools are grouped immediately above the video (44px+ touch targets). A contextual bottom transport provides **Record + Play** before recording, or **Play/Pause + Finish** while recording, with safe-area padding and output/status UI kept outside the recorded Canvas.
- The mobile viewport is given extra bottom padding so fixed controls do not cover the work area. Importing a source scrolls to the drawing/video area; finishing a recording scrolls to its result. Portrait and short landscape video previews are scrolled fully above the bottom transport on import; tool selection also brings the video back into view.
- A status badge beside the video indicates whether the source is playing/paused during recording; it is not captured into the output.
- Validation plan: [G4 point and mobile acceptance matrix](docs/G4_VALIDATION.md); actual iOS/Android devices remain **UNTESTED**.


- **Circle/ellipse, arrow and freehand pen** drawing on the source. Choose yellow, white or red; every mark uses a dark outline for legibility.
- Drawing on a playing source **pauses only source playback**. The microphone and output recording continue to advance.
- Stroke positions are recorded in normalized source-video coordinates and composited onto the exact Canvas that is captured for export. UI controls and pointer overlays are not included in the output.
- **Undo line** removes only the last visible stroke; **Clear lines** removes all currently visible marks. Previously recorded frames/voice cannot be rewritten. Marks also clear when the source is resumed, the recording begins, the input changes or a new take starts.
- Works with mouse, pen and touch pointer gestures in the browser; native iOS/Android drawing and recording need physical-device validation (G3).

- A clear **Choose video → Record explanation → Save video** stage indicator and visible selected-file information.
- An explicit microphone explanation before recording, a loading state, and an interruption warning in the output review.
- Japanese/English language toggle uses **JA / EN**; the Help dialog locks background scrolling while preserving dialog scrolling and restores scroll position on close; mobile footer is hidden.
- The supplied SVG icon is the source for both the favicon and header icon; **Fully local processing** replaces the previous upload badge.

- Load one browser-decodable local video file (maximum **30 seconds**, **100 MiB**).
- Preview, play and seek before recording; recording always starts with the source paused at its first frame.
- Grant microphone access only after pressing **Record explanation**. Record the canvas frames plus microphone audio in one MediaRecorder session.
- Play / pause the source video independently. During a pause, output recording and mic continue; after the source finishes, the recording continues on the last frame.
- Finish manually or at a **90-second** output limit; inspect the generated video in the browser.
- Choose an editable filename and download the actual MP4 or WebM format chosen by the browser.
- Switch Japanese / English, inspect locally held diagnostics, and retry without uploading files.

**Not yet supported for general release:** Original source-audio mixing is experimental and may be excluded from v1.0.0. Sharing and timeline editing are not implemented. These are staged in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

## How to try

1. Open the built HTML in a supported secure context (HTTPS or `file://`, subject to browser permissions).
2. Choose a playable video file no longer than 30 seconds.
3. Preview it. Press **Record explanation** and grant the microphone permission.
4. Press **Play source video**, then **Pause source video** to explain the static frame aloud. The recording timer continues.
5. Press **Finish recording**, review the entire output and download it. The file is not automatically saved across reloads.

Use a quiet, short source video for the initial test. Source-audio capture is **off by default**; only your microphone is recorded. Desktop Chromium users may explicitly opt into an experimental source-audio mix under Audio options and must review the exported sound. After starting, Point places a ring with one tap; Circle, Arrow and Pen use drag gestures. Marks are included in the output until cleared or source playback resumes.

## Critical POC test

Play a **20-second** source for **8 seconds**, pause it for **20 seconds** while speaking, then play the remaining **12 seconds**. Verify that the result is about **40 seconds** long, the frozen frames persist during the pause, and voice audio continues. Allow for the initial pause before pressing Play and manual button timing. Record browser/OS/device, real duration, codec/container, and any sync problems. See [G1 validation protocol](docs/G1_VALIDATION.md).

This is a **work-in-progress experiment**; physical-device G1 verification from v0.1.0 is still missing. This is not a G1 or G2 sign-off. G2 interaction review is tracked in [docs/G2_VALIDATION.md](docs/G2_VALIDATION.md). G3 annotation behavior is tracked in [docs/G3_VALIDATION.md](docs/G3_VALIDATION.md), and G4 touch/point acceptance in [docs/G4_VALIDATION.md](docs/G4_VALIDATION.md), and G5 audio mixing in [docs/G5_VALIDATION.md](docs/G5_VALIDATION.md), and G6 recovery in [docs/G6_VALIDATION.md](docs/G6_VALIDATION.md), and G7 export/share in [docs/G7_VALIDATION.md](docs/G7_VALIDATION.md). Automated Chromium tests passed for filename normalization, mocked Share results, result retention and output file codecs, but real OS delivery is not yet verified. This is an **unverified experiment** until tested on actual **iPhone Safari and Android Chrome**, as well as desktop Chrome/Edge. A passing build or preview deploy does not establish recording correctness.

**Automated G5 evidence (not a compatibility guarantee):** In headless Chromium with a synthetic 440 Hz source and simulated 880 Hz microphone, decoded WebM audio contained both tones during playback, only the microphone during the source pause, and the source tone again after resume. Re-recording and replacing the source file also passed. Real iPhone/Android microphones and native-player compatibility are still untested. See [G5 validation](docs/G5_VALIDATION.md).

### Interrupted recordings

If capture is interrupted, Pause & Tell attempts to recover received recorder chunks. A playable partial file is shown with a **recovery** warning; if playback cannot be verified, recovered bytes may still be saved, but **they may be damaged**. An empty/unusable recording never appears as a completed video. This does not guarantee rescue after a browser crash, device shutdown, or screen lock. Review the downloaded video and sound before sharing it.

### Saving and sharing

Downloading requests that your browser save a locally generated Blob; file location and completion depend on your OS and browser. Confirm it in your Downloads or Files app. If native file sharing is supported, you may explicitly select **Share video** and choose an OS recipient. Only that action can transfer the generated file to another app, device or service. Browser Kitty itself does not upload your source video or microphone samples. Canceled sharing leaves your recording in place; unsupported sharing leaves **Download video** available.

## Privacy

File data and microphone samples are kept in this page and processed on your device. The app makes no intentional runtime CDN/API/telemetry calls; the standard restrictive CSP contains `connect-src 'none'`. No video or voice is uploaded. Only language preference can be stored locally. A deliberate browser download exports the result to your device. Reloading or closing the tab discards unsaved recordings.

Microphone access depends on secure contexts and user permission. Backgrounding, screen lock, calls, memory pressure and MediaRecorder browser differences can interrupt or truncate a recording. MP4 is **not guaranteed**; the output format is selected from formats the browser claims to support, and a file still needs manual playback verification.

## Build & source

This repository retains the upstream [htmlapps-template](https://github.com/ttomohisa/htmlapps-template) structure (currently v1.3.0 framework). Read `AGENTS.md` and `docs/ARCHITECTURE.md` before editing.

On Windows, run `build-standalone.bat`. It runs the PowerShell preflight and builds these products:

- `dist/index.html` — self-contained readable HTML.
- `dist/index.self-extract.html` — compressed self-extracting alternative.
- `pause-and-tell.html` — generated repository-root copy identical to the readable HTML.

Do not edit generated artifacts. Edit `src/index.template.html`, `app.config.json`, and `APP_SPEC.md`, then rebuild. Dependencies remain empty; no external runtime libraries are needed for v0.1.

## Browser support / Known limitations

Browser | Current v0.1 G1 verification
--- | ---
Windows Chrome / Edge | Not verified on actual target device
Android Chrome | **Not verified on actual target device**
iPhone Safari | **Not verified on actual target device**
Firefox / desktop Safari | Not verified

The above is a verification status, not a claim of incompatibility.

Screenshots in the imported template were not recordings of this app; real Japanese/English screenshots must be taken once the implementation has been validated, before v1.0.0 release.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
