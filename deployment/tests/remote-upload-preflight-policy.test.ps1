$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflow = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml')
$preflightPath = Join-Path $repositoryRoot 'deployment\remote-upload-preflight.sh'

if (-not (Test-Path -LiteralPath $preflightPath -PathType Leaf)) {
    throw 'Missing remote upload preflight script.'
}

$preflight = Get-Content -Raw -LiteralPath $preflightPath

foreach ($pattern in @(
    'deployment/remote-upload-preflight\.sh',
    'Remote upload preflight failed',
    '\^UPLOAD:\(\\\.upload\\\.\$GITHUB_SHA'
)) {
    if ($workflow -notmatch $pattern) {
        throw "Workflow is missing the remote preflight contract: $pattern"
    }
}

foreach ($pattern in @(
    '\^/home/www/',
    'canonical_parent=.*realpath -e /home/www',
    'canonical_root',
    'test ! -L "\$root"',
    'mktemp',
    'printf ''UPLOAD:%s'''
)) {
    if ($preflight -notmatch $pattern) {
        throw "Remote preflight is missing a safety invariant: $pattern"
    }
}

Write-Host 'remote-upload-preflight-policy.test.ps1: PASS'
