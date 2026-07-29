$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflowPath = Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml'
$runnerPath = Join-Path $repositoryRoot 'deployment\web-deploy.php'

if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) {
    throw 'Missing deployment/web-deploy.php.'
}

$workflow = Get-Content -Raw -LiteralPath $workflowPath
$runner = Get-Content -Raw -LiteralPath $runnerPath

foreach ($requiredWorkflowPattern in @(
    '--ssl-reqd',
    'deployment/web-deploy\.php',
    'X-Deploy-Signature:',
    'https://chordsheets\.pazureck\.de',
    'dokuwiki-chordsheets-demo\.zip'
)) {
    if ($workflow -notmatch $requiredWorkflowPattern) {
        throw "Workflow is missing required PHP deployment pattern: $requiredWorkflowPattern"
    }
}

foreach ($forbiddenWorkflowPattern in @(
    'sshpass',
    'StrictHostKeyChecking',
    '\bscp\b',
    'ftp://[^"$]*:[^"$]*@'
)) {
    if ($workflow -match $forbiddenWorkflowPattern) {
        throw "Workflow still contains forbidden SSH or credential-in-URL pattern: $forbiddenWorkflowPattern"
    }
}

foreach ($requiredRunnerPattern in @(
    'hash_hmac',
    'hash_equals',
    'ZipArchive',
    'getExternalAttributesIndex',
    'REQUEST_METHOD',
    'application/json',
    'expires_at',
    'unlink\(__FILE__\)'
)) {
    if ($runner -notmatch $requiredRunnerPattern) {
        throw "PHP runner is missing security control: $requiredRunnerPattern"
    }
}

if ($runner -match 'shell_exec|exec\s*\(|system\s*\(|passthru\s*\(') {
    throw 'PHP runner must not invoke a shell.'
}

if ($runner -match 'HTTP_X_FORWARDED_PROTO') {
    throw 'PHP runner must not trust a client-controlled forwarded-protocol header.'
}

Write-Host 'php-web-deploy-policy.test.ps1: PASS'
