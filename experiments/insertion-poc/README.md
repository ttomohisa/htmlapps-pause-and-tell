# v0.11.3 — MP4 input and 60-second media verification

This is an **isolated experimental proof of concept**, not the default Browser Kitty app or a completed release.

- Accepts source videos up to **5 minutes / 250 MiB** as experimental input limits, with or without an original soundtrack. A high limit is **not a promise** that every input codec, device, or duration will export successfully. Unsupported decoding fails visibly instead of silently dropping an audio track.
- Pauses at selected source positions; captures each microphone narration as a separate Blob and pen strokes as timestamped drawing events. Multiple explanations can be selected, deleted and rerecorded independently. No full-source recording during narration.
- Exports a WebM (VP8/Opus) preserving the *entire original video* with multiple inserted explanations in timestamp order (stable at identical timestamps). Original soundtrack plays during original intervals and narration alone during inserted intervals.
- Uses Mediabunny/WebCodecs offline at export. Source is re-encoded (not lossless); export processing is **not** a real-time recording of the original source.
- Audio is rendered and encoded in blocks of up to **2 seconds** rather than allocating one movie-length PCM buffer. Where supported, output WebM is written to a temporary file in browser-local OPFS via Mediabunny StreamTarget; when unavailable it falls back to BufferTarget only within a conservative estimated RAM budget. A normal discard or page exit requests deletion; stale app-owned temporary files older than 24 hours are pruned when possible, but a crash may leave a file. Output is never uploaded.
- Trial maxima: **5-minute source / 250 MiB input; 2 minutes per recorded explanation; 10 minutes total composed video.** Actual large-output export, performance and memory survival are not yet proven. Physical smartphone sound preservation, file://, interruption recovery, varied codecs and multi-minute output remain **unverified or unfinished**.

## Build

From this folder: `npm install --no-audit --ignore-scripts`, then `npm run build`. The pinned Mediabunny and esbuild versions are build dependencies only. Deliverable: `dist/index.html`, which embeds the JS bundle. Running it sends no data anywhere; CSP uses `connect-src 'none'`. Build reproducibility and licensing need final review before release.

For CI: the pull request's separate insertion PoC smoke workflow creates the output and tests it using ffprobe. The main v0.9.3 standalone, its default runtime, and its existing recording tools are unchanged. No automatic merge.

## Verified proof

Chromium synthetic microphone smoke succeeded on a four-second silent video with approximately 1.94 seconds of independently recorded narration. The exported 5.94-second WebM retained source imagery on both sides of the insertion. See [validation](../../docs/INSERTION_POC_VALIDATION.md) and [CI HTML/video artifact](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38854488665/artifacts/12026996278). Not yet validated on physical phones.

## Original soundtrack acceptance — 2026-10-16

The new [synthetic Chromium test](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38863341916) passes both silent and sound-bearing sources. Its 440 Hz original tone is present before and after an inserted segment but absent during it; the 800 Hz synthetic microphone tone appears only during the inserted segment. The test decodes the saved WebM with ffmpeg/ffprobe, compares original frames before and after the insertion, and verifies no external HTTP requests. [Generated HTML, videos and measurements](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38863341916/artifacts/12030545189). This is not a physical-device or long-recording release gate.

## Multiple explanations acceptance — 2026-10-16

[CI run 38864515775](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38864515775) validated two independent clips at source time 2s and 3s. The second clip was deleted and rerecorded before export, producing a **6.74s VP8/Opus WebM** from a 4s source containing original 440 Hz audio. Measured 440 Hz remained audible before/between/after inserted clips, and the 800 Hz synthetic microphone sounded only inside explanations. The source still appears at the head/tail of the output; a pure Node timeline test also checks two clips, equal timestamps and source boundaries. [Generated HTML, multi-clip WebM, screenshots and reports](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38864515775/artifacts/12030473749). Do not treat these synthetic tests as mobile device acceptance.

