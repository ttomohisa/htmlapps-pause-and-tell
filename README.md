# Pause & Tell

[日本語](README.ja.md) · [Specification](APP_SPEC.md) · [Validation](docs/INSERTION_POC_VALIDATION.md)

**Record explanations at chosen positions, then insert them into the whole source video.** This Draft replaces the former continuous recorder as the normal entry. Original footage is retained; the original soundtrack plays around each inserted explanation. Export re-encodes video, so it is not lossless.

[Open the current PR preview](https://r1418429453-pr-1-bk-previews.ttomohisa.workers.dev/). The previously shared `/insertion-poc/` preview URL opens the same application. There is no need to choose another mode.

## How to use

1. Choose a video and move **Position** to the frame you want to explain.
2. Choose **Record explanation here** and allow the microphone. Narrate over the frozen frame; Pen is default, with Point, Circle and Arrow plus yellow/white/red drawing, Undo/Redo and Clear.
3. Choose **Finish explanation**. Repeat at other positions if needed. Select an explanation to preview, delete or rerecord it. Cancelling a rerecording retains the old explanation.
4. Choose **Compose video with insertion**, review the result, then **Save video**. Open the saved file separately to check playback.

Source seeking selects insertion points before recording, rather than skipping original footage in a live recording. During an explanation the source stays frozen. Drawing changes are captured at their narration times; Undo/Clear do not retroactively erase earlier output frames.

## Formats, safety and limits

- **WebM is default.** Native AVC/AAC MP4 is an auxiliary experimental choice for compatible devices, limited to **30 seconds of completed output**. MP4 can be easier to open in messaging/video apps; it is not needed when WebM works for your recipient.
- Trial ceilings: source 5 minutes/250 MiB; each explanation 2 minutes; WebM output 10 minutes. These are attempt limits, not performance guarantees. Duration guidance is shown before export.
- Save successful output before leaving. Explanations are session-only: closing/reloading or OS process termination can lose them. Failed or cancelled in-session replacement retains the prior successful result; pending temporary-file cleanup is disclosed and retried before a new export.
- No automatic uploads, runtime CDN, analytics or remote media processing. Explicit OS sharing sends only the generated file to the destination you choose.
- Desktop 180-second WebM export/save/full decode and a Pixel owner's real-video recording/save, approximately three-minute playback, and rerecord-cancel preservation are documented. Pixel model/OS/browser versions were not recorded. This is not universal Android/iPhone support. Short native MP4 acceptance has separate limited evidence.

## Build and verification

Run `build-standalone.bat` on Windows (Node.js required for the pinned build-only dependencies). The canonical editor source is `experiments/insertion-poc/`; the historical directory name does not select a second product. The standard build generates matching root HTML, `dist/index.html` and gzip self-extracting `dist/index.self-extract.html`. Runtime libraries and license notices are embedded.

Short media/failure regressions remain routine; long/native milestones stay opt-in. The archived `src/index.template.html` and older G1–G9 records describe the former continuous recorder, not the current distribution. See [test policy](docs/INSERTION_TEST_POLICY.md). The PR remains unmerged; integration does not authorize a production deployment.

Application code: MIT. Embedded Mediabunny: MPL-2.0; see the embedded license/source notice and [third-party notices](THIRD_PARTY_NOTICES.md).
