$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflowPath = Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml'
$preflightPath = Join-Path $repositoryRoot 'deployment\remote-upload-preflight.sh'
$deactivatePath = Join-Path $repositoryRoot 'deployment\remote-deactivate.sh'

foreach ($requiredPath in @($preflightPath, $deactivatePath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Missing fail-closed deployment script: $requiredPath"
    }
}

$workflow = Get-Content -Raw -LiteralPath $workflowPath
$preflight = Get-Content -Raw -LiteralPath $preflightPath
$deactivate = Get-Content -Raw -LiteralPath $deactivatePath

foreach ($pattern in @(
    'deployment/remote-upload-preflight\.sh',
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
    'canonical_root=.*realpath -e -- "\$root"',
    'canonical_uploads=.*realpath -e -- "\$uploads"'
)) {
    if ($preflight -notmatch $pattern) {
        throw "Remote preflight is missing fail-closed path protection: $pattern"
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
