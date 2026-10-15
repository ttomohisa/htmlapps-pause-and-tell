$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$source = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "src\index.template.html")
$config = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "app.config.json") | ConvertFrom-Json
$spec = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "APP_SPEC.md")
$plan = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "DEVELOPMENT_PLAN.md")
$readme = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "README.md")
$readmeJa = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "README.ja.md")

if ([string]$config.name -ne "Pause & Tell") { throw "Pause & Tell name mismatch." }
if ([string]$config.slug -ne "pause-and-tell") { throw "Pause & Tell slug mismatch." }
if ([string]$config.version -ne "0.5.0") { throw "Unexpected Pause & Tell POC version." }
if ([string]$config.repository.owner -ne "ttomohisa" -or [string]$config.repository.name -ne "htmlapps-pause-and-tell") {
  throw "Pause & Tell repository metadata mismatch."
}
if ($config.build.blockRuntimeNetwork -ne $true) { throw "Pause & Tell must block runtime network." }

$requiredTokens = @(
  'id="ptAudioOptions"',
  'id="ptAudioMode"',
  'id="ptSourceGain"',
  'id="ptAudioHint"',
  'id="ptMixWarning"',
  'audioVoiceOnly',
  'audioMixed',
  'audioMixFailed',
  'audioResultMixed',
  'sourceMixAvailable',
  'function activateAudioMix()',
  'function createMixedAudioTrack(',
  'function disconnectAudioMixSession()',
  'context.createMediaStreamDestination()',
  'context.createMediaStreamSource(microphone)',
  'audioMix.sourceNode.connect(audioMix.sourceGain)',
  'audioMix.micNode.connect(audioMix.micGain)',
  'audioMix.context.resume()',
  'sourceVideo.muted=false',
  'selectedAudioMode()',
  'id="ptDrawSurface"',
  'id="ptDrawUndo"',
  'id="ptDrawClear"',
  'data-draw-tool="point"',
  'id="ptTransport"',
  'id="ptStageStatus"',
  'toolPoint',
  'MAX_VISIBLE_STROKES',
  'state.phase',
  'function refreshStageStatus()',
  'function focusWorkflowSection(',
  "focusWorkflowSection('.pt-draw-panel')",
  "focusWorkflowSection('#ptResultPanel')",
  "stroke.tool === 'point'",
  "if (drawing.tool==='point')",
  "drawing.strokes.push(stroke)",
  "window.matchMedia('(max-width: 767px)",
  'env(safe-area-inset-bottom)',
  'body:has(#ptStudioPanel:not([hidden]))',
  'data-draw-tool="ellipse"',
  'data-draw-tool="arrow"',
  'data-draw-tool="pen"',
  'data-draw-color="yellow"',
  'data-draw-color="white"',
  'data-draw-color="red"',
  'function pointerToVideo(',
  'function paintStroke(',
  'function clearDrawing(',
  'function finishStroke(',
  'function updateDrawingControls(',
  'sourceVideo.addEventListener(''play''',
  "drawSurface.addEventListener('pointerdown'",
  "drawSurface.addEventListener('pointermove'",
  "drawSurface.addEventListener('pointerup'",
  'MAX_VISIBLE_STROKES',
  'MAX_PEN_POINTS',
  'drawNote',
  'drawToolsAria',
  'drawColorsAria',
  'id="ptSteps"',
  'aria-current="step"',
  'id="ptLoading"',
  'id="ptCurrentFile"',
  'id="ptMicNote"',
  'data-i18n="localBadge"',
  'data-i18n="stepExport"',
  'function lockHelpBackground()',
  'function unlockHelpBackground()',
  "helpDialog.addEventListener('close',unlockHelpBackground)",
  "language === 'ja' ? 'EN' : 'JA'",
  'Fully local processing',
  'footer { display: none; }',
  'state.resultStatusKey',
  'state.stopReason',
  'id="ptInputPanel"',
  'id="ptStudioPanel"',
  'id="ptResultPanel"',
  'id="ptCanvas"',
  'id="ptVideo"',
  'id="ptRecordClock"',
  'id="ptSourceClock"',
  'id="outputFilename"',
  'navigator.mediaDevices.getUserMedia',
  'stageCanvas.captureStream',
  'new MediaStream([videoTrack,capturedAudioTrack])',
  'new MediaRecorder(',
  "state.recorder.start(1000)",
  "state.recorder.ondataavailable",
  "state.recorder.onstop",
  "sourceVideo.pause()",
  "HTMLMediaElement.HAVE_CURRENT_DATA",
  "document.addEventListener('visibilitychange'",
  "new Blob(chunks,{type:mediaType})",
  "resultVideo.src = inspected.url",
  "MediaRecorder.isTypeSupported",
  "window.AppToast",
  "window.AppConfirm",
  "const APP_CONFIG = __APP_CONFIG_JSON__",
  "const BUILD_MANIFEST = __BUILD_MANIFEST_JSON__",
  "const assetBundle = __EMBEDDED_ASSET_BUNDLE_JSON__",
  "connect-src 'none'"
)
foreach ($token in $requiredTokens) {
  if (-not $source.Contains([string]$token)) { throw "Pause & Tell required marker missing: $token" }
}
if ($source.Contains("Single HTML App Starter") -or $source.Contains("Starter workspace")) {
  throw "A starter-specific page has leaked into Pause & Tell."
}
if ($source.Contains("state.recorder.pause(")) { throw "Pausing source playback must never pause MediaRecorder." }
if (-not $spec.Contains("FR-010") -or -not $plan.Contains("G1")) {
  throw "Specification and development gates are missing."
}
if (-not $readme.Contains("v0.5.0") -or -not $readmeJa.Contains("v0.5.0")) {
  throw "README must describe the experimental v0.5.0 stage."
}
if (-not (Test-Path (Join-Path $Root "docs\G1_VALIDATION.md"))) { throw "Missing G1 validation protocol." }
if (-not (Test-Path (Join-Path $Root "docs\G2_VALIDATION.md"))) { throw "Missing G2 validation protocol." }
if (-not (Test-Path (Join-Path $Root "docs\G3_VALIDATION.md"))) { throw "Missing G3 validation protocol." }
if (-not (Test-Path (Join-Path $Root "docs\G4_VALIDATION.md"))) { throw "Missing G4 validation protocol." }
if (-not (Test-Path (Join-Path $Root "docs\G5_VALIDATION.md"))) { throw "Missing G5 validation protocol." }
if ($source.Contains("connect(audioMix.context.destination)") -or $source.Contains("connect(context.destination)")) {
  throw "Do not route mixed user media into speaker output."
}
$icon = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "assets\favicon.svg")
if (-not $icon.Contains('<rect width="64" height="64" rx="16" fill="#16624f"/>') -or -not $icon.Contains('<!-- Speech / narration bubble -->')) {
  throw "The canonical favicon must be the supplied Pause & Tell SVG."
}

Write-Host "[OK] Pause & Tell v0.5.0 contract markers passed." -ForegroundColor Green
