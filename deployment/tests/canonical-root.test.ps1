$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflow = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml')
$scripts = @(
    'deployment\remote-deploy.sh',
    'deployment\remote-rollback.sh',
    'deployment\remote-deactivate.sh'
) | ForEach-Object {
    Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot $_)
}

if ($workflow -notmatch "realpath -e '/home/www'") {
    throw 'Upload preflight must canonicalize the Webgo parent directory.'
}
if ($workflow -notmatch 'canonical_remote_root') {
    throw 'Upload preflight must compare the canonical direct-child target.'
}

foreach ($script in $scripts) {
    if ($script -notmatch 'canonical_parent=.*realpath -e /home/www') {
        throw 'Remote operation must canonicalize the Webgo parent directory.'
    }
    if ($script -notmatch 'canonical_root') {
        throw 'Remote operation must compare the canonical direct-child target.'
    }
    if ($script -notmatch '!\s+-L\s+"\$(root|remote_root)"') {
        throw 'Remote operation must reject a symlink at the deployment root.'
    }
}

Write-Host 'canonical-root.test.ps1: PASS'
