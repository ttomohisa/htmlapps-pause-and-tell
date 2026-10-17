# Pause & Tell

[日本語](README.ja.md) · [Specification](APP_SPEC.md) · [Development plan](DEVELOPMENT_PLAN.md)

**Explain a video with your voice while pausing, pointing and drawing.** The output includes the original video frames, your drawn marks and narration. Your microphone and output recording continue while source playback is paused.

> **v0.9.3 development Draft:** Full recording, saving and playback on physical iPhone Safari and Android Chrome devices remain unverified. Release decision: **NO-GO**.

## Choose a workflow (Draft preview)

[Choose a mode](https://r1418429453-pr-1-bk-previews.ttomohisa.workers.dev/modes/):
- **Normal v0.9.3** keeps the continuous recording workflow below.
- **Experimental insertion editor** records explanations separately and inserts
  them into the whole source video. WebM is default; native AVC/AAC MP4 requires
  compatible encoders and is limited to 30 seconds of completed output.

Both open in separate tabs; work is not transferred between them. Check saved
files before relying on them. Broad phone compatibility remains unverified.
See [current insertion usage and evidence](experiments/insertion-poc/README.md).

## How to use

1. Choose a video.
2. Pen is selected by default. Choose Point, Circle or Arrow if you prefer another drawing tool.
3. Press **Record & play** directly beneath the video and allow microphone access. The original video starts playing as recording begins. Select **Explain the first frame before playback** if you want to begin on a still frame.
4. **Pause or seek the source** while recording to talk and draw. Seeking pauses source playback automatically but does not pause microphone recording; skipped footage is **omitted** from the live-captured output. Drawings are cleared when playback resumes or you seek.
5. Press **Finish recording**, then confirm in the dialog. The source pauses during confirmation, but recording and microphone continue. Cancel returns to the recording and resumes source playback if it had been playing. Preview and download the result after confirming.

The hero and three-step progress remain visible during recording and preview. Video controls remain directly beneath the video.

**This is still one continuous canvas recording, not non-destructive insertion into the original video.** The separate experimental insertion editor records independent narration segments and composes them with the entire source video and its soundtrack at export. It does not replace this normal mode.

Use **Ctrl+Z / Cmd+Z** to undo and **Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z** to redo current drawings, including Clear within a paused segment. Text-entry fields retain their normal editing shortcuts.

## Saving and privacy

Chosen videos and microphone audio are processed in this browser. There is no automatic upload, analytics, runtime CDN or background API. Only when you explicitly use **Share video** and choose an OS destination might the generated file be transferred outside the device.

Exports use the **actual MP4 or WebM** produced by your browser. A browser download request does not prove a file was stored; check your Files/Downloads app. Interrupted recordings may be recoverable but are clearly marked as incomplete or unverified.

## Current provisional limits

| Item | Trial limit |
| --- | --- |
| Source video | Up to 5 minutes |
| Source file | Up to 250 MiB |
| Output recording | Up to 10 minutes |

These are **experimental expanded caps**, not guaranteed durations or browser-defined limits. The in-memory recording-chunk budget is 256 MiB; recording stops earlier if it is reached. Large sessions may run out of device memory sooner, especially on phones. Physical Android/iPhone long-session recording remains unverified. Check saved output before use.

Microphone-only output is the default. Source-audio mixing is an **unverified opt-in experiment on desktop Chromium**. Microphone permission, screen lock and tab switching can interrupt recording.

## Standalone and development

Builds generate readable `dist/index.html` and gzip self-extracting `dist/index.self-extract.html`, without runtime external libraries. Edit `src/index.template.html` and run `build-standalone.bat` on Windows. Diagnostic logs are hidden from the normal UI; add `?debug=1` to the URL during development.

The [G9 acceptance matrix](docs/G9_VALIDATION.md) tracks actual tests and pending device gates. **Do not merge or call this a release until physical device acceptance passes.**

MIT License.
