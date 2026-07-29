$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflow = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml')

foreach ($pattern in @(
    'printf ''UPLOAD:%s''',
    '\^UPLOAD:\(\\\.upload\\\.\$GITHUB_SHA',
    'BASH_REMATCH\[1\]',
    'remote_archive="\$FTP_REMOTE_PATH/uploads/\$upload_name"'
)) {
    if ($workflow -notmatch $pattern) {
        throw "Workflow is missing the validated remote upload-name protocol: $pattern"
    }
}

Write-Host 'remote-upload-name.test.ps1: PASS'
