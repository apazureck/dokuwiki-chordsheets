$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pagePath = Join-Path $repositoryRoot 'demo\start.txt'
$logoPath = Join-Path $repositoryRoot 'img\chordsheets-logo.png'
$stylePath = Join-Path $repositoryRoot 'style.css'
$composePath = Join-Path $repositoryRoot 'compose.yaml'
$manifestPath = Join-Path $repositoryRoot 'deployment\demo-manifest.psd1'
$runnerPath = Join-Path $repositoryRoot 'deployment\web-deploy.php'

foreach ($requiredPath in @($pagePath, $logoPath, $stylePath, $composePath, $manifestPath, $runnerPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Missing demo website asset: $requiredPath"
    }
}

$page = Get-Content -Raw -LiteralPath $pagePath
$style = Get-Content -Raw -LiteralPath $stylePath
$compose = Get-Content -Raw -LiteralPath $composePath
$manifest = Get-Content -Raw -LiteralPath $manifestPath
$runner = Get-Content -Raw -LiteralPath $runnerPath

foreach ($requiredPagePattern in @(
    '====== DokuWiki Chordsheets ======',
    '===== Live demo =====',
    '===== Installation =====',
    '===== Project & roadmap =====',
    '\{\{:wiki:logo\.png\?220\|DokuWiki Chordsheets logo\}\}',
    '<chordSheet 0>',
    '<chordSheet 2>',
    'Cmaj7',
    'https://github\.com/apazureck/dokuwiki-chordsheets',
    'https://github\.com/apazureck/dokuwiki-chordsheets/issues/7',
    'archive/refs/heads/master\.zip',
    '<code xml>'
)) {
    if ($page -notmatch $requiredPagePattern) {
        throw "Demo page is missing required content: $requiredPagePattern"
    }
}

if ([regex]::Matches($page, '<chordSheet').Count -lt 3) {
    throw 'Demo page must contain at least three interactive chord-sheet examples.'
}

foreach ($requiredStylePattern in @(
    '\.dokuwiki\.home',
    '--demo-paper:',
    ':focus-visible',
    '@media \(max-width: 48rem\)',
    'prefers-reduced-motion'
)) {
    if ($style -notmatch $requiredStylePattern) {
        throw "Demo styles are missing accessibility or responsive behavior: $requiredStylePattern"
    }
}

if ($style -match '(?m)^\s*(?:body|html)\s*\{') {
    throw 'Demo website styles must not globally restyle host DokuWiki installations.'
}

foreach ($requiredDeliveryPattern in @(
    'source: \./demo',
    'chordsheets-logo\.png',
    "'demo'",
    'lib/plugins/chordsheets/demo/start\.txt',
    'sharedData/pages/start\.txt',
    'sharedData/media/wiki/logo\.png'
)) {
    if (($compose + "`n" + $manifest + "`n" + $runner) -notmatch $requiredDeliveryPattern) {
        throw "Demo delivery path is incomplete: $requiredDeliveryPattern"
    }
}

Write-Host 'demo-landing-page.test.ps1: PASS'
