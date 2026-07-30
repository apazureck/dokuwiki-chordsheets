$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$builder = Join-Path $repositoryRoot 'deployment\build-demo.ps1'
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('chordsheets-deploy-test-' + [guid]::NewGuid().ToString('N'))
$fixtureRoot = Join-Path $temporaryRoot 'dokuwiki-test'
$fixtureArchive = Join-Path $temporaryRoot 'dokuwiki-test.tgz'
$outputArchive = Join-Path $temporaryRoot 'demo-release.tgz'
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

function Assert-ArchiveEntry {
    param(
        [string[]]$Entries,
        [string]$ExpectedEntry
    )

    Assert-True ($Entries -contains $ExpectedEntry) "Missing archive entry: $ExpectedEntry"
}

try {
    New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'inc') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'conf') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'data\pages') -Force | Out-Null

    Set-Content -LiteralPath (Join-Path $fixtureRoot 'doku.php') -Value '<?php echo "fixture";'
    Set-Content -LiteralPath (Join-Path $fixtureRoot 'install.php') -Value '<?php echo "installer";'
    Set-Content -LiteralPath (Join-Path $fixtureRoot 'inc\init.php') -Value '<?php'
    Set-Content -LiteralPath (Join-Path $fixtureRoot 'conf\dokuwiki.php') -Value '<?php'
    Set-Content -LiteralPath (Join-Path $fixtureRoot 'conf\local.php') -Value '<?php $conf["unsafe"] = true;'
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

    Assert-True (Test-Path -LiteralPath $outputArchive -PathType Leaf) 'Builder did not create the release archive.'

    New-Item -ItemType Directory -Path $expandedOutput -Force | Out-Null
    & tar -xzf $outputArchive -C $expandedOutput
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not expand the built release archive.'
    }

    $entries = @(& tar -tf $outputArchive) | ForEach-Object { $_.Replace('\', '/') }
    Assert-ArchiveEntry $entries 'doku.php'
    Assert-ArchiveEntry $entries 'inc/init.php'
    Assert-ArchiveEntry $entries 'lib/plugins/chordsheets/syntax.php'
    Assert-ArchiveEntry $entries 'lib/plugins/chordsheets/script.js'
    Assert-ArchiveEntry $entries 'lib/plugins/chordsheets/style.css'
    Assert-ArchiveEntry $entries 'lib/plugins/chordsheets/plugin.info.txt'
    Assert-ArchiveEntry $entries 'lib/plugins/chordsheets/conf/default.php'
    Assert-ArchiveEntry $entries 'lib/plugins/chordsheets/conf/metadata.php'
    Assert-ArchiveEntry $entries 'lib/plugins/chordsheets/demo/start.txt'
    Assert-ArchiveEntry $entries 'lib/plugins/chordsheets/img/chordsheets-logo.png'

    $forbiddenPatterns = @(
        'install.php',
        'data/',
        'conf/local.php',
        '.git/',
        '.github/',
        '.vscode/',
        '.codex_tmp/',
        'docker/',
        '_test/',
        'released/',
        'compose.yaml',
        'README.md',
        'CHANGELOG.md',
        'test.html'
    )

    foreach ($pattern in $forbiddenPatterns) {
        Assert-True (-not ($entries | Where-Object { $_ -eq $pattern -or $_.StartsWith($pattern) })) "Forbidden archive entry found: $pattern"
    }

    $badChecksumOutput = Join-Path $temporaryRoot 'bad-checksum.tgz'
    $checksumFailed = $false
    try {
        & $builder `
            -DokuWikiArchive $fixtureArchive `
            -DokuWikiSha256 ('0' * 64) `
            -DokuWikiRootName 'dokuwiki-test' `
            -OutputArchive $badChecksumOutput `
            -RepositoryRoot $repositoryRoot
    } catch {
        $checksumFailed = $true
    }

    Assert-True $checksumFailed 'Builder accepted an invalid DokuWiki checksum.'
    Assert-True (-not (Test-Path -LiteralPath $badChecksumOutput)) 'Builder left output behind after checksum failure.'

    Write-Host 'artifact-build.test.ps1: PASS'
} finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
