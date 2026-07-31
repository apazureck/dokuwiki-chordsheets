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

    foreach ($marker in @('DokuWiki Chordsheets Demo', 'Live demo', 'Installation', 'song-with-chords')) {
        if ($page.Content -notmatch [regex]::Escape($marker)) {
            throw "Expected marker '$marker' was not found in the rendered start page."
        }
    }

    if ([regex]::Matches($page.Content, 'song-with-chords').Count -lt 3) {
        throw 'The rendered start page does not contain all interactive examples.'
    }

    $rawPage = Invoke-WebRequest -Uri "$baseUrl/doku.php?id=start&do=export_raw" -UseBasicParsing
    if ($rawPage.Content -notmatch '<chordSheet 2[^>]*\bsource="tabs"') {
        throw 'The transposition example is missing from the start page.'
    }

    $cssMatch = [regex]::Match(
        $page.Content,
        '<link rel="stylesheet" href="([^"]*lib/exe/css\.php[^"]*)"'
    )
    if (-not $cssMatch.Success) {
        throw 'DokuWiki did not publish its compiled stylesheet.'
    }
    $cssPath = [System.Net.WebUtility]::HtmlDecode($cssMatch.Groups[1].Value)
    $css = Invoke-WebRequest -Uri "$baseUrl$cssPath" -UseBasicParsing
    $hasDemoStyles = $css.Content -match [regex]::Escape('.dokuwiki.home')
    if (($css.StatusCode -ne 200) -or ($css.Content -match 'fatal error') -or (-not $hasDemoStyles)) {
        throw 'The demo stylesheet could not be compiled by DokuWiki.'
    }

    $logo = Invoke-WebRequest -Uri "$baseUrl/lib/exe/fetch.php?media=wiki:logo.png" -UseBasicParsing
    if ($logo.StatusCode -ne 200 -or $logo.RawContentLength -lt 1024) {
        throw 'The demo logo is not available from DokuWiki media storage.'
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
