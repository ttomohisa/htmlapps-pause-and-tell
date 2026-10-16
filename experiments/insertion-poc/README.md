# v0.10.0 — insertion PoC

This is an **isolated experimental proof of concept**, not the default Browser Kitty app or a completed release.

- Opens one short *silent* source video (≤15s, ≤30MiB); rejects sources containing audio instead of silently discarding it.
- Pauses at the chosen source position; captures only microphone audio as a separate Blob and pen strokes as timestamped drawing events. No full-source recording during narration.
- Exports one WebM (VP8 video + Opus audio) whose timeline is the *entire original silent source* with the independently recorded narration and animated markings inserted at that timestamp.
- Uses Mediabunny/WebCodecs offline at export. Source is re-encoded (not lossless); export processing is **not** a real-time recording of the original source.
- The experimental limits prevent memory pressure from a long OfflineAudioContext and BufferTarget. For physical smartphones, file:// support, source-audio preservation, multiple insertions, robust cancellation and multi-minute outputs, this **is not production-ready**.

## Build

From this folder: \`npm install --no-audit --ignore-scripts\`, then \`npm run build\`. The pinned Mediabunny and esbuild versions are build dependencies only. Deliverable: \`dist/index.html\`, which embeds the JS bundle. Running it sends no data anywhere; CSP uses \`connect-src 'none'\`. Build reproducibility and licensing need final review before release.

For CI: the pull request's separate insertion PoC smoke workflow creates the output and tests it using ffprobe. The main v0.9.3 standalone, its default runtime, and its existing recording tools are unchanged. No automatic merge.
