$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflow = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml')
$preflight = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'deployment\remote-upload-preflight.sh')
$deploy = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'deployment\remote-deploy.sh')

foreach ($pattern in @(
    'cleanup_remote_upload',
    'remote_upload_pending',
    'trap cleanup_remote_upload EXIT',
    'trap - EXIT'
)) {
    if ($workflow -notmatch $pattern) {
        throw "Workflow is missing remote upload cleanup: $pattern"
    }
}

foreach ($content in @($preflight, $deploy)) {
    if ($content -notmatch 'trap \w+ EXIT') {
        throw 'Remote script must install an EXIT cleanup trap.'
    }
    if ($content -notmatch 'rm -f -- "\$(upload_file|archive)"') {
        throw 'Remote script must remove its exact upload file on failure.'
    }
}

$staleUploadNameRegex = [regex]::Escape('^\.upload\.[0-9a-f]{40}\.[A-Za-z0-9]{6}$')
foreach ($pattern in @(
    'find "\$uploads" -maxdepth 1 -type f -mmin \+45 -print0',
    'stale_upload_basename=\$\{stale_upload##\*/\}',
    $staleUploadNameRegex,
    '! -L "\$stale_upload"',
    'rm -f -- "\$stale_upload"'
)) {
    if ($preflight -notmatch $pattern) {
        throw "Remote preflight is missing stale upload cleanup protection: $pattern"
    }
}

Write-Host 'upload-cleanup.test.ps1: PASS'
