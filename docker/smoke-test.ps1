[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8080,

    [switch]$SkipStart
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $projectRoot 'compose.yaml'
$previousPort = $env:DOKUWIKI_PORT

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & docker compose --file $composeFile @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

try {
    if (-not (Test-Path -LiteralPath $composeFile)) {
        throw "Compose file not found: $composeFile"
    }

    $env:DOKUWIKI_PORT = [string]$Port
    Invoke-Compose -Arguments @('config', '--quiet')

    if (-not $SkipStart) {
        Invoke-Compose -Arguments @('up', '--detach', '--wait')
    }

    $baseUrl = "http://127.0.0.1:$Port"
    $page = Invoke-WebRequest -Uri "$baseUrl/doku.php?id=start" -UseBasicParsing

    if ($page.StatusCode -ne 200) {
        throw "DokuWiki returned HTTP $($page.StatusCode)."
    }

    foreach ($marker in @('DokuWiki Chordsheets Test', 'song-with-chords')) {
        if ($page.Content -notmatch [regex]::Escape($marker)) {
            throw "Expected marker '$marker' was not found in the rendered start page."
        }
    }

    if ([regex]::Matches($page.Content, 'song-with-chords').Count -lt 2) {
        throw 'The rendered start page does not contain both test chord sheets.'
    }

    $rawPage = Invoke-WebRequest -Uri "$baseUrl/doku.php?id=start&do=export_raw" -UseBasicParsing
    if ($rawPage.Content -notmatch [regex]::Escape('<chordSheet 2 instrument="ukulele">')) {
        throw 'The ukulele/transposition regression fixture is missing from the start page.'
    }

    $asset = Invoke-WebRequest -Uri "$baseUrl/lib/plugins/chordsheets/script.js" -UseBasicParsing
    if ($asset.StatusCode -ne 200 -or $asset.Content -notmatch 'runSongHighlighter') {
        throw 'The bind-mounted chordsheets plugin asset is not available.'
    }

    Invoke-Compose -Arguments @(
        'exec',
        '--no-TTY',
        'dokuwiki',
        'test',
        '-f',
        '/storage/lib/plugins/chordsheets/plugin.info.txt'
    )

    Invoke-Compose -Arguments @(
        'exec',
        '--no-TTY',
        'dokuwiki',
        'test',
        '!',
        '-w',
        '/storage/lib/plugins/chordsheets/script.js'
    )

    Invoke-Compose -Arguments @(
        'exec',
        '--no-TTY',
        'dokuwiki',
        'test',
        '!',
        '-e',
        '/storage/lib/plugins/chordsheets/README.md'
    )

    Write-Host "Smoke test passed: $baseUrl/doku.php?id=start"
}
finally {
    if ($null -eq $previousPort) {
        Remove-Item Env:DOKUWIKI_PORT -ErrorAction SilentlyContinue
    }
    else {
        $env:DOKUWIKI_PORT = $previousPort
    }
}
