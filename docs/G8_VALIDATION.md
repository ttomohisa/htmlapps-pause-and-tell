# G8 — Standalone, privacy and accessibility verification (v0.8.0)

> **Status: implementation and testing in Draft PR #1; G1–G8 physical-device release gates are still PENDING.**
> Green CI, a Chromium smoke result and a valid HTML build do not prove iPhone/Android compatibility or real screen-reader quality.

## Build and privacy contract

- Source of truth: latest `ttomohisa/htmlapps-template` checked when implementation begins, plus the current Pause & Tell repo; keep `AGENTS.md`, `app.config.json`, build scripts and template-generated metadata intact.
- Generate **`dist/index.html`** (readable one-file release), **`dist/index.self-extract.html`** (gzip native loader) and **`pause-and-tell.html`** (byte-for-byte readable root copy). Never modify generated HTML manually.
- `assets/favicon.svg` is the only icon source for both favicon and header; verify embedded data URIs match exactly in both release variants.
- No third-party runtime dependencies. Only browser File/Blob/canvas/microphone/MediaRecorder/Web Audio/Web Share APIs; no CDN, analytics, external font, remote API, network-enabled Worker, STUN, or upload.
- Strict CSP: `default-src 'none'`, `connect-src 'none'`, `worker-src 'none'`; allow only the necessary inline script/style and local Blob/data media/icon paths. **Test the actual built HTML in a browser** after tightening directives; static string checks alone are insufficient.
- Selected media and microphone audio stay in memory on the current device. Local settings store **language only**. User-initiated Download saves the generated file locally. **Explicit OS Share can transfer the generated file to a recipient/app outside this device**; disclose this separately from automatic processing.
- `file://` and HTTPS microphone permissions must be tested *separately on real devices*. Browser test harnesses may prohibit direct `file://` navigation; record that as **NOT TESTED**, not as application failure.
- Inspect `SecurityPolicyViolationEvent`, browser request log and storage/state. No external network fetch/XHR, script/link/icon/worker or media loading from the app. Report CSP violations or browser-specific restrictions, if any.

## Accessibility contract

- Skip link to the application, proper document language (`ja`/`en`) and programmatically focusable target.
- Video selection and result transitions move keyboard focus to the current section heading without unexpectedly scrolling the visual viewport; status text announces major phase changes to screen readers.
- The four drawing modes have labelled SVG buttons and `aria-pressed` state; 3 color choices have localized accessible names.
- **Keyboard Point mode:** select Point, Tab to the video, use arrow keys to move a visible cursor in normalized coordinates (5% steps; Shift+arrow 1%), Enter/Space places an outlined marker on the actual Canvas. The output file captures the marker but not the keyboard-cursor overlay. Drawing Circle/Arrow/Pen traces still require pointer/touch/stylus and are documented as such.
- Space play/pause shortcut must not trigger while the keyboard Point stage, a dialog, a button, a file/name input, a select or another form control has focus.
- Announce source and output status without making the 100ms timer an `aria-live` region. Seek slider exposes a readable source-time value. The result/recovery title and warnings are distinguishable.
- Help is a native dialog: focus trapped by browser, Esc and Close restore background scroll/focus; inner help scroll remains available on short phone-height layouts.
- Primary controls have keyboard-visible focus and minimum 44px touch targets; widths 320/360/390px, short landscape and desktop have no horizontal overflow or fixed-bottom-bar occlusion.
- Test with reduced-motion CSS enabled, 200% text zoom, color contrast and JA/EN transitions. **NVDA and VoiceOver must still be checked by a human on physical devices.**

## G8 test matrix

| ID | Scenario | Expected |
| --- | --- | --- |
| G8-01 | Build template/repo preflight and all three output paths | CI green; readable/root byte-identical and gzip loader decodes correctly |
| G8-02 | Verify canonical favicon/header and self-extract icon | Embedded SVG bytes identical to `assets/favicon.svg` |
| G8-03 | Inspect generated strict CSP | No ordinary runtime network, remote script, external font or Worker |
| G8-04 | Run core voice-only record/pause/finish/download with network blocked | Playable local MP4 or WebM with mic audio and frozen frames |
| G8-05 | Run source+voice experimental mode on desktop Chromium with fixture | No regression in tested setup; off on unsupported browsers |
| G8-06 | Check Storage API before/after recording | Only language setting is persistent; no media data written |
| G8-07 | Read app both JA and EN | Missing/mismatched translation keys rejected or documented |
| G8-08 | Keyboard-only Choose → Record → Play/Pause → Finish → Review → Download | Reachable buttons, progress and focus never hidden |
| G8-09 | Keyboard Point arrows and Enter/Space | Cursor moves; output Canvas receives normalized ring; Space does **not** unexpectedly play source |
| G8-10 | Pointer ellipse/arrow/pen after keyboard Point | Existing recording overlay and touch gestures continue to work |
| G8-11 | Pause source mid-recording with status announcements | Source timer stops; recording timer advances; no excessive 100ms live announcements |
| G8-12 | Help open/Esc/Close at midpage on narrow phone | Backdrop/body fixed, inner content scrollable, focus restored |
| G8-13 | Recovery/unverified result | Assertive warning, no Share, no false completed-file claim |
| G8-14 | Download/Share statuses and filename after language switch | Localized result preserved; no unsaved data loss on Cancel |
| G8-15 | 320/360/390/844×390 + desktop viewport, reduced motion | No horizontal scrolling/occlusion, keyboard focus visible |
| G8-16 | Physical Windows Chrome/Edge, Android Chrome, iPhone Safari HTTPS | Real mic permissions, touch, downloaded file playback, native file share |
| G8-17 | Real `file://` HTML / self-extract on all required OS | No missing assets; permissions/CSP/runtimes clearly documented |
| G8-18 | Physical NVDA + VoiceOver read-through | Sensible language labels, focus order, announcements and dialog behavior |

## Evidence reporting

Record exact commit SHA, file variant, device / OS / browser version, input codec and dimensions, output actual MIME/size/duration, console errors, CSP violations, HTTP request attempts, language and viewport, keyboard path/focus and whether audio is simulated. Distinguish:
- **source-level/static** inspections,
- **real browser headless** tests with synthetic microphone,
- **real hardware** permission, media and screen-reader testing.

Only headless/CI subset can be called automated-pass. **Overall G8 is PENDING** until required physical device checks pass. The v0.5 desktop Chromium audio mix remains opt-in experimental; do not claim MP4-only export or all-browser file sharing.

## Known scope limits

No cloud backup, editing history, microphone recovery after browser termination, forced download completion confirmation or automatic upload is implemented. Correct playback in native players is not guaranteed until recorded on actual devices. A keyboard Point marker is supported, but full freehand drawing requires a mouse, pen or touch.

Screenshots for final release must show the actual JA/EN app at current UI and be updated before v1.0.0; avoid reusing template screenshots.
