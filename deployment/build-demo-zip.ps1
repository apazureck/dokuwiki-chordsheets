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
    [ValidatePattern('\.zip$')]
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

$outputFullPath = [System.IO.Path]::GetFullPath($OutputArchive)
$outputDirectory = Split-Path -Parent $outputFullPath
if (-not (Test-Path -LiteralPath $outputDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$buildRoot = Join-Path $outputDirectory ('.demo-zip-build-' + [guid]::NewGuid().ToString('N'))
$intermediateArchive = Join-Path $buildRoot 'release.tgz'
$stageRoot = Join-Path $buildRoot 'stage'
$temporaryZip = Join-Path $buildRoot 'release.zip'

try {
    New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

    & (Join-Path $scriptDirectory 'build-demo.ps1') `
        -DokuWikiArchive $DokuWikiArchive `
        -DokuWikiSha256 $DokuWikiSha256 `
        -DokuWikiRootName $DokuWikiRootName `
        -OutputArchive $intermediateArchive `
        -RepositoryRoot $RepositoryRoot

    $tarListing = @(& tar -tvzf $intermediateArchive)
    if ($LASTEXITCODE -ne 0 -or $tarListing.Count -eq 0) {
        throw 'Verified intermediate release could not be inspected.'
    }
    foreach ($line in $tarListing) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line[0] -notin @('-', 'd')) {
            throw "Intermediate release contains a non-regular entry: $line"
        }
    }

    & tar -xzf $intermediateArchive -C $stageRoot
    if ($LASTEXITCODE -ne 0) {
        throw 'Verified intermediate release could not be expanded.'
    }

    $unsafeFile = Get-ChildItem -LiteralPath $stageRoot -Force -Recurse |
        Where-Object { $_.Attributes -band [System.IO.FileAttributes]::ReparsePoint } |
        Select-Object -First 1
    if ($unsafeFile) {
        throw "Release staging contains a link or reparse point: $($unsafeFile.FullName)"
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $zip = [System.IO.Compression.ZipFile]::Open(
        $temporaryZip,
        [System.IO.Compression.ZipArchiveMode]::Create
    )
    try {
        $files = @(Get-ChildItem -LiteralPath $stageRoot -File -Force -Recurse)
        if ($files.Count -eq 0) {
            throw 'Release staging directory contains no files.'
        }

        foreach ($file in $files) {
            $relativePath = $file.FullName.Substring($stageRoot.Length).TrimStart('\', '/').Replace('\', '/')
            if ($relativePath -notmatch '^[A-Za-z0-9._+@/-]+$') {
                throw "Release contains a non-portable path: $relativePath"
            }

            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip,
                $file.FullName,
                $relativePath,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    } finally {
        $zip.Dispose()
    }

    $zip = [System.IO.Compression.ZipFile]::OpenRead($temporaryZip)
    try {
        if ($zip.Entries.Count -eq 0) {
            throw 'ZIP archive is empty.'
        }

        $seenEntries = @{}
        foreach ($entry in $zip.Entries) {
            $entryName = $entry.FullName
            $segments = $entryName.Split('/', [System.StringSplitOptions]::RemoveEmptyEntries)
            $entryKey = $entryName.ToLowerInvariant()
            $containsTraversal = $segments -contains '..'
            $isRooted = $entryName.StartsWith('/') -or $entryName -match '^[A-Za-z]:'

            if (
                $containsTraversal -or
                $isRooted -or
                $entryName.Contains('\') -or
                $entryName -notmatch '^[A-Za-z0-9._+@/-]+$' -or
                $seenEntries.ContainsKey($entryKey)
            ) {
                throw "ZIP archive contains an unsafe or duplicate path: $entryName"
            }

            $seenEntries[$entryKey] = $true
        }
    } finally {
        $zip.Dispose()
    }

    Move-Item -LiteralPath $temporaryZip -Destination $outputFullPath -Force
} finally {
    if (Test-Path -LiteralPath $buildRoot) {
        Remove-Item -LiteralPath $buildRoot -Recurse -Force
    }
}

Write-Host "Created verified demo ZIP: $outputFullPath"
