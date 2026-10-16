# Pause & Tell

[日本語](README.ja.md) · [Specification](APP_SPEC.md) · [Development plan](DEVELOPMENT_PLAN.md)

**Explain a video with your voice while pausing, pointing and drawing.** The output includes the original video frames, your drawn marks and narration. Your microphone and output recording continue while source playback is paused.

> **v0.9.1 development Draft:** Full recording, saving and playback on physical iPhone Safari and Android Chrome devices remain unverified. Release decision: **NO-GO**.

## How to use

1. Choose a video.
2. Choose Point, Circle, Arrow or Pen just above the video.
3. Press **Record & play** directly beneath the video and allow microphone access. The original video starts playing as recording begins. Select **Explain the first frame before playback** if you want to begin on a still frame.
4. **Pause the source** to talk and annotate. Playback resumes with the current drawing cleared; previously recorded marks and narration remain in the output.
5. Press **Finish recording**, preview the result, then download it.

Use **Ctrl+Z / Cmd+Z** to undo and **Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z** to redo current drawings, including Clear within a paused segment. Text-entry fields retain their normal editing shortcuts.

## Saving and privacy

Chosen videos and microphone audio are processed in this browser. There is no automatic upload, analytics, runtime CDN or background API. Only when you explicitly use **Share video** and choose an OS destination might the generated file be transferred outside the device.

Exports use the **actual MP4 or WebM** produced by your browser. A browser download request does not prove a file was stored; check your Files/Downloads app. Interrupted recordings may be recoverable but are clearly marked as incomplete or unverified.

## Current provisional limits

| Item | Trial limit |
| --- | --- |
| Source video | 30 seconds |
| Source file | 100 MiB |
| Output recording | 90 seconds |

These are **conservative test caps for decoder/recording memory use**, not fundamental browser limitations. They will be reconsidered after hardware measurements, especially on mobile devices. The recording buffer also has a memory-safety threshold.

Microphone-only output is the default. Source-audio mixing is an **unverified opt-in experiment on desktop Chromium**. Microphone permission, screen lock and tab switching can interrupt recording.

## Standalone and development

Builds generate readable `dist/index.html` and gzip self-extracting `dist/index.self-extract.html`, without runtime external libraries. Edit `src/index.template.html` and run `build-standalone.bat` on Windows. Diagnostic logs are hidden from the normal UI; add `?debug=1` to the URL during development.

The [G9 acceptance matrix](docs/G9_VALIDATION.md) tracks actual tests and pending device gates. **Do not merge or call this a release until physical device acceptance passes.**

MIT License.
