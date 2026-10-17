# Pause & Tell — Insertion-mode testing policy

**Decision: essential correctness remains non-negotiable; PoC-specific limits and excessive per-commit test coverage do not.** Applies to the isolated insertion experiment only. The shipping app remains on v0.9.3 in the Draft PR.

## 1. Always-required invariants (P0)

1. **No hidden media loss:** All original video intervals remain in chronological order, including those never played during editing. Original audio stays in source intervals; narration replaces it only during inserted explanations. If source audio/codec cannot be decoded, fail visibly; do not silently omit it.
2. **Real decodable output:** Verify a saved file, not just an in-browser progress message. Video and audio must decode, duration must match source plus the actual recorded clip durations within an encoding-aware tolerance; annotations align with their sections.
3. **Local-data privacy:** Input video and microphone must not upload to third-party endpoints; the experiment's CSP must continue to block connections. Explain local temporary storage and abnormal-crash leftovers truthfully.
4. **Edit isolation:** Adding, deleting and rerecording one explanation must not alter the original File or unrelated sections. Keep normal user-facing v0.9.3 functionality unchanged while the insertion experiment is isolated.
5. **Failure/cleanup:** Missing mic permission, unsupported codec, unavailable storage, interrupted recording, or quota pressure must not be called success or automatically erase previously completed explanation segments. Release microphone tracks and temporary resources whenever possible.
6. **Usability:** No horizontal overflow at narrow widths. Actual file-save and recovery paths are a release requirement, not inferred from success banners.

## 2. Required short CI on substantive insertion changes

- One pure time-mapping test suite: empty, one/multiple clips, same-position stable ordering, boundaries and invalid metadata.
- Representative **short** encode/decode cases: silent source with one narrated insert (including memory fallback), source-with-audio and a single insert (OPFS when available), and source-with-audio with two inserts/delete/rerecord. The existing three cases can be consolidated when a smaller suite still covers the P0 invariants.
- Validate original frame samples at beginning and end, audio presence in the correct before/during/after intervals, file duration against actually captured clip lengths, no unexpected HTTP requests or JavaScript exceptions, and result download.
- Avoid exact output byte counts, exact 1.94-second microphone durations, every conceivable input codec/device in CI, and bit-identical decoded pixels after lossy encoding. RGB differences <35, ±0.65-second duration for short browser smoke, and synthetic 440/800 Hz thresholds are test-fixture diagnostics **not product promises**.
- Verify 320px horizontal overflow when UI changes. Test both OPFS and RAM output paths when storage behavior changes.
- A separate check loads an input over the original 15-second PoC cap; this **does not** prove the maximum 5-minute file can be exported.

## 3. Extended tests (not every commit)

Run on performance-related milestones and before expanding user-facing support claims:

- 30s, ~1min, and 3–5min inputs with realistic MP4/WebM codecs, plus high-resolution/portrait/VFR/rotated footage. Observe memory, processing time, seek accuracy, A/V drift and output re-playability.
- Cumulative explanation intervals and late/end-of-source insertions; uneven sample rates, stereo sound and audio at segment boundaries.
- OPFS unsupported/low-quota/full-disk; memory-only fallback, long encoding cancellation, abnormal tab close, and leftover app-owned temporary file cleanup.
- Actual iPhone Safari and Android Chrome microphone, output save/share and independent-player playback. Test only the versions/formats that will actually be advertised as supported; unsupported combinations must be explained.

## 4. Release acceptance versus experimental envelope

- **Experimental attempt bounds:** source ≤5 min and ≤250MiB; one explanation ≤2 min; composed output ≤10 min. These are conservative *policy ceilings*, not evidence of successful export at those sizes.
- **Resource safety:** normal export should prefer local OPFS writing when supported and avoid full-movie PCM allocations; RAM fallback uses a 96MiB encoded-size estimate. These safeguards may reject an output on an unsupported device, with an actionable error. Do not remove memory checks to make a specific test pass.
- **Release GO** requires credible real-device evidence for the formats and platforms claimed as supported, no P0 regressions, privacy/CSP/standalone checks and truthful limitations. A single unsupported browser feature should not automatically block release on every other browser if that feature is clearly detected, disabled and documented.
- Treat physical-device and longer-duration checks as **separate release gates**, not a reason for the short PoC/CI to be permanently blocked. Keep Draft unmerged while those release gates remain open. User alone merges PRs.

Updated 2026-10-17. [PoC validation measurements](INSERTION_POC_VALIDATION.md) · [Design](INSERTION_MODE_DESIGN.md).

## 2026-10-17 opt-in longer-media milestone

[30-second full export PASS](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38936670686), including independently decoded output video tail/source audio/narration and local temporary-file writing. The companion endurance workflow is **opt-in only**: `workflow_dispatch` or a Draft PR title edit containing `[run-endurance]` for a 30-second pre-merge run. Ordinary PR pushes do not run it. The existing shorter CI remains required. Increasing an experimental input-size ceiling alone never qualifies as an endurance pass; only an actually encoded, played-back file counts.