## Test conditions and workload

Tests are tiered, not all-or-nothing on every change. See [test policy](../../docs/INSERTION_TEST_POLICY.md). Pull-request smoke uses small video fixtures to catch missing frames/audio, no external data transfers, save failures and memory/temporary-file fallback. The 5-minute/250MiB and 10-minute limits are *user-visible experimental ceilings*, **not mandatory CI fixture lengths** or accepted real-device performance claims.

[First bounded-export + OPFS/fallback regression PASS](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38933128931) tested a 20-second source file loading successfully, in-memory fallback, streamed local temporary-file output, source audio/narration switching and two explanations. Full-length footage and real smartphones remain outstanding.

## v0.11.2 milestone: real 30-second export

- [Opt-in endurance run 38936670686](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38936670686) **PASS**: generated a moving 30.00-second VP8/Opus original and independently recorded about 1.22 seconds of narration and Pen events, then exported **31.22 seconds** VP8/Opus WebM entirely inside Chromium. Original tail video and soundtrack plus narration-only inserted interval were decoded and verified. Output was created through browser-local temporary storage; no external requests or page JavaScript errors.
- [Download generated original/finished WebMs, screenshot, self-contained HTML and report](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38936670686/artifacts/12061556814). This checks one **30-second** source, NOT the advertised trial ceiling of five-minute source / ten-minute final video, and not physical Safari or Android devices.
- The [extended workflow](../../.github/workflows/insertion-endurance.yml) is **opt-in only**: via `workflow_dispatch` where available, or before merge by temporarily adding `[run-endurance-60]` or `[run-endurance-mp4]` to the Draft PR title and saving it. Remove the tag afterward. Ordinary PR pushes never perform endurance work. Manual dispatch supports 30 / 60 / 180 seconds and WebM or MP4. The title tags specifically run 60-second WebM or 30-second MP4. No monitoring or recurring work is scheduled.
- Replacing the source after narration now asks for confirmation, and cancelling keeps the clips. An invalid replacement file is rejected without erasing the existing clips; if video preview loading fails, the previous preview is restored. When playing the source for editing, the original soundtrack is audible; the source pauses before narration capture starts.

## v0.11.3: 60-second source + H.264/AAC MP4 input — verified 2026-10-17

- [60s VP8/Opus WebM source → 61.22s WebM PASS](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38943079843) on Linux Chromium with synthetic microphone. Measured source tail frame error 2.188 (mean RGB absolute difference), preserved 440Hz source soundtrack around 800Hz narration, no outside HTTP requests, and browser-local StreamTarget output. [Actual videos and test report](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38943079843/artifacts/12063569028).
- [30s H.264/AAC MP4 source → 31.22s VP8/Opus WebM PASS](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38943039604) on **Google Chrome**, with source soundtrack and inserted voice both verified by decoding saved output. Mean source-tail RGB difference 11.361 (lossy re-encoding is expected); no page error or outbound media-data request. [Actual MP4, WebM and report](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38943039604/artifacts/12063813211).
- Ubuntu CI **Chromium** could not load the same H.264 MP4, while the runner's **Google Chrome** did. Format support depends on the browser's codecs. The app now displays a localized explanation when the browser reports unsupported media; it does not pretend that all MP4 files are supported.
- FFmpeg verification of the 60s output initially failed during a random seek into the WebM. With a sequential decode through the requested frame and bounded FFmpeg test threads, the same 60s workflow passed. This addresses the **test-side seeking/decoding method** and is not evidence that all possible long WebMs/players are compatible. Test errors now expose FFmpeg stderr.
- The experimental input/file limit of 5m/250MiB remains an **attempt ceiling**, not a validated 5m export. A physical Android Chrome and iPhone Safari device matrix is still pending.

No changes to the default v0.9.3 continuous recording application, and no Browser Kitty main-repository changes. Draft/no merge.
