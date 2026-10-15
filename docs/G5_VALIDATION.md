# G5 — Original video audio + narration (v0.5.0 experimental)

**Gate status: PENDING physical-device verification.** The v0.5 implementation exposes an opt-in, desktop-Chromium-only experiment. The default microphone-only mode remains unchanged. Do not advertise original-audio mixing as a validated mobile or v1.0.0 feature.

## Product contract / differences

- **Default:** `Voice only / 説明音声のみ`. The existing direct microphone audio track is captured with the video Canvas. Source video stays muted.
- **Experimental (desktop Chromium only):** `Source sound + voice`. It is disabled on mobile, iOS, desktop Safari and Firefox until there is device-specific evidence. Device detection is a *conservative access gate*, not a claim that every desktop Chromium device works.
- Source sound gain presets are 15%, 30% (**default**) and 50%; microphone is 100%. A zero-input/silent original video will not gain audio artificially.
- **No speaker monitoring:** Source video goes to a `MediaElementAudioSourceNode`, source and microphone go through separate `GainNode` branches into `createMediaStreamDestination()`. Only that audio track + Canvas video go to `MediaRecorder`. Neither branch connects to `AudioContext.destination`; no automatic file upload/remote API.
- Source pause halts **source audio** while **narration and Canvas capture continue**. Source end likewise continues narration/recording until the user stops.
- Creating `MediaElementAudioSourceNode` binds the one video element to the audio context. The mixer therefore disconnects capture nodes and suspends the context after each take, then reuses the context/source node for another take or source replacement. It closes the context on page unload. This avoids attempting a second `createMediaElementSource` for the same video element.
- If activation/routing fails, **stop start-up and show a localized error**, rather than silently changing a requested mixed take into voice-only.
- Successful output shows the selected audio mode and gain, but users still need to verify **actual saved video and audio**.

## Verification fixtures

Prefer a 12-second **local video with a continuous 440 Hz source tone**, plus a synthetic 880 Hz microphone tone in automated browser tests. Do not send source files to remote services.

Example FFmpeg command (local development, *not* an app runtime requirement):

```bash
ffmpeg -f lavfi -i "testsrc2=size=640x360:rate=30" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000" \
  -t 12 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k source-audio-440hz.mp4
```

Simulated microphone: an oscillator generating 880 Hz via `AudioContext.createMediaStreamDestination()`, returned by a test-only `getUserMedia` shim. This **does not test a hardware microphone**. Do not ship a microphone shim in production.

## Acceptance matrix

| ID | Steps | Expected / metric |
| --- | --- | --- |
| G5-01 | Load a file and inspect Audio options | Voice-only selected; mixer remains opt-in/collapsed |
| G5-02 | Desktop Chromium vs Safari/Firefox/Android/iPhone | Experimental option enabled **only** on desktop Chromium with required APIs; otherwise disabled |
| G5-03 | Record with Voice only, original audio present | Output has 880 Hz narration; no 440 Hz source tone |
| G5-04 | Select source+voice at 30%, record while source plays | Saved audio contains measurable 440 Hz and 880 Hz components |
| G5-05 | Pause source for several seconds; keep speaking | 440 Hz component absent/strongly attenuated; 880 Hz continues without interruption |
| G5-06 | Resume source, finish and play result | Original tone resumes only after source playback restarts; exported length matches recording session |
| G5-07 | Test gains 15%/30%/50% | 440 Hz relative RMS rises while mic gain remains fixed, without clipping |
| G5-08 | No user file with source-audio track | Mic-only narration remains; missing original audio does not crash the session |
| G5-09 | Re-record mixed → mixed, mixed → voice, voice → mixed | No duplicate nodes/double audio, recorder overlap, active mic leaks or silence |
| G5-10 | Denied mic permission, failed Web Audio activation, unsupported browser | Localized failure; no false success and no unintended speaker sound |
| G5-11 | Check JA/EN and result metadata | Mode, gain, failure and experimental warnings localized |
| G5-12 | Phone and short mobile viewports (320/360/390, 844×390) | No overflow, transport/help still usable, unsupported mixer not selectable |
| G5-13 | Measure output with ffprobe or trusted audio analysis | Correct audio codec/tracks, duration, source-vs-mic temporal segments |
| G5-14 | Network capture / CSP / standalone file | No runtime CDN/API/upload, `connect-src 'none'`; direct `file://` checked separately |
| G5-15 | Physical iPhone Safari and Android Chrome | Voice-only G1–G4 must pass; mixing remains hidden until independently verified |


