# v0.11.5 — experimental insertion editor

This is an **isolated experimental proof of concept**, not the default Browser Kitty app or a completed release.

- Accepts source videos up to **5 minutes / 250 MiB** as experimental input limits, with or without an original soundtrack. A high limit is **not a promise** that every input codec, device, or duration will export successfully. Unsupported decoding fails visibly instead of silently dropping an audio track.
- Pauses at selected source positions; captures each microphone narration as a separate Blob and pen strokes as timestamped drawing events. Multiple explanations can be selected, deleted and rerecorded independently. No full-source recording during narration.
- Exports WebM (VP8/Opus), or experimental native MP4 (AVC/AAC, completed output up to 30 seconds), preserving the *entire original video* with multiple inserted explanations in timestamp order (stable at identical timestamps). Original soundtrack plays during original intervals and narration alone during inserted intervals.
- Uses Mediabunny/WebCodecs offline at export. Source is re-encoded (not lossless); export processing is **not** a real-time recording of the original source.
- Audio is rendered and encoded in blocks of up to **2 seconds** rather than allocating one movie-length PCM buffer. Where supported, output is written to a temporary file in browser-local OPFS via Mediabunny StreamTarget; when unavailable it falls back to BufferTarget only within a conservative estimated RAM budget. A normal discard or page exit requests deletion; stale app-owned temporary files older than 24 hours are pruned when possible, but a crash may leave a file. Output is never uploaded.
- Trial maxima: **5-minute source / 250 MiB input; 2 minutes per recorded explanation; 10 minutes total composed WebM / 30 seconds composed MP4.** Actual large-output export, performance and memory survival are not yet proven. Physical smartphone sound preservation, file://, interruption recovery, varied codecs and multi-minute output remain **unverified or unfinished**.

## Try the current Draft

