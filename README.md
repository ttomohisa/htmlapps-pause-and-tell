# Pause & Tell

[日本語 README](README.ja.md) · [Product specification](APP_SPEC.md) · [Development plan](DEVELOPMENT_PLAN.md)

Pause a source video while recording your spoken explanation. The output recording keeps running even while the source video is paused.

**Current status: v0.1.0 recording-engine proof of concept — not a production release.** Drawing tools, native-mobile reliability, and browser compatibility are not yet verified.

## What works in v0.1.0

- Load one browser-decodable local video file (maximum **30 seconds**, **100 MiB**).
- Preview, play and seek before recording; recording always starts with the source paused at its first frame.
- Grant microphone access only after pressing **Record explanation**. Record the canvas frames plus microphone audio in one MediaRecorder session.
- Play / pause the source video independently. During a pause, output recording and mic continue; after the source finishes, the recording continues on the last frame.
- Finish manually or at a **90-second** output limit; inspect the generated video in the browser.
- Choose an editable filename and download the actual MP4 or WebM format chosen by the browser.
- Switch Japanese / English, inspect locally held diagnostics, and retry without uploading files.

**Not in v0.1.0:** Circles, arrows, drawing, tap highlights, source audio, sharing, timeline editing. They have their own stages in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

## How to try

1. Open the built HTML in a supported secure context (HTTPS or `file://`, subject to browser permissions).
2. Choose a playable video file no longer than 30 seconds.
3. Preview it. Press **Record explanation** and grant the microphone permission.
4. Press **Play source video**, then **Pause source video** to explain the static frame aloud. The recording timer continues.
5. Press **Finish recording**, review the entire output and download it. The file is not automatically saved across reloads.

Use a quiet, short source video for the initial test. Source-audio capture is intentionally off; only your microphone is recorded.

## Critical POC test

Play a **20-second** source for **8 seconds**, pause it for **20 seconds** while speaking, then play the remaining **12 seconds**. Verify that the result is about **40 seconds** long, the frozen frames persist during the pause, and voice audio continues. Allow for the initial pause before pressing Play and manual button timing. Record browser/OS/device, real duration, codec/container, and any sync problems. See [G1 validation protocol](docs/G1_VALIDATION.md).

This is an **unverified experiment** until tested on actual **iPhone Safari and Android Chrome**, as well as desktop Chrome/Edge. A passing build or preview deploy does not establish recording correctness.

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
