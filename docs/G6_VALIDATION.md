# G6 — Recording interruption, recovery and resource lifecycle (v0.6.0)

> **Status: implementation in Draft PR #1. Physical-device G1–G6 acceptance remains PENDING.** Build and Chromium simulation results are not iPhone Safari or Android Chrome certification.

## Goals

- Keep microphone-only recording as the reliable default; do not regress v0.5 experimental mixed audio or v0.4 source/drawing behavior.
- Distinguish **normal verified result** from **partial/recovered or unverified bytes**. A broken or truncated file must never be labeled a successful video.
- Avoid indefinitely waiting for MediaRecorder's terminal `stop` event; bound finalization, clean up tracks, and offer recovery only when actual bytes exist.
- Avoid resource accumulation through repeated takes, source replacement, discarded outputs and interrupted captures.

## Explicit provisional limits (unchanged until real-device verification)

| Limit | Prototype value | Why |
| --- | --- | --- |
| Source video | 30 seconds | Initial compatibility and memory budget |
| Source file | 100 MiB | Reject before decoding large files |
| Output recording duration | 90 seconds | Auto-finalize normal result if output checks pass |
| Accumulated recording chunk bytes | 96 MiB | Request early stop and treat as a partial result |
| Microphone transient mute grace | 3.2 seconds | Avoid aborting on very short mute/unmute events |
| Missing MediaRecorder stop watchdog | 9 seconds | Prevent permanent 'finalizing' UI |

Do not silently expand to target 60s / 250MiB / 180s until G1–G6 physical tests and memory measurements pass.

## Recording states

| State | What user sees | Save behavior |
| --- | --- | --- |
| `preparing` | Source rewind and microphone setup | No save |
| `recording` | Source/output timers, drawing, active mic | No save; file replacement blocked |
| `finalizing` | Status while waiting for final data chunk + stop | No save; replacement/start disabled |
| `result` | Verified decodable first frame and acceptable known duration | Normal preview and save |
| `recovery` (playable) | Interruption/short/timeout warning and playable partial preview | **Save partial** with explicit caution |
| `recovery` (not verifiable) | Error warning, no playable preview, raw recovered bytes only | **Save recovered data**, never claim successful video |
| `ready` after no chunks | Localized error and ability to try again | No save |

The browser's ability to decode metadata/the first frame is not proof that audio is complete. All important saved files still require listening and full playback verification.

## Acceptance matrix

| ID | Scenario | Expected behavior |
| --- | --- | --- |
| G6-01 | 20s local source, mic-only normal start/stop | Valid playable result; never confuse source pause with recorder pause |
| G6-02 | 90s output limit | Auto-stop with limit message, not silently discard data |
| G6-03 | 30s+ source / >100MiB / invalid file | Early rejection with localized reason and ready-to-select state |
| G6-04 | Mic permission denied / absent | No recorder created, localized explanation and retry |
| G6-05 | Mic `ended` while recording | Stop and explicitly label as partial/recovered; terminate all tracks |
| G6-06 | Mic `mute` then `unmute` before 3.2s | Continue without stopping; clear pending mute timer |
| G6-07 | Mic muted longer than 3.2s | Auto-stop with recovery warnings |
| G6-08 | Canvas/video recording track ends | Stop, recover available bytes, do not claim success |
| G6-09 | Source decode error while recording | Stop and recover available bytes with caution |
| G6-10 | Tab becomes hidden while recording | Request stop and recover; warn that browser backgrounding may lose data |
| G6-11 | MediaRecorder emits `error` then `stop` | Mark interrupted, finalize at most once |
| G6-12 | `stop` event never arrives | Timeout after 9s, release capture and attempt recovery |
| G6-13 | `requestData()` or `stop()` throws | Retain any chunks; fall back to onstop/watchdog instead of dropping them |
| G6-14 | Recorder creates no usable bytes (<1024B) | No 'completed' video; return to ready with error |
| G6-15 | Recorder emits nonzero undecodable/unknown-format data | Explicit unverified recovery screen, no playable preview, optional raw download with caution |
| G6-16 | Known duration significantly shorter than recording session (>2.5s) | Recoverable partial state; not normal result |
| G6-17 | Recording chunk safety limit (>96MiB) | Stop early and identify as partial regardless of playback |
| G6-18 | Same input, three consecutive mixed / voice-only takes | No tracks remain live between takes; one recorder/session only; no duplicate mixed-source audio |
| G6-19 | Replace input after result/recovery | Prompt before discarding unsaved data; revoke previous output URLs and reject stale async result |
| G6-20 | Replace input/drop while preparing/recording/finalizing | Do not interrupt or race the active capture |
| G6-21 | Recoverable output -> download -> record again | Result stays until user discards, filename remains editable with correct extension |
| G6-22 | JA / EN, 320/360/390px and short landscape | Warnings distinguish result from partial, mobile footer hidden, no overlap |
| G6-23 | `connect-src 'none'`, standard and self-extract single HTML | No file/mic data is uploaded, generated artifacts preserve template contract |
| G6-24 | iPhone Safari / Android Chrome / Windows Chrome+Edge physical testing | Actual permission, stop, download, audio continuity and native playback measured |

## Validation record template

Capture the exact Git commit, test/browser version and whether source audio is original or simulated; source codec, resolution, duration, recorded duration, output MIME, file size, audio/video tracks, stop reason, final UI phase and active track count. If stopping via a simulated MediaRecorder, mark it as **synthetic/error-path test**, not a real encoder failure.

## G6 gate

**Automated subset** may be judged separately after running the actual CI-built HTML and testing normal, partial and error cases. **Overall G6 remains PENDING** until real physical devices and direct local HTML opening tests are documented. The v0.5 source-audio path remains an opt-in desktop Chromium experiment; leave disabled on unsupported environments and do not promise MP4 everywhere.

### Remaining platform risks

- OS/mobile browsers may suspend the recording process during screen lock, call interruption or background tab; recovery is best-effort only.
- WebM metadata may report an unknown duration. First-frame decoding plus download is not full audio or whole-file verification.
- A `MediaStreamTrack` can remain `live` while actually carrying silence; the browser does not always provide reliable fault signals.