Source replacement after recording independent explanation clips is destructive and therefore must request confirmation; a rejected source file or cancelled replacement must preserve prior recordings. The source soundtrack should be audible during manual preview but must pause before microphone narration is recorded.

## Verified 60s and MP4 milestone (2026-10-17)

- A manually opted-in [60-second source test](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38943079843) produced a 61.22s WebM, retaining original audio/tail footage and independent narration, but this does not prove full 5-minute input/10-minute output envelopes.
- A [30-second H.264/AAC MP4 input](https://github.com/ttomohisa/htmlapps-pause-and-tell/actions/runs/38943039604) produced a 31.22s VP8/Opus WebM on desktop Google Chrome. CI Chromium could not play that H.264 file. This is explicit browser compatibility evidence, not permission to claim universal MP4 support or MP4 output.
- The opt-in endurance workflow accepts format and duration input; explicit Draft title edits `[run-endurance-60]` and `[run-endurance-mp4]` are alternate triggers when manually dispatching cannot target an unmerged branch. Ordinary PR pushes do not run endurance.
- To avoid a false-negative on long WebM indexing, the test now checks actual frame decode sequentially and captures FFmpeg error messages. Actual missing output frames, missing soundtrack, external media transmission and silent failures remain blocking.

## v0.11.4 orientation coverage

- Short PR regression contains **one portrait video case**, asserting width/height, visible canvas aspect and saved-file Pen presence near the expected normalized pointer position. This is a P0 interaction check, but does **not** require every resolution/device per commit.
- Opt-in extended media regression checks a 90° **MP4 display matrix**, original vs output dimensions, saved-file tail video and audio. Rotation metadata must be asserted on the original fixture; an FFmpeg text-only `rotate` tag is not equivalent to a real display matrix.
- Keep physically rotated MOV/HEVC footage, front camera, VFR, non-square sample aspect ratios and device-specific captures for release compatibility gates, not short per-PR smoke.


## v0.11.5 short failure-path regression

`test-resilience.py` injects missing MediaRecorder, unexpected native recorder stop, recorder error and failed re-export into short synthetic desktop-browser flows. It checks preserved explanation state, released microphone tracks, usable retry controls and byte-identical re-download of the previous successful output. These run with ordinary short CI; they do not simulate physical-phone permissions, storage completion, device audio interruptions or actual OS sharing. Existing short media decode checks and v0.9.3 tests remain required; long/VFR/device gates remain opt-in milestones.

## Opt-in codec/VFR probe

See `INSERTION_CODEC_PROBE.md`. Native AVC/AAC feasibility and one short VFR/44.1kHz stereo case live in a separate opt-in workflow. Unsupported codec outcomes are reported explicitly; they are not a product-support pass. Normal short tests keep their existing fixture settings and no extra media encoders are shipped.


## Storage-failure boundary regression (2026-10-17)

The existing short `failed_export` case now covers two errored-write boundaries
(quota-labelled and generic write error), OPFS creation failure and recovery.
The write injection performs a real staged write and deliberately aborts its
native writer before rejecting. It models an already-errored stream; it does not
fill a disk, reproduce an OS quota event, or prove that application cleanup itself
aborts writers. Creation failure uses the existing bounded RAM fallback.

Checks include unchanged previous output URL/metadata/download SHA256, retained
narration, exact OPFS filename baseline after failure, no leaked candidate file,
successful memory fallback and a subsequent OPFS retry. New successful files
must have nonempty media, decoded video and replacement URLs. This extends one
existing routine case; native Windows and long tests are not rerun for this shared
storage transaction.

The initial run exposed an overly specific test expectation: Mediabunny surfaced
`Cannot close a ERRORED writable stream` instead of the injected exception text.
The test now checks the recorded injection and failure UI independently of that
internal wording. The UI gives recovery steps in Japanese/English: save the old
output first, keep the page open, check available storage and retry; do not reload
or clear site data. Full disk, browser eviction, OS termination and physical-phone
storage behavior remain milestone/release gates. No writer leak is claimed.


## Safe selected-explanation rerecording (2026-10-17)

A selected clip can be rerecorded at its original insertion position without
first deleting it. The original audio, frozen frame, pen events, ID and order
remain authoritative until the new audio fully decodes sequentially (30-second
validation deadline) and its preview URL is allocated successfully. PCM chunks
are not retained as a whole-note buffer. New pen events
replace the old ones only on successful completion. Cancel, recorder failure or
background interruption retain the original clip and any previous output. A
successful replacement invalidates the old composition and requires a new export;
newly added clips follow the same result-validity rule.

The existing two-insert saved-media test now uses transactional rerecording rather
than delete-then-record. It retains insertion position and clip ID even if the
source seek position changed. Deletion is checked after saved-file validation.
Existing recorder-failure cases cover rerecord failure, cancellation, background
interruption, injected audio-decoder/preview-URL failure and retry. The existing last-good-output case checks identical saved
bytes after cancellation and invalidation only after a successful replacement.
No native/long test or dependency is added for this editing transaction.
