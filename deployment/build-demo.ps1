[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DokuWikiArchive,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-fA-F0-9]{64}$')]
    [string]$DokuWikiSha256,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9._-]+$')]
    [string]$DokuWikiRootName,

    [Parameter(Mandatory = $true)]
    [string]$OutputArchive,

    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Join-Path $scriptDirectory '..'
}

$manifest = Import-PowerShellDataFile (Join-Path $scriptDirectory 'demo-manifest.psd1')
$resolvedRepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$resolvedSourceArchive = (Resolve-Path -LiteralPath $DokuWikiArchive).Path
$outputFullPath = [System.IO.Path]::GetFullPath($OutputArchive)
$outputDirectory = Split-Path -Parent $outputFullPath

if (-not (Test-Path -LiteralPath $outputDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedSourceArchive).Hash.ToLowerInvariant()
if ($actualSha256 -ne $DokuWikiSha256.ToLowerInvariant()) {
    throw "DokuWiki checksum mismatch. Expected $DokuWikiSha256 but got $actualSha256."
}

$archiveEntries = @(& tar -tf $resolvedSourceArchive)
if ($LASTEXITCODE -ne 0 -or $archiveEntries.Count -eq 0) {
    throw 'DokuWiki archive could not be listed.'
}

$expectedPrefix = "$DokuWikiRootName/"
foreach ($entry in $archiveEntries) {
    $normalizedEntry = $entry.Replace('\', '/')
    $segments = $normalizedEntry.Split('/', [System.StringSplitOptions]::RemoveEmptyEntries)
    $containsTraversal = $segments -contains '..'
    $isRooted = $normalizedEntry.StartsWith('/') -or $normalizedEntry -match '^[A-Za-z]:'

    if ($containsTraversal -or $isRooted -or (-not $normalizedEntry.StartsWith($expectedPrefix))) {
        throw "Unsafe or unexpected DokuWiki archive entry: $entry"
    }
}

$verboseEntries = @(& tar -tvf $resolvedSourceArchive)
if ($LASTEXITCODE -ne 0) {
    throw 'DokuWiki archive metadata could not be inspected.'
}

foreach ($entry in $verboseEntries) {
    if ($entry -match '^[lh]') {
        throw "DokuWiki archive contains a link entry and was rejected: $entry"
    }
}

$buildRoot = Join-Path $outputDirectory ('.demo-build-' + [guid]::NewGuid().ToString('N'))
$expandedRoot = Join-Path $buildRoot 'expanded'
$stageRoot = Join-Path $buildRoot 'stage'
$temporaryArchive = Join-Path $buildRoot 'release.tgz'

try {
    New-Item -ItemType Directory -Path $expandedRoot -Force | Out-Null
    & tar -xzf $resolvedSourceArchive -C $expandedRoot
    if ($LASTEXITCODE -ne 0) {
        throw 'DokuWiki archive could not be expanded.'
    }

    $expandedDokuWiki = Join-Path $expandedRoot $DokuWikiRootName
    if (-not (Test-Path -LiteralPath (Join-Path $expandedDokuWiki 'doku.php') -PathType Leaf)) {
        throw 'DokuWiki archive is missing doku.php.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $expandedDokuWiki 'inc\init.php') -PathType Leaf)) {
        throw 'DokuWiki archive is missing inc/init.php.'
    }

    Move-Item -LiteralPath $expandedDokuWiki -Destination $stageRoot

    foreach ($mutablePath in $manifest.MutableDokuWikiPaths) {
        $candidate = Join-Path $stageRoot $mutablePath
        if (Test-Path -LiteralPath $candidate) {
            Remove-Item -LiteralPath $candidate -Recurse -Force
        }
    }

    $installer = Join-Path $stageRoot 'install.php'
    if (Test-Path -LiteralPath $installer) {
        Remove-Item -LiteralPath $installer -Force
    }

    $pluginTarget = Join-Path $stageRoot 'lib\plugins\chordsheets'
    New-Item -ItemType Directory -Path $pluginTarget -Force | Out-Null

    foreach ($runtimePath in $manifest.PluginRuntime) {
        $source = Join-Path $resolvedRepositoryRoot $runtimePath
        if (-not (Test-Path -LiteralPath $source)) {
            throw "Required plugin runtime path is missing: $runtimePath"
        }

        Copy-Item -LiteralPath $source -Destination $pluginTarget -Recurse -Force
    }

    $topLevelEntries = @(Get-ChildItem -LiteralPath $stageRoot -Force | ForEach-Object { $_.Name })
    if ($topLevelEntries.Count -eq 0) {
        throw 'Release staging directory is empty.'
    }

    & tar -czf $temporaryArchive -C $stageRoot @topLevelEntries
    if ($LASTEXITCODE -ne 0) {
        throw 'Release archive could not be created.'
    }

    $releaseEntries = @(& tar -tf $temporaryArchive) | ForEach-Object { $_.Replace('\', '/') }
    if ($LASTEXITCODE -ne 0) {
        throw 'Release archive could not be verified.'
    }

    foreach ($forbiddenPath in $manifest.ForbiddenReleasePaths) {
        $match = $releaseEntries | Where-Object {
            $_ -eq $forbiddenPath -or $_.StartsWith($forbiddenPath)
        }
        if ($match) {
            throw "Forbidden path found in release archive: $forbiddenPath"
        }
    }

    Move-Item -LiteralPath $temporaryArchive -Destination $outputFullPath -Force
} finally {
    if (Test-Path -LiteralPath $buildRoot) {
        Remove-Item -LiteralPath $buildRoot -Recurse -Force
    }
}

Write-Host "Created verified demo release: $outputFullPath"
