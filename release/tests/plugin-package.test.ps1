$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$builder = Join-Path $repositoryRoot 'release\build-plugin-zip.ps1'
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
    'chordsheets-plugin-release-' + [guid]::NewGuid().ToString('N')
)
$archive = Join-Path $temporaryRoot 'dokuwiki-plugin-chordsheets-1.0.0.zip'
$expanded = Join-Path $temporaryRoot 'expanded'

try {
    Assert-True (Test-Path -LiteralPath $builder -PathType Leaf) 'Plugin release builder is missing.'

    New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
    & $builder `
        -Version '1.0.0' `
        -RepositoryRoot $repositoryRoot `
        -OutputArchive $archive

    Assert-True (Test-Path -LiteralPath $archive -PathType Leaf) 'Plugin release ZIP was not created.'

    $zipArchive = [System.IO.Compression.ZipFile]::OpenRead($archive)
    try {
        $entries = @($zipArchive.Entries | ForEach-Object { $_.FullName })
    } finally {
        $zipArchive.Dispose()
    }
    Assert-True ($entries.Count -gt 0) 'Plugin release ZIP is empty.'

    $normalizedEntries = @($entries | ForEach-Object { $_.Replace('\', '/') })
    foreach ($entry in $normalizedEntries) {
        Assert-True (
            $entry -eq 'chordsheets/' -or $entry.StartsWith('chordsheets/')
        ) "Archive entry is outside the chordsheets root: $entry"
    }

    $requiredEntries = @(
        'chordsheets/CHANGELOG.md'
        'chordsheets/LICENSE'
        'chordsheets/README.md'
        'chordsheets/THIRD_PARTY_NOTICES.md'
        'chordsheets/conf/default.php'
        'chordsheets/conf/metadata.php'
        'chordsheets/js/abcjs-basic.min.js'
        'chordsheets/js/ukulele-chords.js'
        'chordsheets/lang/en/settings.php'
        'chordsheets/licenses/abcjs-LICENSE.md'
        'chordsheets/js/jtab.min.js'
        'chordsheets/js/raphael.js'
        'chordsheets/licenses/jtab-LICENSE'
        'chordsheets/licenses/raphael-LICENSE'
        'chordsheets/plugin.info.txt'
        'chordsheets/script.js'
        'chordsheets/style.css'
        'chordsheets/syntax.php'
    )
    foreach ($requiredEntry in $requiredEntries) {
        Assert-True ($normalizedEntries -contains $requiredEntry) "Archive is missing $requiredEntry."
    }
    Assert-True ($normalizedEntries -notcontains 'chordsheets/print.css') 'Archive still contains the removed print/PDF stylesheet.'

    $forbiddenSegments = @(
        '/.git/'
        '/.github/'
        '/_test/'
        '/demo/'
        '/deployment/'
        '/docker/'
        '/release/'
        '/released/'
    )
    foreach ($entry in $normalizedEntries) {
        foreach ($segment in $forbiddenSegments) {
            Assert-True (-not $entry.Contains($segment)) "Forbidden release entry found: $entry"
        }
    }

    New-Item -ItemType Directory -Path $expanded -Force | Out-Null
    [System.IO.Compression.ZipFile]::ExtractToDirectory($archive, $expanded)

    $pluginInfo = Get-Content -Raw (Join-Path $expanded 'chordsheets\plugin.info.txt')
    Assert-True ($pluginInfo -match '(?m)^base\s+chordsheets\r?$') 'plugin.info.txt has the wrong base.'
    Assert-True ($pluginInfo -match '(?m)^date\s+\d{4}-\d{2}-\d{2}\r?$') 'plugin.info.txt has no release date.'
    Assert-True (
        $pluginInfo -match '(?m)^url\s+https://www\.dokuwiki\.org/plugin:chordsheets\r?$'
    ) 'plugin.info.txt does not link to the DokuWiki registry page.'

    $changelog = Get-Content -Raw (Join-Path $expanded 'chordsheets\CHANGELOG.md')
    Assert-True ($changelog -match '(?m)^## \[1\.0\.0\] - 2026-07-31\r?$') (
        'CHANGELOG.md has no 1.0.0 release section dated 2026-07-31.'
    )
} finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}

Write-Host 'plugin-package.test.ps1: PASS'
