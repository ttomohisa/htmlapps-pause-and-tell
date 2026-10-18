param(
  [switch]$ForceDownload,
  [switch]$SkipSelfExtract,
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$insertionRoot = Join-Path $Root "experiments\insertion-poc"
$TemplatePath = Join-Path $insertionRoot "dist\index.html"
$AppConfigPath = Join-Path $Root "app.config.json"
$AppIconPath = Join-Path $Root "assets\favicon.svg"
$DependenciesPath = Join-Path $Root "dependencies.json"
$DependencyLockPath = Join-Path $Root "dependencies.lock.json"
$VerifyPath = Join-Path $Root "scripts\verify-standalone.ps1"
$SelfExtractBuilderPath = Join-Path $Root "scripts\build-self-extract.ps1"
$CacheRoot = Join-Path $Root ".cache"
$DistRoot = Join-Path $Root "dist"

$OutputPathWasSpecified = -not [string]::IsNullOrWhiteSpace($OutputPath)
if ($OutputPathWasSpecified -and -not [System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath = Join-Path $Root $OutputPath
}

New-Item -ItemType Directory -Force -Path $CacheRoot, $DistRoot | Out-Null

function Write-Step([string]$Message) {
  Write-Host "[Single HTML] $Message" -ForegroundColor Cyan
}

function Get-Json([string]$Path) {
  if (-not (Test-Path $Path)) { throw "Required file not found: $Path" }
  return Get-Content -Raw -Encoding UTF8 $Path | ConvertFrom-Json
}

function Get-Sha256FileHex([string]$Path) {
  if (-not (Test-Path $Path)) { throw "File not found for SHA-256: $Path" }
  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $algorithm.ComputeHash($stream)
    return (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

function Get-SafeId([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { throw "Dependency id cannot be empty." }
  if ($Value -notmatch '^[a-z0-9][a-z0-9._-]*$') { throw "Dependency id '$Value' must use lowercase letters, numbers, dot, underscore, or hyphen." }
  return $Value
}

function Get-NpmPackage([string]$PackageName, [string]$Version) {
  if ([string]::IsNullOrWhiteSpace($PackageName) -or [string]::IsNullOrWhiteSpace($Version)) {
    throw "Every dependency requires package and version."
  }

  $packageKey = (($PackageName -replace "[^A-Za-z0-9._-]", "-") + "-" + $Version)
  $packageRoot = Join-Path $CacheRoot $packageKey
  $extractRoot = Join-Path $packageRoot "extracted"
  $packageDir = Join-Path $extractRoot "package"
  $archivePath = Join-Path $packageRoot "package.tgz"
  $metadataPath = Join-Path $packageRoot "metadata.json"

  if ($ForceDownload -and (Test-Path $packageRoot)) {
    Remove-Item -Recurse -Force $packageRoot
  }

  New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

  if (-not (Test-Path $archivePath)) {
    $encodedPackage = [Uri]::EscapeDataString($PackageName)
    $metadataUrl = "https://registry.npmjs.org/$encodedPackage/$Version"
    Write-Step "Resolving $PackageName@$Version"
    $metadata = Invoke-RestMethod -Uri $metadataUrl -UseBasicParsing -Headers @{ "User-Agent" = "single-html-app-template/1.0" }
    if (-not $metadata.dist.tarball) { throw "npm metadata did not contain a tarball URL for $PackageName@$Version" }
    $metadata | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $metadataPath
    $partialPath = "$archivePath.part"
    Remove-Item -Force -ErrorAction SilentlyContinue $partialPath
    Write-Step "Downloading $PackageName@$Version"
    Invoke-WebRequest -Uri ([string]$metadata.dist.tarball) -OutFile $partialPath -UseBasicParsing -Headers @{ "User-Agent" = "single-html-app-template/1.0" }
    Move-Item -Force $partialPath $archivePath
  } else {
    Write-Step "Using cached archive for $PackageName@$Version"
  }

  if (-not (Test-Path $packageDir)) {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extractRoot
    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
    Write-Step "Extracting $PackageName@$Version"
    & tar.exe -xzf $archivePath -C $extractRoot
    if ($LASTEXITCODE -ne 0) { throw "tar.exe failed while extracting $archivePath" }
  }

  $packageJsonPath = Join-Path $packageDir "package.json"
  if (-not (Test-Path $packageJsonPath)) { throw "package.json was not found in $packageDir" }
  $actualVersion = [string]((Get-Content -Raw -Encoding UTF8 $packageJsonPath | ConvertFrom-Json).version)
  if ($actualVersion -ne $Version) { throw "Expected $PackageName@$Version but the archive contains $actualVersion" }

  return [ordered]@{
    Root = $packageDir
    Archive = $archivePath
    ArchiveSha256 = (Get-Sha256FileHex $archivePath)
  }
}

function Get-MimeType([string]$Path) {
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".js" { return "text/javascript" }
    ".mjs" { return "text/javascript" }
    ".css" { return "text/css" }
    ".json" { return "application/json" }
    ".wasm" { return "application/wasm" }
    ".svg" { return "image/svg+xml" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".webp" { return "image/webp" }
    ".woff" { return "font/woff" }
    ".woff2" { return "font/woff2" }
    ".txt" { return "text/plain" }
    default { return "application/octet-stream" }
  }
}

function Get-AssetBytes([string]$Path, [bool]$StripSourceMapComment) {
  if (-not (Test-Path $Path)) { throw "Dependency asset not found: $Path" }
  if ($StripSourceMapComment -and [System.IO.Path]::GetExtension($Path) -in @(".js", ".mjs", ".css")) {
    $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $text = [regex]::Replace($text, "(?m)^\s*//# sourceMappingURL=.*$", "")
    $text = [regex]::Replace($text, "(?m)^\s*/\*# sourceMappingURL=.*?\*/\s*$", "")
    return [System.Text.Encoding]::UTF8.GetBytes($text)
  }
  return [System.IO.File]::ReadAllBytes($Path)
}


function Compress-GzipBytes([byte[]]$Bytes) {
  $output = New-Object System.IO.MemoryStream
  $gzip = New-Object System.IO.Compression.GZipStream -ArgumentList @(
    $output,
    [System.IO.Compression.CompressionMode]::Compress,
    $true
  )
  try {
    $gzip.Write($Bytes, 0, $Bytes.Length)
  } finally {
    $gzip.Dispose()
  }
  try {
    return ,$output.ToArray()
  } finally {
    $output.Dispose()
  }
}

function Get-OptionalNumber([object]$Object, [string]$Name, [double]$Fallback = 0) {
  if ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name) {
    return [double]$Object.$Name
  }
  return $Fallback
}

function ConvertTo-SafeJson([object]$Value, [int]$Depth = 30) {
  return ($Value | ConvertTo-Json -Compress -Depth $Depth).Replace("<", "\u003c").Replace(">", "\u003e").Replace("&", "\u0026")
}

function Get-RelativeAssetPath([string]$PackageRoot, [string]$ConfiguredPath) {
  if ([string]::IsNullOrWhiteSpace($ConfiguredPath)) { throw "Dependency asset path cannot be empty." }
  $rootFull = [System.IO.Path]::GetFullPath($PackageRoot).TrimEnd([char[]]@([char]92, [char]47))
  $assetFull = [System.IO.Path]::GetFullPath((Join-Path $PackageRoot $ConfiguredPath))
  if (-not $assetFull.StartsWith($rootFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Dependency asset path escapes the package root: $ConfiguredPath"
  }
  return $assetFull
}

if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
  throw "tar.exe was not found. Use a current Windows 10/11 environment, or install bsdtar and expose it as tar.exe."
}

if (-not (Test-Path -LiteralPath $AppIconPath -PathType Leaf)) {
  throw "Canonical app icon was not found: $AppIconPath"
}
$appIconBytes = [System.IO.File]::ReadAllBytes($AppIconPath)
$appIconDataUri = "data:image/svg+xml;base64," + [Convert]::ToBase64String($appIconBytes)

$appConfig = Get-Json $AppConfigPath
$dependencyConfig = Get-Json $DependenciesPath
$dependencyLock = Get-Json $DependencyLockPath
$rootHtmlOutputPath = ""
$rootHtmlOutputName = ""
if (-not $OutputPathWasSpecified) {
  $configuredOutput = [string]$appConfig.build.output
  if ([string]::IsNullOrWhiteSpace($configuredOutput)) { $configuredOutput = "dist/index.html" }
  $OutputPath = if ([System.IO.Path]::IsPathRooted($configuredOutput)) { $configuredOutput } else { Join-Path $Root $configuredOutput }

  $repositoryName = [string]$appConfig.repository.name
  if ([string]::IsNullOrWhiteSpace($repositoryName)) {
    throw "app.config.json: repository.name is required to generate the repository-root HTML copy."
  }

  $rootHtmlBaseName = $repositoryName
  if ($rootHtmlBaseName.StartsWith("htmlapps-", [System.StringComparison]::OrdinalIgnoreCase)) {
    $rootHtmlBaseName = $rootHtmlBaseName.Substring("htmlapps-".Length)
  }

  if ([string]::IsNullOrWhiteSpace($rootHtmlBaseName) -or $rootHtmlBaseName -in @(".", "..")) {
    throw "app.config.json: repository.name does not produce a valid repository-root HTML filename."
  }
  if ($rootHtmlBaseName.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ge 0) {
    throw "app.config.json: repository.name contains characters that cannot be used in the repository-root HTML filename."
  }

  $rootHtmlOutputName = $rootHtmlBaseName + ".html"
  $rootHtmlOutputPath = Join-Path $Root $rootHtmlOutputName
}
if (-not $dependencyConfig.dependencies) { $dependencies = @() } else { $dependencies = @($dependencyConfig.dependencies) }
if (-not ($dependencyLock.PSObject.Properties.Name -contains "schemaVersion") -or [int]$dependencyLock.schemaVersion -ne 1) {
  throw "dependencies.lock.json must use schemaVersion 1."
}
if (-not $dependencyLock.dependencies) { $lockedDependencies = @() } else { $lockedDependencies = @($dependencyLock.dependencies) }
$lockById = @{}
foreach ($lockedDependency in $lockedDependencies) {
  $lockedId = Get-SafeId ([string]$lockedDependency.id)
  if ($lockById.ContainsKey($lockedId)) { throw "Duplicate dependency lock id: $lockedId" }
  $lockById[$lockedId] = $lockedDependency
}
if ($lockedDependencies.Count -ne $dependencies.Count) {
  throw "dependencies.lock.json does not match dependencies.json. Run .\scripts\sync-dependency-lock.ps1 after changing dependencies."
}

if ($dependencies.Count -ne 0) { throw "Insertion runtime packages must be declared in experiments/insertion-poc/package.json and its npm lock; generic asset dependencies are unsupported by this entry." }

$ids = @{}
$assetBundle = [ordered]@{ schemaVersion = 2; dependencies = [ordered]@{} }
$manifestDependencies = @()

foreach ($dependency in $dependencies) {
  $id = Get-SafeId ([string]$dependency.id)
  if ($ids.ContainsKey($id)) { throw "Duplicate dependency id: $id" }
  $ids[$id] = $true

  if (-not $lockById.ContainsKey($id)) {
    throw "dependencies.lock.json has no entry for '$id'. Run .\scripts\sync-dependency-lock.ps1 -Id $id."
  }
  $lockedDependency = $lockById[$id]
  if ([string]$lockedDependency.package -ne [string]$dependency.package -or [string]$lockedDependency.version -ne [string]$dependency.version) {
    throw "Dependency lock mismatch for '$id'. Run .\scripts\sync-dependency-lock.ps1 -Id $id."
  }
  if ([string]$lockedDependency.tarballSha256 -notmatch '^[a-f0-9]{64}$') {
    throw "Dependency lock for '$id' has an invalid tarballSha256."
  }

  $package = Get-NpmPackage ([string]$dependency.package) ([string]$dependency.version)
  if ($package.ArchiveSha256 -ne [string]$lockedDependency.tarballSha256) {
    throw "Locked tarball SHA-256 mismatch for '$id'. Expected $([string]$lockedDependency.tarballSha256), got $($package.ArchiveSha256). Refusing to build."
  }
  $dependencyAssets = [ordered]@{}
  $manifestAssets = @()
  $assetKeys = @{}

  foreach ($asset in @($dependency.assets)) {
    $key = Get-SafeId ([string]$asset.key)
    if ($assetKeys.ContainsKey($key)) { throw "Duplicate asset key '$key' in dependency '$id'." }
    $assetKeys[$key] = $true

    $assetPath = Get-RelativeAssetPath $package.Root ([string]$asset.path)
    $strip = $false
    if ($asset.PSObject.Properties.Name -contains "stripSourceMapComment") { $strip = [bool]$asset.stripSourceMapComment }
    $bytes = Get-AssetBytes $assetPath $strip
    $configuredMime = ""
    if ($asset.PSObject.Properties.Name -contains "mime") { $configuredMime = [string]$asset.mime }
    $mime = if ([string]::IsNullOrWhiteSpace($configuredMime)) { Get-MimeType $assetPath } else { $configuredMime }
    $shaAlgorithm = [Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $shaAlgorithm.ComputeHash($bytes)
    } finally {
      $shaAlgorithm.Dispose()
    }
    $sha = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""

    $compressionSetting = "none"
    if ($asset.PSObject.Properties.Name -contains "compression") { $compressionSetting = ([string]$asset.compression).ToLowerInvariant() }
    if ($compressionSetting -notin @("none", "gzip", "auto")) {
      throw "Unsupported compression '$compressionSetting' for $id/$key. Use none, gzip, or auto."
    }

    $storedBytes = $bytes
    $resolvedCompression = "none"
    if ($compressionSetting -in @("gzip", "auto")) {
      $gzipBytes = Compress-GzipBytes $bytes
      if ($compressionSetting -eq "gzip" -or $gzipBytes.Length -lt $bytes.Length) {
        $storedBytes = $gzipBytes
        $resolvedCompression = "gzip"
      }
    }

    $dependencyAssets[$key] = [ordered]@{
      mime = $mime
      compression = $resolvedCompression
      originalBytes = $bytes.Length
      storedBytes = $storedBytes.Length
      base64 = [Convert]::ToBase64String($storedBytes)
    }
    $manifestAssets += [ordered]@{
      key = $key
      path = [string]$asset.path
      mime = $mime
      compression = $resolvedCompression
      bytes = $bytes.Length
      storedBytes = $storedBytes.Length
      sha256 = $sha
    }
  }

  $assetBundle.dependencies[$id] = [ordered]@{
    package = [string]$dependency.package
    version = [string]$dependency.version
    assets = $dependencyAssets
  }
  $license = ""
  $homepage = ""
  if ($dependency.PSObject.Properties.Name -contains "license") { $license = [string]$dependency.license }
  if ($dependency.PSObject.Properties.Name -contains "homepage") { $homepage = [string]$dependency.homepage }
  $manifestDependencies += [ordered]@{
    id = $id
    package = [string]$dependency.package
    version = [string]$dependency.version
    license = $license
    homepage = $homepage
    tarballSha256 = $package.ArchiveSha256
    locked = $true
    assets = $manifestAssets
  }
}

# The normal app is built from the insertion editor's maintained source graph.
# npm ci verifies package-lock integrity; no optional native/AAC experiment is bundled.
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Node.js and npm are required to bundle the insertion editor."
}
Push-Location $insertionRoot
try {
  & npm ci --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "Locked insertion dependency installation failed." }
  & node build.mjs
  if ($LASTEXITCODE -ne 0) { throw "Insertion editor build failed." }
} finally {
  Pop-Location
}
$insertionPackage = Get-Json (Join-Path $insertionRoot "package.json")
# npm lock packages include an empty root key, unsupported by PS5 ConvertFrom-Json.
# Project only named records with primitive fields before PowerShell parses them.
$lockProjection = & node -e "const fs=require('fs'); const lock=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(JSON.stringify(Object.entries(lock.packages).filter(([key])=>key).map(([path,item])=>({path,version:item.version,integrity:item.integrity}))));" (Join-Path $insertionRoot "package-lock.json")
if ($LASTEXITCODE -ne 0) { throw "Unable to project the insertion npm lock." }
$lockEntries = @($lockProjection | ConvertFrom-Json)
foreach ($runtimePackage in @($insertionPackage.dependencies.PSObject.Properties)) {
  $packageName = [string]$runtimePackage.Name
  $packageVersion = [string]$runtimePackage.Value
  $matchingLockEntries = @($lockEntries | Where-Object { $_.path -eq "node_modules/$packageName" })
  if ($matchingLockEntries.Count -ne 1) { throw "Expected one npm lock entry for $packageName." }
  $lockEntry = $matchingLockEntries[0]
  $installed = Get-Json (Join-Path $insertionRoot ("node_modules/" + $packageName + "/package.json"))
  if ([string]$lockEntry.version -ne $packageVersion -or [string]$installed.version -ne $packageVersion -or [string]::IsNullOrWhiteSpace([string]$lockEntry.integrity)) {
    throw "Bundled runtime dependency does not match its npm integrity lock: $packageName"
  }
  $manifestDependencies += [ordered]@{
    id = $packageName
    package = $packageName
    version = $packageVersion
    license = [string]$installed.license
    homepage = "https://github.com/Vanilagy/mediabunny"
    locked = $true
    npmIntegrity = [string]$lockEntry.integrity
    lockFile = "experiments/insertion-poc/package-lock.json"
    embedding = "tree-shaken inline JavaScript"
    assets = @()
  }
}

$manifest = [ordered]@{
  schemaVersion = 2
  builder = "single-html-app-template/1.3"
  generatedAtUtc = [DateTime]::UtcNow.ToString("o")
  app = [ordered]@{
    name = [string]$appConfig.name
    slug = [string]$appConfig.slug
    version = [string]$appConfig.version
  }
  dependencies = $manifestDependencies
  sourceBundleSha256 = Get-Sha256FileHex $TemplatePath
  npmLockSha256 = Get-Sha256FileHex (Join-Path $insertionRoot "package-lock.json")
}

Write-Step "Generating standalone HTML"
$template = [System.IO.File]::ReadAllText($TemplatePath, [System.Text.Encoding]::UTF8)
# Keep build metadata inert and auditable without changing the editor runtime.
$metadata = '<script id="app-config" type="application/json">' + (ConvertTo-SafeJson $appConfig 20) + '</script>' +
  '<script id="build-manifest" type="application/json">' + (ConvertTo-SafeJson $manifest 40) + '</script>'
if (([regex]::Matches($template, '</head>')).Count -ne 1) { throw "Insertion build must have one head closing tag." }
$template = $template.Replace('</head>', $metadata + '</head>')
$replacements = [ordered]@{
  "__APP_CONFIG_JSON__" = ""
  "__BUILD_MANIFEST_JSON__" = ""
  "__EMBEDDED_ASSET_BUNDLE_JSON__" = ""
  "__APP_ICON_DATA_URI__" = ""
  "/*__INSERTION_POC_BUNDLE__*/" = ""
  "__MEDIABUNNY_LICENSE__" = ""
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
[System.IO.File]::WriteAllText($OutputPath, $template, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $outputDirectory "dependency-manifest.json"), ($manifest | ConvertTo-Json -Depth 40), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $outputDirectory ".nojekyll"), "", (New-Object System.Text.UTF8Encoding($false)))

& $VerifyPath `
  -Path $OutputPath `
  -RequireInsertionEditor $true `
  -RequireNetworkBlock ([bool]$appConfig.build.blockRuntimeNetwork) `
  -ForbiddenPlaceholders @($replacements.Keys)

if (-not [string]::IsNullOrWhiteSpace($rootHtmlOutputPath)) {
  [System.IO.File]::Copy($OutputPath, $rootHtmlOutputPath, $true)
}

$selfExtractEnabled = $false
$selfExtractOutputPath = ""
if (-not $SkipSelfExtract -and ($appConfig.build.PSObject.Properties.Name -contains "selfExtract")) {
  $selfExtractConfig = $appConfig.build.selfExtract
  if ($selfExtractConfig -and ($selfExtractConfig.PSObject.Properties.Name -contains "enabled")) {
    $selfExtractEnabled = [bool]$selfExtractConfig.enabled
  }
  if ($selfExtractEnabled) {
    if (-not ($selfExtractConfig.PSObject.Properties.Name -contains "output")) {
      throw "app.config.json: build.selfExtract.output is required when self-extract output is enabled."
    }
    if ($OutputPathWasSpecified) {
      $customDirectory = Split-Path -Parent $OutputPath
      $customBaseName = [System.IO.Path]::GetFileNameWithoutExtension($OutputPath)
      $selfExtractOutputPath = Join-Path $customDirectory ($customBaseName + ".self-extract.html")
    } else {
      $configuredSelfExtractOutput = [string]$selfExtractConfig.output
      if ([string]::IsNullOrWhiteSpace($configuredSelfExtractOutput)) {
        throw "app.config.json: build.selfExtract.output cannot be empty."
      }
      $selfExtractOutputPath = if ([System.IO.Path]::IsPathRooted($configuredSelfExtractOutput)) {
        $configuredSelfExtractOutput
      } else {
        Join-Path $Root $configuredSelfExtractOutput
      }
    }

    Write-Step "Generating self-extracting HTML"
    & $SelfExtractBuilderPath `
      -InputPath $OutputPath `
      -OutputPath $selfExtractOutputPath `
      -AppName ([string]$appConfig.name) `
      -AppNameJa ([string]$appConfig.nameJa)
  }
}

$readableBytes = (Get-Item $OutputPath).Length
$selfExtractBytes = 0
if ($selfExtractEnabled -and (Test-Path $selfExtractOutputPath)) { $selfExtractBytes = (Get-Item $selfExtractOutputPath).Length }
$assetRawBytes = 0
$assetStoredBytes = 0
$sizeAssets = @()
foreach ($dependencyEntry in $manifestDependencies) {
  foreach ($assetEntry in @($dependencyEntry.assets)) {
    $assetRawBytes += [long]$assetEntry.bytes
    $assetStoredBytes += [long]$assetEntry.storedBytes
    $sizeAssets += [ordered]@{
      dependency = [string]$dependencyEntry.id
      key = [string]$assetEntry.key
      compression = [string]$assetEntry.compression
      originalBytes = [long]$assetEntry.bytes
      storedBytes = [long]$assetEntry.storedBytes
    }
  }
}
$sizeReport = [ordered]@{
  schemaVersion = 1
  generatedAtUtc = [DateTime]::UtcNow.ToString("o")
  readableHtmlBytes = [long]$readableBytes
  selfExtractHtmlBytes = [long]$selfExtractBytes
  embeddedAssetOriginalBytes = [long]$assetRawBytes
  embeddedAssetStoredBytes = [long]$assetStoredBytes
  embeddedAssetSavedBytes = [long]($assetRawBytes - $assetStoredBytes)
  assets = $sizeAssets
}
$sizeReportPath = Join-Path (Split-Path -Parent $OutputPath) "build-size-report.json"
[System.IO.File]::WriteAllText($sizeReportPath, ($sizeReport | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "[Size] Readable HTML: $([Math]::Round($readableBytes / 1MB, 2)) MB"
if ($selfExtractBytes -gt 0) { Write-Host "[Size] Self-extract HTML: $([Math]::Round($selfExtractBytes / 1MB, 2)) MB" }
Write-Host "[Size] Embedded assets: $([Math]::Round($assetRawBytes / 1MB, 2)) MB raw -> $([Math]::Round($assetStoredBytes / 1MB, 2)) MB stored"
Write-Host "[Size] Report: $sizeReportPath"

if ($appConfig.build.PSObject.Properties.Name -contains "sizeBudget" -and $appConfig.build.sizeBudget) {
  $readableBudget = Get-OptionalNumber $appConfig.build.sizeBudget "readableWarningMb" 0
  $selfExtractBudget = Get-OptionalNumber $appConfig.build.sizeBudget "selfExtractWarningMb" 0
  $readableMb = $readableBytes / 1MB
  $selfExtractMb = $selfExtractBytes / 1MB
  if ($readableBudget -gt 0 -and $readableMb -gt $readableBudget) {
    Write-Warning ("Readable HTML size {0:N2} MB exceeds warning budget {1:N2} MB." -f $readableMb, $readableBudget)
  }
  if ($selfExtractBytes -gt 0 -and $selfExtractBudget -gt 0 -and $selfExtractMb -gt $selfExtractBudget) {
    Write-Warning ("Self-extract HTML size {0:N2} MB exceeds warning budget {1:N2} MB." -f $selfExtractMb, $selfExtractBudget)
  }
}

$outputHash = Get-Sha256FileHex $OutputPath
$outputSizeMb = [Math]::Round($readableBytes / 1MB, 2)
Write-Host ""
Write-Host "[OK] Standalone HTML: $OutputPath" -ForegroundColor Green
if (-not [string]::IsNullOrWhiteSpace($rootHtmlOutputPath)) {
  Write-Host "[OK] Repository-root HTML: $rootHtmlOutputPath" -ForegroundColor Green
}
Write-Host "[OK] Size: $outputSizeMb MB"
Write-Host "[OK] SHA-256: $outputHash"
Write-Host "[OK] Fetch/XHR/WebSocket-style runtime network access is blocked by CSP."
if ($selfExtractEnabled) {
  Write-Host "[OK] Self-extracting HTML: $selfExtractOutputPath" -ForegroundColor Green
}