## Automated Chromium proof (2026-10-15; **not** a G5 release pass)

Tested exact GitHub Actions standalone HTML from commit `6cb164795d18613a6cadc9fc39e388f1765d2b19` in **headless Linux Chromium 144**. Generated local H.264/AAC source clip contains 440 Hz sine; injected WebAudio-simulated microphone emits 880 Hz (not a real microphone). The final recording files contain VP8 video and Opus 48kHz audio. The runtime opened the HTML with Playwright `page.set_content`, **not** `file://` (direct local navigation is blocked by the test environment).

| Recording window (1 s) | Measured 440 Hz source amplitude | Measured 880 Hz simulated mic amplitude |
| --- | ---: | ---: |
| Mix at 30%, source playing (0.6–1.6s) | 0.0530882 | 0.2262205 |
| Same mix, source paused (3.0–4.0s) | 0.0000015 | 0.2264438 |
| Same mix, source resumed (5.6–6.6s) | 0.0529405 | 0.2261968 |
| Microphone-only take, source playing | 0.0000028 | 0.2252034 |
| Mix at 50%, source playing | 0.0883236 | 0.2256270 |

The source gain ratio 50%/30% was **1.664×**, near the requested 1.667×. During the source pause, the original-tone amplitude fell below 0.003% of the playing segment while simulated microphone remained continuous. Measured by sine/cosine amplitude fitting against 48kHz decoded PCM, not loudness or device compatibility.

Additional checks:

- **Repeat-take regression:** mix → voice-only → mix, all three saved as WebM, with zero page JavaScript errors.
- **Source replacement:** replace 440 Hz file with a 550 Hz file after earlier takes; next mixed output measured 550 Hz = 0.088533, old 440 Hz ≈ 0.000053, simulated mic 880 Hz ≈ 0.225811. No stale prior audio detected.
- **No original audio track:** 5-second silent-source video still records the simulated microphone in mixed mode without an exception.
- **Denied microphone:** localized permission error, return to Ready, no false recording success.
- **Conservative UI gate:** desktop Chromium experiment selectable; simulated Android Chrome, iPhone Safari and desktop Firefox user agents disabled mix mode while retaining Voice only. No horizontal overflow in 360/390px simulated mobile viewports.

**Limits:** no actual iPhone/Android, Windows desktop browser, device microphone, physical speaker monitoring, hardware mute, OS-level interruptions, native playback or direct `file://` test was performed. G5 automated-prototype requirements G5-03/04/05/06/07/08/09/10 are partially supported, but **overall G5 remains PENDING**. G1–G4 physical gates remain outstanding.

## Gate decision

- G5 can be **automated-prototype PASS** only with objective *decoded output audio* showing source sound playing + narration together, source sound stopping during source pause, narration staying present and gains being distinguishable.
- **Overall G5 remains PENDING** without required real desktop/phone tests. No claim that an experimental UI option constitutes supported mobile behavior.
- If physical desktop Chromium testing is unreliable, do not enable the mixed option for public release; v1.0.0 may remain voice-only per DEVELOPMENT_PLAN.md.

## Recording architecture note

```text
Local video element -> MediaElementAudioSourceNode -> Gain(0.15/0.30/0.50) --+
                                                                              -> MediaStreamAudioDestination -> audio track --+
Local microphone -> MediaStreamAudioSourceNode -> Gain(1.00) -----------------+                                               |
Canvas video -------------------------------------------------------------------------------> video track ------------------+ -> MediaRecorder
```

No node connects to device audio output, and all mixing takes place in the browser.
