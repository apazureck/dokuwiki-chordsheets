$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflowPath = Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml'
$workflow = Get-Content -Raw -LiteralPath $workflowPath

if ($workflow -notmatch 'REMOTE_SHELL_OK') {
    throw 'Workflow must verify remote shell command execution before deployment.'
}

if ($workflow -notmatch 'SSH account does not permit remote Bash command execution') {
    throw 'Workflow must explain a missing remote shell capability.'
}

Write-Host 'remote-shell-policy.test.ps1: PASS'
