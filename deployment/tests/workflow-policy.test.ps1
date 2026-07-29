$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflowPath = Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml'
$runnerPath = Join-Path $repositoryRoot 'deployment\web-deploy.php'

function Assert-Match {
    param([string]$Content, [string]$Pattern, [string]$Message)
    if ($Content -notmatch $Pattern) { throw $Message }
}

function Assert-NoMatch {
    param([string]$Content, [string]$Pattern, [string]$Message)
    if ($Content -match $Pattern) { throw $Message }
}

foreach ($requiredPath in @($workflowPath, $runnerPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Missing deployment file: $requiredPath"
    }
}

$workflow = Get-Content -Raw -LiteralPath $workflowPath
$runner = Get-Content -Raw -LiteralPath $runnerPath

Assert-Match $workflow '(?m)^\s*workflow_dispatch:\s*$' 'Workflow must be manually dispatched.'
Assert-NoMatch $workflow '(?m)^\s*(push|pull_request|pull_request_target|schedule):\s*$' 'Workflow must not deploy automatically.'
Assert-Match $workflow '(?ms)^permissions:\s*\r?\n\s*contents:\s*read\s*$' 'Workflow permissions must be read-only.'
Assert-Match $workflow '(?m)^\s*environment:\s*demo\s*$' 'Deploy job must use the demo environment.'
Assert-Match $workflow '(?m)^\s*cancel-in-progress:\s*false\s*$' 'Deployments must not cancel one another.'
Assert-Match $workflow 'actions/checkout@[a-f0-9]{40}' 'Checkout action must be commit-pinned.'
Assert-Match $workflow 'composer:2@sha256:[a-f0-9]{64}' 'PHP integration image must be digest-pinned.'
Assert-Match $workflow '--ssl-reqd' 'FTP transport must require TLS.'
Assert-Match $workflow '--proto ''=https''' 'Deployment activation must require HTTPS.'
Assert-Match $workflow 'X-Deploy-Signature:' 'Deployment request must carry an HMAC signature.'
Assert-Match $workflow 'openssl dgst -sha256 -mac HMAC' 'Pipeline must compute the deployment HMAC locally.'
Assert-Match $workflow 'deployment_may_be_active' 'Pipeline must track potentially active releases.'
Assert-Match $workflow 'invoke_runner rollback rolled_back' 'Pipeline must roll back failed deployments.'
Assert-Match $workflow 'ftp_delete "/current/\$runner_name"' 'Pipeline must clean up the transient PHP runner.'
Assert-Match $workflow 'dokuwiki-chordsheets-demo\.zip' 'Workflow must deploy one ZIP artifact.'
Assert-NoMatch $workflow 'dokuwiki-chordsheets-demo\.tgz' 'Workflow must not deploy a tarball.'
Assert-NoMatch $workflow 'sshpass|\bscp\b|StrictHostKeyChecking|UserKnownHostsFile' 'Workflow must not require an SSH shell.'
Assert-NoMatch $workflow 'ftp://[^"$\r\n]*:[^"$\r\n]*@' 'Credentials must not be embedded in an FTP URL.'
Assert-NoMatch $workflow '--insecure|-k(?:\s|$)' 'TLS verification must never be disabled.'
Assert-NoMatch $workflow '\|\|\s*true' 'Deployment or rollback failures must not be ignored.'

$uploadCount = [regex]::Matches($workflow, 'ftp_upload\s+"').Count
if ($uploadCount -ne 3) {
    throw "Workflow must upload one ZIP plus one token and one runner, found $uploadCount uploads."
}

$secretReferences = [regex]::Matches($workflow, 'secrets\.([A-Z0-9_]+)') |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique
$expectedSecrets = @('FTP_PASSWORD', 'FTP_SERVER', 'FTP_USERNAME')
if (($secretReferences -join ',') -ne ($expectedSecrets -join ',')) {
    throw "Unexpected secret references: $($secretReferences -join ', ')"
}

Assert-Match $runner 'hash_hmac' 'PHP runner must verify HMAC requests.'
Assert-Match $runner 'hash_equals' 'PHP runner must use constant-time signature comparison.'
Assert-Match $runner 'ZipArchive' 'PHP runner must use PHP ZIP extraction.'
Assert-Match $runner 'getExternalAttributesIndex' 'PHP runner must inspect ZIP entry types.'
Assert-Match $runner '536_870_912' 'PHP runner must cap expanded archive size.'
Assert-Match $runner '25_000' 'PHP runner must cap ZIP entry count.'
Assert-NoMatch $runner 'shell_exec|exec\s*\(|system\s*\(|passthru\s*\(' 'PHP runner must not invoke a shell.'

Write-Host 'workflow-policy.test.ps1: PASS'
