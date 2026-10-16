# v0.10.1 — insertion PoC with original soundtrack

This is an **isolated experimental proof of concept**, not the default Browser Kitty app or a completed release.

- Opens one short source video (≤15s, ≤30MiB), with or without an original soundtrack. Unsupported decoding fails visibly instead of silently dropping an audio track.
- Pauses at the chosen source position; captures only microphone audio as a separate Blob and pen strokes as timestamped drawing events. No full-source recording during narration.
- Exports a WebM (VP8/Opus) preserving the *entire original video*. For audio-bearing originals, the source soundtrack plays before and after the inserted explanation; the inserted interval has narration only.
- Uses Mediabunny/WebCodecs offline at export. Source is re-encoded (not lossless); export processing is **not** a real-time recording of the original source.
- The memory limits protect the prototype's OfflineAudioContext and BufferTarget. Original audio switching passed a synthetic Chromium/ffprobe test, but physical smartphone sound preservation, file://, multiple inserts, robust cancellation and multi-minute output remain **unverified or unfinished**.

## Build

From this folder: \`npm install --no-audit --ignore-scripts\`, then \`npm run build\`. The pinned Mediabunny and esbuild versions are build dependencies only. Deliverable: \`dist/index.html\`, which embeds the JS bundle. Running it sends no data anywhere; CSP uses \`connect-src 'none'\`. Build reproducibility and licensing need final review before release.

For CI: the pull request's separate insertion PoC smoke workflow creates the output and tests it using ffprobe. The main v0.9.3 standalone, its default runtime, and its existing recording tools are unchanged. No automatic merge.

## Verified proof

Chromium synthetic microphone smoke succeeded on a four-second silent video with approximately 1.94 seconds of independently recorded narration. The exported 5.94-second WebM retained source imagery on both sides of the insertion. See [validation](../../docs/INSERTION_POC_VALIDATION.md) and [CI HTML/video artifact](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38854488665/artifacts/12026996278). Not yet validated on physical phones.

## Original soundtrack acceptance — 2026-10-16

The new [synthetic Chromium test](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38863341916) passes both silent and sound-bearing sources. Its 440 Hz original tone is present before and after an inserted segment but absent during it; the 800 Hz synthetic microphone tone appears only during the inserted segment. The test decodes the saved WebM with ffmpeg/ffprobe, compares original frames before and after the insertion, and verifies no external HTTP requests. [Generated HTML, videos and measurements](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38863341916/artifacts/12030545189). This is not a physical-device or long-recording release gate.
