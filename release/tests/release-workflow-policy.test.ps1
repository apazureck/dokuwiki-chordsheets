$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Match {
    param(
        [string]$Text,
        [string]$Pattern,
        [string]$Message
    )

    if ($Text -notmatch $Pattern) {
        throw $Message
    }
}

function Assert-NoMatch {
    param(
        [string]$Text,
        [string]$Pattern,
        [string]$Message
    )

    if ($Text -match $Pattern) {
        throw $Message
    }
}

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$releaseWorkflowPath = Join-Path $repositoryRoot '.github\workflows\plugin-release.yml'
$ciWorkflowPath = Join-Path $repositoryRoot '.github\workflows\plugin-ci.yml'

if (-not (Test-Path -LiteralPath $releaseWorkflowPath -PathType Leaf)) {
    throw 'Plugin release workflow is missing.'
}
if (-not (Test-Path -LiteralPath $ciWorkflowPath -PathType Leaf)) {
    throw 'Plugin CI workflow is missing.'
}

$releaseWorkflow = Get-Content -Raw $releaseWorkflowPath
$ciWorkflow = Get-Content -Raw $ciWorkflowPath

Assert-Match $releaseWorkflow "tags:\s*\r?\n\s*-\s*'v\*\.\*\.\*'" (
    'Release workflow must be triggered for version-like tags.'
)
Assert-Match $releaseWorkflow '\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$' (
    'Release workflow must validate semantic version tags before publishing.'
)
Assert-Match $releaseWorkflow 'permissions:\s*\r?\n\s*contents:\s*read' (
    'Release workflow must default to read-only repository access.'
)
Assert-Match $releaseWorkflow 'environment:\s*\r?\n\s*name:\s*release' (
    'GitHub publication must use the protected release environment.'
)
Assert-Match $releaseWorkflow 'contents:\s*write' (
    'GitHub publication needs scoped contents write permission.'
)
Assert-Match $releaseWorkflow 'persist-credentials:\s*false' (
    'Release verification must not persist a write-capable checkout credential.'
)
Assert-Match $releaseWorkflow 'environment:\s*\r?\n\s*name:\s*dokuwiki-registry' (
    'DokuWiki handoff must use its own protected environment.'
)
Assert-Match $releaseWorkflow 'php \./_test/syntax-config-metadata\.test\.php' (
    'Release workflow must run configuration and escaping regressions before publishing.'
)
Assert-Match $releaseWorkflow 'node --test \./_test/\*\.test\.js' (
    'Release workflow must run the complete JavaScript regression suite before publishing.'
)
Assert-Match $releaseWorkflow 'release/build-plugin-zip\.ps1' (
    'Release workflow must use the verified plugin builder.'
)
Assert-Match $releaseWorkflow 'gh release create' (
    'Release workflow must publish an immutable GitHub release.'
)
Assert-Match $releaseWorkflow 'sha256sum' (
    'Release workflow must publish a SHA-256 checksum.'
)
Assert-NoMatch $releaseWorkflow 'DOKUWIKI_(PASSWORD|USERNAME)' (
    'DokuWiki passwords or usernames must not be consumed by the workflow.'
)
Assert-NoMatch $releaseWorkflow 'secrets\.DOKUWIKI_' (
    'The disabled DokuWiki.org API must not encourage unused long-lived secrets.'
)

Assert-Match $ciWorkflow 'pull_request:' 'Plugin CI must run for pull requests.'
Assert-Match $ciWorkflow 'permissions:\s*\r?\n\s*contents:\s*read' (
    'Plugin CI must be read-only.'
)
Assert-Match $ciWorkflow 'node --test \./_test/\*\.test\.js' (
    'Plugin CI must run JavaScript unit tests.'
)
Assert-Match $ciWorkflow 'php \./_test/syntax-postconnect\.test\.php' (
    'Plugin CI must run the postConnect regression test.'
)
Assert-Match $ciWorkflow '\./release/tests/plugin-package\.test\.ps1' (
    'Plugin CI must validate the release package.'
)
Assert-Match $ciWorkflow '\./docker/smoke-test\.ps1' (
    'Plugin CI must run the DokuWiki Docker smoke test.'
)

Write-Host 'release-workflow-policy.test.ps1: PASS'