[Choose normal or insertion mode](https://r1418429453-pr-1-bk-previews.ttomohisa.workers.dev/modes/), or
[open the HTTPS insertion editor](https://r1418429453-pr-1-bk-previews.ttomohisa.workers.dev/insertion-poc/).
The normal v0.9.3 app remains at the preview root. This editor is a separate
experiment; it is not a production release.

1. Choose a short video and leave WebM selected, or select experimental MP4 on a
   device with native AVC/AAC encoding support. The page shows the frame-rounded
   completed duration and current format limit before export.
2. Seek to an insertion point, record an explanation and draw, then finish it.
   The live timer separates the 120-second recording cap from the selected output
   format budget; crossing the MP4 budget does not automatically stop recording.
   Repeat at other positions. The whole original video and its soundtrack within the video timeline are
   preserved around explanations, rather than being re-recorded live.
3. Select an explanation to rerecord it safely. The existing clip remains until
   the replacement fully decodes. Cancel or recording failure retains it; a
   successful edit clears an outdated completed export.
4. Compose, play the result, then save/download or use supported OS sharing.
   Reopen the saved file to check the actual result. A save request alone does
   not confirm that the OS stored it.

Recording pauses source/narration/result previews to reduce microphone feedback.
Export cancellation is cooperative: it waits for active processing and cleanup,
keeps editing locked until then, and preserves explanations and the prior output.
Failed exports likewise keep the last successful result available to save.
If a failed export temporary file cannot be deleted, a separate warning remains;
retry checks that candidate cleanup before creating another output. Existing
notes and the previous successful download remain available.
Keep the page open until you have saved your work; reload/close can lose unsaved
clips. Recovery audio, when offered, is explicitly unverified.

### What is established

- Routine synthetic browser tests cover WebM source/narration audio, two insertions,
  portrait Pen output, safe rerecording, failed export retention and storage faults.
- [Windows native MP4 milestone](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/39015497400)
  encoded two insertions from a VFR, 44.1 kHz stereo source. Saved AVC/AAC output
  was independently decoded; detected transitions differed by 0–5 ms with 20 ms windows and 5 ms
  analysis steps. See [measurements](../../docs/NATIVE_MP4_WINDOWS_EVIDENCE.json).
- The owner reported successful short insertion MP4 generation, saving, saved-file
  playback and perceived audio synchronization on one unspecified device/browser.
  This does not establish general iPhone/Android compatibility or long-file drift.
- Physical-phone coverage, OS storage eviction/background behavior, HEVC and the
  full advertised input/output ceilings remain unverified. Native support varies;
  no AAC WASM fallback is distributed.

The sections below retain the dated development evidence. Current detailed results
and remaining gates are in [validation](../../docs/INSERTION_POC_VALIDATION.md).

## Build

From this folder: `npm install --no-audit --ignore-scripts`, then `npm run build`. The pinned Mediabunny and esbuild versions are build dependencies only. Deliverable: `dist/index.html`, which embeds the JS bundle. Running it sends no data anywhere; CSP uses `connect-src 'none'`. Build reproducibility and licensing need final review before release.

For CI: the pull request's separate insertion PoC smoke workflow creates the output and tests it using ffprobe. The main v0.9.3 standalone, its default runtime, and its existing recording tools are unchanged. No automatic merge.

## Verified proof

Chromium synthetic microphone smoke succeeded on a four-second silent video with approximately 1.94 seconds of independently recorded narration. The exported 5.94-second WebM retained source imagery on both sides of the insertion. See [validation](../../docs/INSERTION_POC_VALIDATION.md) and [CI HTML/video artifact](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38854488665/artifacts/12026996278). This historical test did not validate physical phones.

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

## v0.11.4: vertical and metadata-rotated sources — 2026-10-17

- **[Portrait 180×320 VP8/Opus source, narration and Pen → 180×320 WebM PASS](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38951138278)**. The app now sizes the visible annotation canvas to the source's aspect ratio, eliminating invisible letterbox areas that caused touch position mismatch on narrow phone-shaped stages. The test checks CSS drawing-canvas dimensions, decoded output dimensions, correct before/inside/after audio and a pixel region containing a drawn Pen line **in the saved inserted video**, not only the browser preview.
- **[90-degree display-matrix H.264/AAC MP4 → portrait 180×320 WebM PASS](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38950823277)** on desktop Google Chrome. Generated a 320×180 pixel MP4 with an actual 90° display matrix; the saved WebM is 180×320, lasting 31.14 seconds from 30 seconds of source plus independent narration. Source-tail frame mean RGB difference 11.367 (lossy encoding), original audio and explanation audio isolated to their sections, no external requests/errors.
- Rotated-source acceptance requires the **actual MP4 track display matrix**; setting a legacy plain `rotate` metadata tag in an FFmpeg remux did not create it. The test fixture now uses `-display_rotation 90` and independently verifies the matrix before checking output.
- [Saved 30-second rotated MP4 and output WebM](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38950823277/artifacts/12068911322) · [portrait output WebM and screenshots](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38951138278/artifacts/12069241050).

These are **synthetic desktop browser acceptance tests only**; real iPhone video capture, iOS Safari/Android save, variable frame rate, HEVC, wider media formats, long portrait exports and device behavior remain unverified. No changes to the default v0.9.3 app; Draft remains unmerged.


### v0.11.5 compatibility preparation

The page reports recording and WebM encoding capabilities before narration. MP4/AAC **audio** may be selected for the microphone when WebM is unavailable; composed **video** defaults to WebM, with a separate experimental native AVC/AAC MP4 option. Broad phone support is not yet verified. Interrupted audio can be saved separately as unverified recovery data. Previously completed explanations and a prior successful export survive failed retries. Download names are editable and file sharing appears only when supported. Save/share cancellation keeps the result; a browser save request does not prove the file reached device storage. Reload or closing the page can still lose unsaved work.

### HTTPS Draft preview

The PR preview workflow publishes this experimental standalone page at
`/insertion-poc/` under the existing PR preview origin, separately from the normal
app at `/`. The PR bot comment provides both links. This route is built only by
the nonproduction preview workflow, includes `noindex,nofollow`, and contains no
test media or user data. Production deployment is unchanged. Phone microphone,
codec availability and OS save/share still require a broader physical-device matrix;
a successful HTTPS load alone is not a device test pass.

### Native codec candidate check on a phone

On the HTTPS PoC, open **端末のMP4候補を確認（生成しません）** and tap
**候補を確認** (English: **Check native MP4 candidates (no encoding)** →
**Check candidates**). It shows Native AVC and Native AAC separately. A screenshot
of those two statuses is enough for a first compatibility report; no media file,
microphone permission or actual encode is needed. The exact queried configuration
is shown. “Candidate available” is not proof of recording, MP4 muxing, sync or OS
saving, and does not enable an MP4 export option. Queries use native WebCodecs
isConfigSupported only, with a five-second timeout; no fallback/WASM is loaded.

### Native-only synthetic MP4 test (Draft preview)

Open `/insertion-poc/native-mp4/` on the PR preview. Tap **合成2秒を生成**; no file or microphone is needed. A successful result exposes playback and a separate **生成したMP4を保存** link. Lower the volume before playback: the first second is red/silent; the second is green with stereo tones. Report the result text and, if available, device/OS/browser. Generation, playback and saving/reopening are separate checks. This diagnostic does not enable MP4 output in the insertion app. Failed regeneration keeps the previous result until the page closes.

### Experimental native MP4 insertion

WebM remains the default. Select **MP4 AVC/AAC (実験 / experimental)** only to try native encoders; completed MP4 output is limited to 30 seconds. If the device cannot encode AVC and AAC at the actual output dimensions, recording/export are disabled for that selection. Return to WebM without losing existing explanations or the previous output. The successful result determines its filename and MIME even after changing the selector. No WASM fallback is included. Owner-reported native 2-second generation/playback/save succeeded on one unspecified device; the owner also confirmed short insertion MP4 saved-file playback and perceived sync. Device/OS/browser versions were not supplied; broader compatibility remains under evaluation.

### Separate mode entry (preview only)

The nonproduction preview has a bilingual `/modes/` guide. It links to the normal
root and insertion editor in separate tabs with `noopener noreferrer`; edits are
not transferred. The served PoC gains a link back to the guide only during preview
staging. Standalone HTML, including copies hosted elsewhere, has no relative mode
link. The normal application's generated bytes are checked unchanged. Production
publishing and the normal application's source remain unchanged.
