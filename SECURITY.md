# Security Policy

## Supported version

Security fixes target the latest version on the default branch.

## Reporting a vulnerability

Do not publish sensitive vulnerability details in a public issue. Use the repository owner's private security reporting channel when available.

Include:

- Affected commit or version.
- Reproduction steps.
- Expected and actual behavior.
- Security impact.
- A minimal test file when file parsing is involved.

## Trust model

The default template is a static browser application with no backend. Its primary protections are:

- No ordinary runtime CDN/API connection (`connect-src 'none'`). Optional peer-to-peer WebRTC must be explicit in the product specification and must not introduce hidden signaling/STUN/TURN services.
- Explicitly pinned and embedded third-party files.
- Committed `dependencies.lock.json` tarball SHA-256 values verified before embedding.
- SHA-256 records in the generated dependency manifest.
- No analytics, telemetry, remote fonts, or silent update checks.
- User-initiated downloads rather than automatic uploads.

A generated HTML file is executable code. Distribute it through a trusted channel and verify hashes for high-trust workflows.

If an app uses `components/webrtc-qr-pairing.html`, treat the paired browser as an explicit data recipient. “No server upload” does not mean “data never leaves this device.” Keep the manual signaling and `iceServers: []` boundary visible in the UI/help text, and do not silently add STUN/TURN later.

## Pause & Tell v0.8.0 application trust boundary

Pause & Tell is a standalone browser recording app. The user selects a short local video and explicitly enables microphone recording. Video frames, audio tracks and annotations are handled in memory with browser-native APIs and `MediaRecorder`. There is **no app backend, automatic upload, analytics, CDN, remote font, WebRTC or remote API**. The app declares `default-src 'none'`, `connect-src 'none'` and `worker-src 'none'`, with only the local media Blob/data URLs and embedded CSS/JavaScript needed by the single HTML.

- **Download:** a user-clicked `a.download` requests that the browser save the generated video. The app cannot tell whether the OS actually saved it. The in-memory result remains until deliberately discarded.
- **Share:** `navigator.share({files:[File]})` only runs when the user clicks Share and selects an OS destination. That destination **may send the generated file outside this device**. Sharing is not automatic local processing and can transfer data to cloud services or other recipients. Source files and raw microphone streams are not handed to the share picker. Recovery data never exposes Share.
- **Persistence:** only a non-sensitive language preference is stored; source File, microphone tracks, recording chunks and Blob URLs remain in memory until replaced/released. Browser crashes, screen lock and tab termination may irreversibly lose data; partial recovery is best-effort.
- **Audio:** microphone-only is the default. Optional desktop Chromium original-audio mixing is experimental and is not a guarantee for physical devices. Its mixing graph is intended to record without sending original sound to speakers.
- **Scope of claims:** "fully local processing" covers the application's automatic video/microphone processing. It does not mean user-initiated Share cannot transfer an exported file to a destination the user chose.

Physical iPhone Safari, Android Chrome, Windows desktop, direct `file://` microphone operation and NVDA/VoiceOver tests remain pending (G1–G8). Do not advertise cross-device support from static checks or simulated microphone tests.

## Input files

Applications created from this template may parse untrusted local files. Implementations should:

- Validate type, size, and structure before expensive processing.
- Avoid unbounded allocation or recursion.
- Handle malformed data without exposing stack traces to users.
- Release Blob URLs, workers, canvas resources, and large buffers.
- Make destructive transformations reversible where practical.
- Never upload a selected file unless the product explicitly requires it and the user is clearly informed.

## Dependency review

Before adding or upgrading a package:

- Confirm the package identity and exact version.
- Review the scheduled dependency Issue; never treat an available update as an automatic approval to upgrade.
- Review its license and required notices.
- Inspect the browser bundle and package scripts.
- Confirm every runtime support asset is embedded.
- Refresh the selected lock entry with the dependency scripts; never hand-edit a lock hash to bypass a mismatch.
- Rebuild with a clean cache.
- Test with the network disabled.
