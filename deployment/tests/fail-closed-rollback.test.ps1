$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflowPath = Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml'
$deactivatePath = Join-Path $repositoryRoot 'deployment\remote-deactivate.sh'

if (-not (Test-Path -LiteralPath $deactivatePath -PathType Leaf)) {
    throw 'Missing fail-closed remote deactivation script.'
}

$workflow = Get-Content -Raw -LiteralPath $workflowPath
$deactivate = Get-Content -Raw -LiteralPath $deactivatePath

foreach ($pattern in @(
    'realpath -e ''\$FTP_REMOTE_PATH''',
    'realpath -e ''\$FTP_REMOTE_PATH/uploads''',
    'rollback_verification_failed',
    '403'' \|\| \"\$status\" == ''404',
    'deployment/remote-deactivate\.sh',
    'post_deactivate_state'
)) {
    if ($workflow -notmatch $pattern) {
        throw "Workflow is missing fail-closed rollback protection: $pattern"
    }
}

foreach ($pattern in @(
    '\.deploy\.lock',
    '\^\[a-f0-9\]\{40\}\$',
    'readlink "\$remote_root/current"',
    'rm -f -- "\$remote_root/current"'
)) {
    if ($deactivate -notmatch $pattern) {
        throw "Remote deactivation is missing a safety invariant: $pattern"
    }
}

Write-Host 'fail-closed-rollback.test.ps1: PASS'
