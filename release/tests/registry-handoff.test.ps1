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

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$templatePath = Join-Path $repositoryRoot 'release\dokuwiki-registry.txt'
$documentationPath = Join-Path $repositoryRoot 'release\README.md'

if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
    throw 'DokuWiki registry handoff template is missing.'
}
if (-not (Test-Path -LiteralPath $documentationPath -PathType Leaf)) {
    throw 'Release runbook is missing.'
}

$template = Get-Content -Raw $templatePath
$documentation = Get-Content -Raw $documentationPath

Assert-Match $template '(?m)^lastupdate\s*:\s*2026-07-30\r?$' (
    'Registry handoff date must match plugin.info.txt.'
)
Assert-Match $template '(?m)^compatible\s*:\s*Librarian,\s*Mort\r?$' (
    'Registry handoff must record the DokuWiki releases verified for v0.2.0.'
)
Assert-Match $template (
    'downloadurl\s*:\s*https://github\.com/apazureck/dokuwiki-chordsheets/' +
    'releases/download/v0\.2\.0/dokuwiki-plugin-chordsheets-0\.2\.0\.zip'
) 'Registry handoff must use the immutable v0.2.0 release asset.'
Assert-Match $template '(?m)^bugtracker\s*:\s*https://github\.com/apazureck/dokuwiki-chordsheets/issues\r?$' (
    'Registry handoff must link to the issue tracker.'
)
Assert-Match $template '(?m)^sourcerepo\s*:\s*https://github\.com/apazureck/dokuwiki-chordsheets\r?$' (
    'Registry handoff must link to the source repository.'
)
Assert-Match $template '(?m)^demo\s*:\s*https://chordsheets\.pazureck\.de/\r?$' (
    'Registry handoff must link to the HTTPS demo.'
)

Assert-Match $documentation 'kein OAuth-Device-Flow' (
    'Runbook must document that DokuWiki has no OAuth device flow.'
)
Assert-Match $documentation 'JSON-RPC server not enabled' (
    'Runbook must document why registry publication is a manual handoff.'
)
Assert-Match $documentation '`release`' 'Runbook must document the release environment.'
Assert-Match $documentation '`dokuwiki-registry`' (
    'Runbook must document the DokuWiki registry environment.'
)
Assert-Match $documentation 'keine.*Passw' (
    'Runbook must explicitly forbid storing a DokuWiki password.'
)

Write-Host 'registry-handoff.test.ps1: PASS'
