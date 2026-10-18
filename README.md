# Pause & Tell

Pause a video, record your explanation and drawings, then insert them into the complete original video, entirely on your device.

[日本語](README.ja.md) · [Open the app](https://ttomohisa.github.io/htmlapps-pause-and-tell/)

![Pause & Tell v1.0.0 recording an explanation over a synthetic test video](assets/screenshot.en.png)

## Features

- Choose a local video and add narrated explanations at selected positions
- Record over a frozen frame; keep every original video interval and its soundtrack around explanations
- Point, Circle, Arrow and Pen, three colors, Undo/Redo and Clear
- Preview, delete or safely rerecord individual explanations
- Compose a WebM video; optional native MP4 on compatible devices
- Separate recording, composition and saving, with an editable output filename and optional device sharing
- Cancel processing and retain the previous successful result after a failed export
- Compact recording timer and warnings near recording/output limits
- Japanese/English, keyboard controls and responsive desktop/phone layout

## How to use

1. [Open the app](https://ttomohisa.github.io/htmlapps-pause-and-tell/), choose a video and move **Position** to the frame you want to explain.
2. Choose **Record explanation here** and allow the microphone. Narrate over the frozen frame; draw with Pen, Point, Circle or Arrow.
3. Choose **Finish explanation**. Repeat at other positions as needed. Select an explanation to preview, delete or rerecord it. Cancelling a rerecording retains the old explanation.
4. Choose **Compose video with insertion**, review the result, then **Save video**. Open the saved file separately to check playback. Sharing appears only when supported by the device.

Source seeking chooses insertion positions before recording. During an explanation the source stays frozen. Drawing changes appear at their narration times; Undo/Clear do not retroactively erase earlier output frames. Export re-encodes video, so it is not lossless.

## Privacy

Video, audio and drawings are processed inside your browser. There are no automatic uploads, runtime CDN downloads, analytics or remote media processing. Hosted use downloads the initial HTML. Explicit device sharing sends only the generated file to the destination you choose.

Explanations are session-only: closing/reloading or OS process termination can lose them. Save successful output before leaving. A failed or cancelled in-session replacement retains the prior explanation/result; pending temporary-file cleanup is disclosed and retried before another export. This is not persistent project recovery.

## Browser support and limits

v1.0.0 retains the measured scope of the insertion editor; the version number does not guarantee all-device compatibility. Recording requires microphone access and MediaRecorder; composition requires compatible browser decoders/encoders and WebCodecs. Use the HTTPS app if local-file microphone access is unavailable.

- **WebM VP8/Opus is standard.** Native AVC/AAC **MP4 is auxiliary and experimental**, limited to **30 seconds of completed output**. MP4 can be easier to open in messaging/video apps; it is unnecessary when WebM works for your recipient.
- Attempt ceilings: source **5 minutes/250 MiB**, each explanation **2 minutes**, WebM output **10 minutes**. These are not successful-processing or device-memory guarantees. Length guidance appears before export.
- Desktop 180-second WebM export/save/full decode and a Pixel owner's real-video recording/save, approximately three-minute playback and rerecord cancellation are documented. Pixel model/OS/browser versions were not recorded. Short native MP4 acceptance has separate limited evidence.
- Broad Android/iPhone compatibility, arbitrary camera VFR/HEVC/HDR, maximum-capacity input/output, physical storage exhaustion and recovery after OS termination remain unverified. Unsupported codecs fail visibly.

See [validation](docs/INSERTION_POC_VALIDATION.md) for measured environments and results. No optional AAC/WASM fallback is bundled.

## Offline single HTML

Use a downloaded `pause-and-tell.html` or `dist/index.html`. The normal build produces these byte-identical readable files and the smaller `dist/index.self-extract.html`. Runtime libraries, licenses and source links are embedded; no server is needed after download. The self-extracting variant also requires `DecompressionStream`. Microphone and codec support still depend on the browser.

The [hosted readable HTML](https://ttomohisa.github.io/htmlapps-pause-and-tell/index.html) and [self-extracting HTML](https://ttomohisa.github.io/htmlapps-pause-and-tell/index.self-extract.html) can be saved for offline use. The hosted version follows the merged main branch.

## Development

Read [AGENTS.md](AGENTS.md) and [APP_SPEC.md](APP_SPEC.md). On Windows with Node.js installed, run `build-standalone.bat`, or `./scripts/check-repository.ps1` in PowerShell to build and verify both variants.

The canonical editor source is `experiments/insertion-poc/`; that historical directory name does not select a separate product. Pinned dependencies live in its `package.json` and npm lock. Never hand-edit generated HTML. The archived `src/index.template.html` and G1–G9 records describe the former continuous recorder.

Short media/failure regressions are routine. Longer/native milestones remain opt-in; see [test policy](docs/INSERTION_TEST_POLICY.md). Existing GitHub Pages deployment rebuilds and verifies the app after main changes.

## License

Application: MIT. Embedded Mediabunny 1.61.5: MPL-2.0. See [third-party notices](THIRD_PARTY_NOTICES.md); full library license and exact source-package link are available in Help.
