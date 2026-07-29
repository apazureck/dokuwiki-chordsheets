$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflowPath = Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml'
$remoteDeployPath = Join-Path $repositoryRoot 'deployment\remote-deploy.sh'
$remoteRollbackPath = Join-Path $repositoryRoot 'deployment\remote-rollback.sh'

function Assert-Match {
    param([string]$Content, [string]$Pattern, [string]$Message)
    if ($Content -notmatch $Pattern) { throw $Message }
}

function Assert-NoMatch {
    param([string]$Content, [string]$Pattern, [string]$Message)
    if ($Content -match $Pattern) { throw $Message }
}

foreach ($requiredPath in @($workflowPath, $remoteDeployPath, $remoteRollbackPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Missing deployment file: $requiredPath"
    }
}

$workflow = Get-Content -Raw -LiteralPath $workflowPath
$remoteDeploy = Get-Content -Raw -LiteralPath $remoteDeployPath
$remoteRollback = Get-Content -Raw -LiteralPath $remoteRollbackPath

Assert-Match $workflow '(?m)^\s*workflow_dispatch:\s*$' 'Workflow must be manually dispatched.'
Assert-NoMatch $workflow '(?m)^\s*(push|pull_request|pull_request_target|schedule):\s*$' 'Workflow must not deploy automatically.'
Assert-Match $workflow '(?ms)^permissions:\s*\r?\n\s*contents:\s*read\s*$' 'Workflow permissions must be read-only.'
Assert-Match $workflow '(?m)^\s*environment:\s*demo\s*$' 'Deploy job must use the demo environment.'
Assert-Match $workflow '(?m)^\s*cancel-in-progress:\s*false\s*$' 'Deployments must not cancel one another.'
Assert-Match $workflow 'actions/checkout@[a-f0-9]{40}' 'Checkout action must be commit-pinned.'
Assert-Match $workflow 'StrictHostKeyChecking=yes' 'SSH must enforce host-key checking.'
Assert-NoMatch $workflow 'StrictHostKeyChecking=no' 'SSH host-key checks must never be disabled.'
Assert-Match $workflow 'GlobalKnownHostsFile=/dev/null' 'SSH must not consult global host keys.'
Assert-NoMatch $workflow '(?i)ftp://|port\s*[:=]\s*21' 'Plain FTP is forbidden.'
Assert-Match $workflow '\$\{\{\s*vars\.FTP_KNOWN_HOSTS\s*\}\}' 'Workflow must use verified known hosts.'
Assert-Match $workflow '\[\[\s+"\$FTP_REMOTE_PATH"\s+==\s+''/home/www/chordsheets-demo''\s+\]\]' 'Workflow must pin the remote path.'
Assert-NoMatch $workflow '\|\|\s*true' 'Rollback failures must not be ignored.'
Assert-Match $workflow 'dokuwiki-chordsheets-demo\.zip' 'Workflow must deploy one ZIP artifact.'
Assert-NoMatch $workflow 'dokuwiki-chordsheets-demo\.tgz' 'Workflow must not deploy a tarball.'
Assert-Match $workflow 'mktemp.+\.upload\.\$GITHUB_SHA\.XXXXXX' 'Workflow must create a random server upload path.'
Assert-Match $workflow 'rollback_state=' 'Workflow must inspect server state after rollback.'
Assert-Match $workflow 'rollback_verification_failed' 'Workflow must verify a restored release after rollback.'

$scpCount = [regex]::Matches($workflow, 'sshpass\s+-e\s+scp').Count
if ($scpCount -ne 1) {
    throw "Workflow must contain exactly one SCP upload, found $scpCount."
}

$secretReferences = [regex]::Matches($workflow, 'secrets\.([A-Z0-9_]+)') |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique
$expectedSecrets = @('FTP_PASSWORD', 'FTP_SERVER', 'FTP_USERNAME')
if (($secretReferences -join ',') -ne ($expectedSecrets -join ',')) {
    throw "Unexpected secret references: $($secretReferences -join ', ')"
}

Assert-Match $remoteDeploy 'unzip\s+-tqq' 'Remote deploy must CRC-test the ZIP.'
Assert-Match $remoteDeploy 'unzip\s+-q\s+"\$archive"\s+-d\s+"\$staging"' 'Remote deploy must extract into fresh staging.'
Assert-Match $remoteDeploy 'zipinfo\s+-l' 'Remote deploy must inspect ZIP entry types.'
Assert-Match $remoteDeploy '\.deploy\.lock' 'Remote deploy must serialize server operations.'
Assert-Match $remoteDeploy 'Persistent tree contains a link or special file' 'Remote deploy must reject unsafe persistent entries.'
Assert-NoMatch $remoteDeploy 'tar\s+-[ctx].*zf' 'Remote deploy must not use tar for the release.'
Assert-Match $remoteDeploy 'test ! -e|!\s+-e' 'Remote deploy must reject install.php.'
Assert-Match $remoteRollback '\^\[a-f0-9\]\{40\}\$' 'Rollback must require a full Git SHA.'
Assert-Match $remoteRollback '\.deploy\.lock' 'Rollback must use the deployment lock.'
Assert-Match $remoteRollback 'lib/plugins/chordsheets/syntax\.php' 'Rollback must verify the plugin entry point.'
Assert-NoMatch ($remoteDeploy + $remoteRollback) 'chmod\s+-R\s+777|rm\s+-rf\s+["'']?\$(root|remote_root)' 'Remote scripts contain an unsafe broad mutation.'

Write-Host 'workflow-policy.test.ps1: PASS'
