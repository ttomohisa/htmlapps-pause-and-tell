# G2 — Basic recording workflow validation (v0.2.0)

> Status: **implementation in Draft PR; G1 physical-device verification and G2 sign-off are pending**.
> v0.2.0 UI work was approved to proceed, but a passing template build or headless desktop smoke test is not a mobile compatibility guarantee.

## User flow / expected states

| State | Stage | User-facing behavior |
| --- | --- | --- |
| `empty` | 1. Choose video | Local file picker and desktop drop zone, no microphone request |
| `loading` | 1. Choose video | Visible loading message; replacing input discards stale async source results |
| `error` | 1. Choose video | Localized file/decode/duration error; can choose a new source |
| `ready` | 2. Record explanation | Video and metadata, source seek, two clocks, mic permission explanation |
| `preparing` | 2. Record explanation | Microphone requested only by explicit record click; repeat clicks disabled |
| `recording` | 2. Record explanation | Independent source play/pause; output and mic clocks advance continuously |
| `finalizing` | 2. Record explanation | All recording buttons disabled until data is verified |
| `result` | 3. Save video | Playable output preview, editable filename, actual container extension, rerun or replace source |

## Automated UI checks to perform

1. Open a built `dist/index.html` with a fresh profile. Confirm no starter text, intro privacy badge reads **完全ローカル処理** / **Fully local processing**, and stages highlight 1/2/3 as progress changes.
2. Header language toggle shows `EN` in Japanese mode and `JA` in English mode. Switch both ways with no lost file or recording state.
3. Open **使い方と注意事項** from the middle/bottom of the page. While it is open, attempts to scroll the background via wheel, touch or keyboard must not move the underlying page. The dialog body can still scroll to its last help item on a narrow, short screen. Escape/backdrop/close button each restores the prior document scroll position.
4. At 320/360/390/768/1280px widths, confirm there is no horizontal page scroll. Footer must be absent on mobile (portrait and short landscape) but present on desktop.
5. Load a browser-decodable short landscape then portrait clip. Verify loaded filename, duration and dimensions remain shown in the **recording** stage; preview/source seek behave before recording.
6. Deny microphone permission, then retry if the browser allows. Verify non-destructive localized error and that there is no unexpected active stream.
7. Start recording; confirm any source seek is disabled. Pause source for several seconds and watch only the output clock advance. Ensure recorder does not stop at source end.
8. Stop recording, confirm a preview exists only for non-empty readable output; preview and downloaded output both play through, with filename and extension matching actual output MIME.
9. Start again: unsaved output requires a clear discard confirmation and Cancel preserves the result. Replacing a file clears the prior result and no old async callback makes it reappear.
10. Simulate a screen/tab interruption. If an output is produced, it must carry an **interruption warning**, not be silently reported as a normal success.
11. Check canonical favicon and header brand icon use **exactly the same supplied SVG**, and the generated normal and self-extracting HTML share the icon.
12. Inspect `connect-src 'none'`, run without external network and verify no runtime CDN/upload/telemetry access. Verify both generated HTML variants; `file://` microphone permissions may vary by browser.

## G2 acceptance

- [ ] New user completes choose → mic prompt → play/pause → stop → review → download without explanation.
- [ ] Source pause and output recording are unmistakably separate.
- [ ] Source ends without ending output; final frozen frame and microphone continue.
- [ ] Source replacement does not resurrect stale callbacks or outputs.
- [ ] Both languages, mobile layout, Help scroll freeze, icon and privacy label pass.
- [ ] Real physical iPhone Safari and Android Chrome G1 tests are documented (still blocking for release).

## Known unverified / deferred features

- Circles, arrows, pen or tap highlights are **v0.3.0+**, not part of v0.2.0.
- Mixing original video audio with microphone is conditional v0.5.0 work.
- iPhone/Android recording permission, direct `file://` microphone behavior and saved-video player interoperability still require physical-device testing.
- Automatic G2 testing in CI checks structural and packaging invariants; it is not equivalent to real audio/video G1 validation.

## Headless smoke evidence — 2026-10-14

Automated Chromium UI smoke exercised the **actual GitHub Actions generated `dist/index.html`**, loaded into an isolated Playwright page, with a simulated Web Audio oscillator as the microphone. It did not exercise native microphone permission prompts.

| Scenario | Observation |
| --- | --- |
| User icon | 1,933-byte supplied SVG is an **exact byte match** for both generated favicon and header image |
| Widths 320 / 360 / 390 / 768 / 1280px | No horizontal overflow. Footer hidden at 320/360/390 and visible on desktop widths |
| 844×390px touch/coarse landscape | Footer hidden; Help remains vertically scrollable |
| Language switching | Japanese mode button `EN`; English mode button `JA`; badge displays `完全ローカル処理` / `Fully local processing` |
| Help open/close | Background body becomes fixed, remains stationary on wheel scrolling; inner dialog content scrolls; Close/Escape restore the previous scroll position |
| Input/record/result | Source file metadata shown in stage 2; source seeking disabled during recording; stage advances to result; downloadable file created |
| Saved output | WebM with video **VP8** (640×360) and audio **Opus**; decoded codec streams confirmed with `ffprobe` |
| Invalid input | Empty/invalid video rejected with localized message; stage returns to step 1 |
| Console / network | No JavaScript page errors and no external requests (only local `blob:` URLs) |

**Not tested here:** real touch gesture at browser OS level, hardware mic grant/revoke, Safari/iOS and Android recording, real device lock/call interruption, direct `file://` media permission, playback in third-party native players. G1 and physical-device G2 acceptance stay **open**.
