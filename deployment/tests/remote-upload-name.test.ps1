$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflow = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml')
$preflight = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'deployment\remote-upload-preflight.sh')

foreach ($pattern in @(
    'deployment/remote-upload-preflight\.sh',
    '\^UPLOAD:\(\\\.upload\\\.\$GITHUB_SHA',
    'BASH_REMATCH\[1\]',
    'remote_archive="\$FTP_REMOTE_PATH/uploads/\$upload_name"'
)) {
    if ($workflow -notmatch $pattern) {
        throw "Workflow is missing the validated remote upload-name protocol: $pattern"
    }
}

if ($preflight -notmatch 'printf ''UPLOAD:%s''') {
    throw 'Remote preflight must emit only the upload-name protocol response.'
}

Write-Host 'remote-upload-name.test.ps1: PASS'
