$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$builder = Join-Path $repositoryRoot 'deployment\build-demo-zip.ps1'
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('chordsheets-zip-test-' + [guid]::NewGuid().ToString('N'))
$fixtureRoot = Join-Path $temporaryRoot 'dokuwiki-test'
$fixtureArchive = Join-Path $temporaryRoot 'dokuwiki-test.tgz'
$outputArchive = Join-Path $temporaryRoot 'demo-release.zip'
$expandedOutput = Join-Path $temporaryRoot 'expanded'

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

try {
    New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'inc') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'conf') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'data\pages') -Force | Out-Null

    Set-Content -LiteralPath (Join-Path $fixtureRoot 'doku.php') -Value '<?php echo "fixture";'
    Set-Content -LiteralPath (Join-Path $fixtureRoot 'install.php') -Value '<?php echo "installer";'
    Set-Content -LiteralPath (Join-Path $fixtureRoot 'inc\init.php') -Value '<?php'
    Set-Content -LiteralPath (Join-Path $fixtureRoot 'conf\dokuwiki.php') -Value '<?php'
    Set-Content -LiteralPath (Join-Path $fixtureRoot 'data\pages\start.txt') -Value 'fixture'

    Push-Location $temporaryRoot
    try {
        & tar -czf $fixtureArchive 'dokuwiki-test'
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not create DokuWiki fixture archive.'
        }
    } finally {
        Pop-Location
    }

    $fixtureSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $fixtureArchive).Hash.ToLowerInvariant()

    & $builder `
        -DokuWikiArchive $fixtureArchive `
        -DokuWikiSha256 $fixtureSha256 `
        -DokuWikiRootName 'dokuwiki-test' `
        -OutputArchive $outputArchive `
        -RepositoryRoot $repositoryRoot

    Assert-True (Test-Path -LiteralPath $outputArchive -PathType Leaf) 'ZIP builder did not create an archive.'

    Expand-Archive -LiteralPath $outputArchive -DestinationPath $expandedOutput
    Assert-True (Test-Path -LiteralPath (Join-Path $expandedOutput 'doku.php') -PathType Leaf) 'ZIP is missing doku.php.'
    Assert-True (Test-Path -LiteralPath (Join-Path $expandedOutput 'lib\plugins\chordsheets\syntax.php') -PathType Leaf) 'ZIP is missing the plugin.'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $expandedOutput 'install.php'))) 'ZIP contains install.php.'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $expandedOutput 'data'))) 'ZIP contains mutable data.'

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($outputArchive)
    try {
        $entryNames = @($zip.Entries | ForEach-Object { $_.FullName })
    } finally {
        $zip.Dispose()
    }

    Assert-True ($entryNames -contains 'doku.php') 'ZIP entry list is missing doku.php.'
    Assert-True (-not ($entryNames | Where-Object { $_.StartsWith('/') -or $_.Contains('../') })) 'ZIP contains an unsafe path.'

    Write-Host 'zip-output.test.ps1: PASS'
} finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
