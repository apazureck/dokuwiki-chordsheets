$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workflow = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot '.github\workflows\demo-deploy.yml')
$runner = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'deployment\web-deploy.php')

foreach ($requiredWorkflowPattern in @(
    'ftp_upload "\$release_archive" "\$\(ftp_path "\$archive_name"\)"',
    'ftp_upload "\$runner_source" "\$\(ftp_path "\$runner_name"\)"',
    'ftp_upload "\$token_file" "\$\(ftp_path "\$token_name"\)"',
    'printf ''%s/%s'' "\$ftp_web_root" "\$name"',
    'token_name="\.deploy-token-\$nonce\.php"',
    'runner_name="deploy-\$nonce\.php"',
    '<\?php exit; __halt_compiler\(\);'
)) {
    if ($workflow -notmatch $requiredWorkflowPattern) {
        throw "Workflow is not compatible with the Webgo FTP chroot: $requiredWorkflowPattern"
    }
}

foreach ($requiredRunnerPattern in @(
    'CHORDSHEETS_DEPLOY_TOKEN_PREFIX',
    'basename\(\$tokenPath\)',
    'copy\(\$tokenPath, "\$staging/\$tokenName"\)',
    '\$documentRoot/\.deploy-token-\$nonce\.php'
)) {
    if ($runner -notmatch $requiredRunnerPattern) {
        throw "Runner does not carry authorization across the atomic switch: $requiredRunnerPattern"
    }
}

Write-Host 'webgo-chroot-policy.test.ps1: PASS'
