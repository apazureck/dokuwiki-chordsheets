$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflow = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml')

foreach ($requiredPattern in @(
    'web_root_candidates=\(',
    "'' '/current' '/chordsheets-demo/current'",
    'probe_name="deploy-probe-\$nonce\.txt"',
    'printf ''%s'' "\$nonce" > "\$probe_file"',
    'ftp_upload "\$probe_file" "\$candidate/\$probe_name"',
    'curl --fail --silent --show-error',
    '"\$DEMO_URL/\$probe_name"',
    '\[\[ "\$probe_response" == "\$nonce" \]\]',
    'ftp_delete "\$candidate/\$probe_name"',
    'ftp_web_root=\$candidate'
)) {
    if ($workflow -notmatch $requiredPattern) {
        throw "Workflow is missing safe web-root discovery: $requiredPattern"
    }
}

if ($workflow -match '--ftp-create-dirs') {
    throw 'Web-root discovery must not create candidate directories.'
}

if ($workflow -match '(?m)^\s*(?:curl|ftp_upload).*(?:LIST|--list-only).*(?:\$ftp_base|FTP_SERVER)') {
    throw 'Web-root discovery must not expose a remote directory listing.'
}

Write-Host 'webroot-discovery-policy.test.ps1: PASS'
