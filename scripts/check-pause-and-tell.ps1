$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$insertionRoot = Join-Path $Root "experiments\insertion-poc"
$source = Get-Content -Raw -Encoding UTF8 (Join-Path $insertionRoot "index.template.html")
$runtime = Get-Content -Raw -Encoding UTF8 (Join-Path $insertionRoot "insertion-poc.js")
$config = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "app.config.json") | ConvertFrom-Json
if ([string]$config.name -ne "Pause & Tell" -or [string]$config.slug -ne "pause-and-tell") { throw "Pause & Tell identity mismatch." }
if ([string]$config.version -ne "1.0.0") { throw "Unexpected insertion editor version." }
if ([string]$config.repository.owner -ne "ttomohisa" -or [string]$config.repository.name -ne "htmlapps-pause-and-tell") { throw "Pause & Tell repository mismatch." }
if ($config.build.blockRuntimeNetwork -ne $true) { throw "Runtime network must remain blocked." }
foreach ($token in @('id="sourceFile"', 'id="sourceVideo"', 'id="startNote"', 'id="noteList"', 'id="export"', 'id="outputName"', 'id="save"', 'id="share"', 'id="exportFormat"', 'id="appBrandIcon"', "connect-src 'none'", "worker-src 'none'", '__MEDIABUNNY_LICENSE__', '/*__INSERTION_POC_BUNDLE__*/')) {
  if (-not $source.Contains($token)) { throw "Insertion editor template marker missing: $token" }
}
if (([regex]::Matches($source, '__APP_ICON_DATA_URI__')).Count -ne 2) { throw "Canonical favicon and brand icon slots are required." }
foreach ($token in @('MAX_SOURCE_SECONDS', 'MAX_SOURCE_BYTES', 'MAX_NOTE_SECONDS', 'MAX_OUTPUT_SECONDS', 'function loadSource(', 'function clearResult()', 'function resetNotes()', 'function removeNote(', 'function renderNotes(', 'getUserMedia', 'visibilitychange')) {
  if (-not $runtime.Contains($token)) { throw "Insertion editor runtime marker missing: $token" }
}
$package = Get-Content -Raw -Encoding UTF8 (Join-Path $insertionRoot "package.json") | ConvertFrom-Json
# npm lock packages include an empty root key, unsupported by PS5 ConvertFrom-Json.
# Project only named records with primitive fields before PowerShell parses them.
$lockProjection = & node -e "const fs=require('fs'); const lock=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(JSON.stringify(Object.entries(lock.packages).filter(([key])=>key).map(([path,item])=>({path,version:item.version,integrity:item.integrity}))));" (Join-Path $insertionRoot "package-lock.json")
if ($LASTEXITCODE -ne 0) { throw "Unable to project the insertion npm lock." }
$lockEntries = @($lockProjection | ConvertFrom-Json)
if ([string]$package.dependencies.mediabunny -ne '1.61.5') { throw "Review required for Mediabunny version changes." }
$matchingLockEntries = @($lockEntries | Where-Object { $_.path -eq 'node_modules/mediabunny' })
if ($matchingLockEntries.Count -ne 1) { throw 'Expected one Mediabunny npm lock entry.' }
$locked = $matchingLockEntries[0]
if ([string]$locked.version -ne [string]$package.dependencies.mediabunny -or [string]::IsNullOrWhiteSpace([string]$locked.integrity)) { throw "Mediabunny npm lock is missing or inconsistent." }
$builder = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "build-standalone.ps1")
foreach ($token in @('npm ci --ignore-scripts', 'node build.mjs', 'npmIntegrity', 'rootHtmlOutputPath')) {
  if (-not $builder.Contains($token)) { throw "Normal insertion distribution build marker missing: $token" }
}
Write-Host "[OK] Pause & Tell normal insertion editor contract passed." -ForegroundColor Green
