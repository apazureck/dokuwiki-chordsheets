[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [Parameter(Mandatory)]
    [string]$OutputArchive,

    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Assert-Metadata {
    param(
        [string]$Root,
        [hashtable]$Manifest
    )

    $pluginInfo = Get-Content -Raw (Join-Path $Root 'plugin.info.txt')
    if ($pluginInfo -notmatch '(?m)^base\s+chordsheets\r?$') {
        throw 'plugin.info.txt must declare the chordsheets base.'
    }
    if ($pluginInfo -notmatch "(?m)^date\s+$([regex]::Escape($Manifest.ReleaseDate))\r?$") {
        throw "plugin.info.txt date must be $($Manifest.ReleaseDate)."
    }

    $changelog = Get-Content -Raw (Join-Path $Root 'CHANGELOG.md')
    $releaseHeading = (
        '(?m)^## \[' +
        [regex]::Escape($Manifest.Version) +
        '\] - ' +
        [regex]::Escape($Manifest.ReleaseDate) +
        '\r?$'
    )
    if ($changelog -notmatch $releaseHeading) {
        throw "CHANGELOG.md must contain release $($Manifest.Version) dated $($Manifest.ReleaseDate)."
    }
}

$resolvedRepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$manifestPath = Join-Path $PSScriptRoot 'release-manifest.psd1'
$manifest = Import-PowerShellDataFile -LiteralPath $manifestPath

if ($Version -ne $manifest.Version) {
    throw "Requested version $Version does not match release manifest version $($manifest.Version)."
}
if ([System.IO.Path]::GetExtension($OutputArchive) -ne '.zip') {
    throw 'OutputArchive must end in .zip.'
}

$archivePath = [System.IO.Path]::GetFullPath($OutputArchive)
$archiveParent = Split-Path -Parent $archivePath
if (-not (Test-Path -LiteralPath $archiveParent -PathType Container)) {
    New-Item -ItemType Directory -Path $archiveParent -Force | Out-Null
}
if (Test-Path -LiteralPath $archivePath) {
    throw "Refusing to overwrite existing release archive: $archivePath"
}

Assert-Metadata -Root $resolvedRepositoryRoot -Manifest $manifest

$stagingRoot = Join-Path $archiveParent ('.plugin-release-' + [guid]::NewGuid().ToString('N'))
$pluginRoot = Join-Path $stagingRoot $manifest.PluginRoot

try {
    New-Item -ItemType Directory -Path $pluginRoot -Force | Out-Null

    foreach ($relativePath in $manifest.Include) {
        $sourcePath = Join-Path $resolvedRepositoryRoot $relativePath
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            throw "Required release input is missing: $relativePath"
        }

        $sourceItems = @(
            Get-Item -LiteralPath $sourcePath -Force
            if (Test-Path -LiteralPath $sourcePath -PathType Container) {
                Get-ChildItem -LiteralPath $sourcePath -Recurse -Force
            }
        )
        foreach ($sourceItem in $sourceItems) {
            if (($sourceItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Release inputs must not contain symbolic links or reparse points: $relativePath"
            }
        }

        Copy-Item -LiteralPath $sourcePath -Destination $pluginRoot -Recurse
    }

    Compress-Archive -LiteralPath $pluginRoot -DestinationPath $archivePath -CompressionLevel Optimal

    $zipArchive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        $entries = @($zipArchive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
        if ($entries.Count -eq 0) {
            throw 'The generated release archive is empty.'
        }
        foreach ($normalizedEntry in $entries) {
            if (
                $normalizedEntry -ne "$($manifest.PluginRoot)/" -and
                -not $normalizedEntry.StartsWith("$($manifest.PluginRoot)/")
            ) {
                throw "Archive entry escaped the plugin root: $normalizedEntry"
            }
        }
    } finally {
        $zipArchive.Dispose()
    }
} catch {
    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }
    throw
} finally {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}

Write-Host "Created verified plugin archive: $archivePath"
