<?php

declare(strict_types=1);

const CHORDSHEETS_DEPLOY_TOKEN_PREFIX = "<?php exit; __halt_compiler();\n";

final class ChordsheetsDeployException extends RuntimeException
{
    public function __construct(string $message, public readonly int $httpStatus = 400)
    {
        parent::__construct($message);
    }
}

function chordsheetsDeployFail(string $message, int $status = 400): never
{
    throw new ChordsheetsDeployException($message, $status);
}

function chordsheetsDeployCanonicalRequest(array $request): string
{
    return implode("\n", [
        (string) ($request['action'] ?? ''),
        (string) ($request['nonce'] ?? ''),
        (string) ($request['sha'] ?? ''),
        (string) ($request['timestamp'] ?? ''),
        (string) ($request['archive_sha256'] ?? ''),
    ]);
}

function chordsheetsDeployRemoveTree(string $path): void
{
    if (is_link($path) || is_file($path)) {
        if (!unlink($path)) {
            chordsheetsDeployFail('Deployment cleanup failed.', 500);
        }
        return;
    }
    if (!is_dir($path)) {
        return;
    }
    foreach (new FilesystemIterator($path, FilesystemIterator::SKIP_DOTS) as $entry) {
        chordsheetsDeployRemoveTree($entry->getPathname());
    }
    if (!rmdir($path)) {
        chordsheetsDeployFail('Deployment cleanup failed.', 500);
    }
}

function chordsheetsDeployWriteFile(string $path, string $contents, int $mode = 0600): void
{
    $temporary = $path . '.tmp.' . bin2hex(random_bytes(8));
    if (file_put_contents($temporary, $contents, LOCK_EX) === false) {
        chordsheetsDeployFail('Could not write deployment state.', 500);
    }
    chmod($temporary, $mode);
    if (!rename($temporary, $path)) {
        @unlink($temporary);
        chordsheetsDeployFail('Could not activate deployment state.', 500);
    }
}

function chordsheetsDeployReadToken(string $tokenPath): array
{
    if (!is_file($tokenPath) || is_link($tokenPath)) {
        chordsheetsDeployFail('Deployment authorization is unavailable.', 403);
    }
    $size = filesize($tokenPath);
    if (!is_int($size) || $size < 1 || $size > 4096) {
        chordsheetsDeployFail('Deployment authorization is invalid.', 403);
    }
    $contents = file_get_contents($tokenPath);
    if (!is_string($contents)
        || !str_starts_with($contents, CHORDSHEETS_DEPLOY_TOKEN_PREFIX)) {
        chordsheetsDeployFail('Deployment authorization is invalid.', 403);
    }
    try {
        $token = json_decode(
            substr($contents, strlen(CHORDSHEETS_DEPLOY_TOKEN_PREFIX)),
            true,
            16,
            JSON_THROW_ON_ERROR
        );
    } catch (JsonException) {
        chordsheetsDeployFail('Deployment authorization is invalid.', 403);
    }
    if (!is_array($token)) {
        chordsheetsDeployFail('Deployment authorization is invalid.', 403);
    }
    return $token;
}

function chordsheetsDeploySaveToken(string $tokenPath, array $token): void
{
    chordsheetsDeployWriteFile(
        $tokenPath,
        CHORDSHEETS_DEPLOY_TOKEN_PREFIX
        . json_encode($token, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
        0600
    );
}

function chordsheetsDeployValidateAuthorization(
    array $request,
    string $signature,
    array $token
): void {
    $action = $request['action'] ?? null;
    $nonce = $request['nonce'] ?? null;
    $sha = $request['sha'] ?? null;
    $timestamp = $request['timestamp'] ?? null;
    $archiveHash = $request['archive_sha256'] ?? null;

    if (!is_string($action) || !in_array($action, ['deploy', 'commit', 'rollback'], true)) {
        chordsheetsDeployFail('Invalid deployment request.');
    }
    if (!is_string($nonce) || !preg_match('/^[a-f0-9]{32}$/D', $nonce)) {
        chordsheetsDeployFail('Invalid deployment request.');
    }
    if (!is_string($sha) || !preg_match('/^[a-f0-9]{40}$/D', $sha)) {
        chordsheetsDeployFail('Invalid deployment request.');
    }
    if (!is_int($timestamp) || abs(time() - $timestamp) > 300) {
        chordsheetsDeployFail('Deployment request expired.', 403);
    }
    if (!is_string($archiveHash) || !preg_match('/^[a-f0-9]{64}$/D', $archiveHash)) {
        chordsheetsDeployFail('Invalid deployment request.');
    }
    if (!preg_match('/^[a-f0-9]{64}$/D', $signature)) {
        chordsheetsDeployFail('Deployment signature is invalid.', 403);
    }

    $expectedToken = [
        'version' => 1,
        'nonce' => $nonce,
        'sha' => $sha,
        'archive_sha256' => $archiveHash,
    ];
    foreach ($expectedToken as $key => $value) {
        if (($token[$key] ?? null) !== $value) {
            chordsheetsDeployFail('Deployment authorization does not match.', 403);
        }
    }
    if (($token['archive'] ?? null) !== ".release-$nonce.zip") {
        chordsheetsDeployFail('Deployment authorization is invalid.', 403);
    }
    if (!isset($token['secret']) || !is_string($token['secret'])
        || !preg_match('/^[a-f0-9]{64}$/D', $token['secret'])) {
        chordsheetsDeployFail('Deployment authorization is invalid.', 403);
    }
    if (!isset($token['expires_at']) || !is_int($token['expires_at']) || time() > $token['expires_at']) {
        chordsheetsDeployFail('Deployment authorization expired.', 403);
    }

    $expectedSignature = hash_hmac(
        'sha256',
        chordsheetsDeployCanonicalRequest($request),
        $token['secret']
    );
    if (!hash_equals($expectedSignature, $signature)) {
        chordsheetsDeployFail('Deployment signature is invalid.', 403);
    }

    $expectedPhase = $action === 'deploy' ? 'uploaded' : 'active';
    if (($token['phase'] ?? null) !== $expectedPhase) {
        chordsheetsDeployFail('Deployment action is not valid in the current state.', 409);
    }
}

function chordsheetsDeployValidateArchive(string $archivePath, string $expectedHash): void
{
    if (!class_exists(ZipArchive::class)) {
        chordsheetsDeployFail('Server PHP ZIP support is unavailable.', 500);
    }
    if (!is_file($archivePath) || is_link($archivePath)) {
        chordsheetsDeployFail('Deployment archive is unavailable.', 400);
    }
    $archiveSize = filesize($archivePath);
    if (!is_int($archiveSize) || $archiveSize < 1 || $archiveSize > 67_108_864) {
        chordsheetsDeployFail('Deployment archive size is invalid.');
    }
    if (!hash_equals($expectedHash, hash_file('sha256', $archivePath))) {
        chordsheetsDeployFail('Deployment archive checksum mismatch.');
    }

    $zip = new ZipArchive();
    if ($zip->open($archivePath, ZipArchive::RDONLY) !== true) {
        chordsheetsDeployFail('Deployment archive could not be opened.');
    }
    try {
        if ($zip->numFiles < 1 || $zip->numFiles > 25_000) {
            chordsheetsDeployFail('Deployment archive entry count is invalid.');
        }
        $seen = [];
        $unpackedBytes = 0;
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $stat = $zip->statIndex($index, ZipArchive::FL_UNCHANGED);
            if (!is_array($stat) || !isset($stat['name'], $stat['size'], $stat['comp_size'])) {
                chordsheetsDeployFail('Deployment archive metadata is invalid.');
            }
            $name = $stat['name'];
            if (!is_string($name)
                || $name === ''
                || str_starts_with($name, '/')
                || str_contains($name, '\\')
                || str_contains($name, '//')
                || !preg_match('#^[A-Za-z0-9._+@/-]+$#D', $name)
                || in_array('..', explode('/', trim($name, '/')), true)) {
                chordsheetsDeployFail('Deployment archive contains an unsafe path.');
            }
            $folded = strtolower(rtrim($name, '/'));
            if ($folded === '' || isset($seen[$folded])) {
                chordsheetsDeployFail('Deployment archive contains duplicate paths.');
            }
            $seen[$folded] = true;

            $operatingSystem = 0;
            $attributes = 0;
            if ($zip->getExternalAttributesIndex($index, $operatingSystem, $attributes)) {
                $fileType = ($attributes >> 16) & 0xF000;
                if ($fileType !== 0 && $fileType !== 0x8000 && $fileType !== 0x4000) {
                    chordsheetsDeployFail('Deployment archive contains a link or special file.');
                }
            }

            $unpackedBytes += (int) $stat['size'];
            if ($unpackedBytes > 536_870_912) {
                chordsheetsDeployFail('Deployment archive expands beyond the size limit.');
            }
        }
        if ($unpackedBytes > $archiveSize * 200) {
            chordsheetsDeployFail('Deployment archive compression ratio is unsafe.');
        }
    } finally {
        $zip->close();
    }
}

function chordsheetsDeployExtractArchive(string $archivePath, string $staging): void
{
    $zip = new ZipArchive();
    if ($zip->open($archivePath, ZipArchive::RDONLY) !== true) {
        chordsheetsDeployFail('Deployment archive could not be opened.');
    }
    try {
        if (!$zip->extractTo($staging)) {
            chordsheetsDeployFail('Deployment archive could not be extracted.', 500);
        }
    } finally {
        $zip->close();
    }
}

function chordsheetsDeployAssertTreeSafe(string $path): void
{
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($iterator as $entry) {
        if ($entry->isLink() || (!$entry->isFile() && !$entry->isDir())) {
            chordsheetsDeployFail('Expanded deployment contains a link or special file.');
        }
    }
}

function chordsheetsDeploySetReleasePermissions(string $path): void
{
    if (!chmod($path, 0755)) {
        chordsheetsDeployFail('Could not set release permissions.', 500);
    }
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($iterator as $entry) {
        if ($entry->isLink()) {
            continue;
        }
        $mode = $entry->isDir() ? 0755 : 0644;
        if (!chmod($entry->getPathname(), $mode)) {
            chordsheetsDeployFail('Could not set release permissions.', 500);
        }
    }
}

function chordsheetsDeployPrepareShared(string $root, string $staging, string $sha): void
{
    $shared = "$root/shared";
    $sharedConf = "$shared/conf";
    $sharedData = "$shared/data";
    if ((file_exists($shared) || is_link($shared)) && (!is_dir($shared) || is_link($shared))) {
        chordsheetsDeployFail('Shared deployment path is unsafe.', 500);
    }
    if (!is_dir($shared) && !mkdir($shared, 0700, true)) {
        chordsheetsDeployFail('Could not create shared deployment storage.', 500);
    }

    if (!is_dir($sharedConf)) {
        if (!is_dir("$staging/conf") || !rename("$staging/conf", $sharedConf)) {
            chordsheetsDeployFail('Could not initialize shared configuration.', 500);
        }
    } else {
        if (is_link($sharedConf)) {
            chordsheetsDeployFail('Shared configuration path is unsafe.', 500);
        }
        chordsheetsDeployRemoveTree("$staging/conf");
    }

    if (!is_dir($sharedData)) {
        foreach ([
            'attic', 'cache', 'index', 'locks', 'media', 'media_attic',
            'media_meta', 'meta', 'pages', 'tmp',
        ] as $directory) {
            if (!mkdir("$sharedData/$directory", 0700, true) && !is_dir("$sharedData/$directory")) {
                chordsheetsDeployFail('Could not initialize shared wiki data.', 500);
            }
        }
    } elseif (is_link($sharedData)) {
        chordsheetsDeployFail('Shared data path is unsafe.', 500);
    }

    $demoPage = "$staging/lib/plugins/chordsheets/demo/start.txt";
    $demoLogo = "$staging/lib/plugins/chordsheets/img/chordsheets-logo.png";
    $demoPageContents = is_file($demoPage) ? file_get_contents($demoPage) : false;
    if (!is_string($demoPageContents) || !is_file($demoLogo)) {
        chordsheetsDeployFail('Demo website assets are missing.', 500);
    }
    if (!is_dir("$sharedData/media/wiki")
        && !mkdir("$sharedData/media/wiki", 0700, true)) {
        chordsheetsDeployFail('Could not initialize demo media storage.', 500);
    }
    chordsheetsDeployWriteFile("$sharedData/pages/start.txt", $demoPageContents);
    if (!copy($demoLogo, "$sharedData/media/wiki/logo.png")) {
        chordsheetsDeployFail('Could not publish the demo logo.', 500);
    }
    chmod("$sharedData/media/wiki/logo.png", 0600);

    chordsheetsDeployWriteFile(
        "$sharedConf/local.php",
        "<?php\n"
        . "\$conf['title'] = 'DokuWiki Chordsheets Demo';\n"
        . "\$conf['tagline'] = 'Interactive chord sheets for DokuWiki';\n"
        . "\$conf['lang'] = 'en';\n"
        . "\$conf['license'] = 'cc-by-sa';\n"
        . "\$conf['useacl'] = 1;\n"
        . "\$conf['superuser'] = '@admin';\n"
        . "\$conf['authtype'] = 'authplain';\n"
        . "\$conf['disableactions'] = 'register';\n"
        . "\$conf['breadcrumbs'] = 0;\n"
        . "\$conf['youarehere'] = 0;\n"
    );
    chordsheetsDeployWriteFile(
        "$sharedConf/acl.auth.php",
        "# acl.auth.php\n# <?php exit()?>\n"
        . "*               @ALL        1\n"
        . "*               @user       1\n"
        . "demo:*          @user       2\n"
        . "playground:*    @user       2\n"
    );
    if (!file_exists("$sharedConf/users.auth.php")) {
        chordsheetsDeployWriteFile(
            "$sharedConf/users.auth.php",
            "# users.auth.php\n# <?php exit()?>\n"
        );
    }
    $deny = "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
        . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n";
    chordsheetsDeployWriteFile("$sharedConf/.htaccess", $deny);
    chordsheetsDeployWriteFile("$sharedData/.htaccess", $deny);

    if (!symlink('../../shared/conf', "$staging/conf")
        || !symlink('../../shared/data', "$staging/data")) {
        chordsheetsDeployFail('Could not link shared DokuWiki storage.', 500);
    }
}

function chordsheetsDeployActivate(
    string $root,
    string $documentRoot,
    string $scriptPath,
    string $tokenPath,
    array $token
): array {
    $sha = $token['sha'];
    $nonce = $token['nonce'];
    $archivePath = "$documentRoot/{$token['archive']}";
    $releases = "$root/releases";
    $release = "$releases/$sha";
    $staging = "$releases/.$sha.$nonce.tmp";
    $holder = "$root/.previous-$nonce";
    $next = "$root/current.next-$nonce";
    $runnerName = basename($scriptPath);
    $tokenName = basename($tokenPath);

    if (!preg_match('/^deploy-' . preg_quote($nonce, '/') . '\.php$/D', $runnerName)) {
        chordsheetsDeployFail('Deployment runner name is invalid.', 400);
    }
    if ($tokenName !== ".deploy-token-$nonce.php") {
        chordsheetsDeployFail('Deployment token name is invalid.', 400);
    }
    chordsheetsDeployValidateArchive($archivePath, $token['archive_sha256']);
    if (!is_dir($releases) && !mkdir($releases, 0755, true)) {
        chordsheetsDeployFail('Could not create release storage.', 500);
    }
    if (!chmod($releases, 0755)) {
        chordsheetsDeployFail('Could not set release storage permissions.', 500);
    }
    foreach ([$release, $staging, $holder, $next] as $managedPath) {
        if (file_exists($managedPath) || is_link($managedPath)) {
            chordsheetsDeployFail('Deployment state conflicts with an existing path.', 409);
        }
    }
    if (!mkdir($staging, 0700)) {
        chordsheetsDeployFail('Could not create release staging.', 500);
    }

    $switched = false;
    try {
        chordsheetsDeployExtractArchive($archivePath, $staging);
        chordsheetsDeployAssertTreeSafe($staging);
        foreach ([
            "$staging/doku.php",
            "$staging/inc/init.php",
            "$staging/lib/plugins/chordsheets/syntax.php",
        ] as $requiredPath) {
            if (!is_file($requiredPath) || is_link($requiredPath)) {
                chordsheetsDeployFail('Deployment archive is missing required application files.');
            }
        }
        if (file_exists("$staging/install.php")
            || file_exists("$staging/data")
            || file_exists("$staging/conf/local.php")) {
            chordsheetsDeployFail('Deployment archive contains forbidden mutable files.');
        }

        chordsheetsDeployPrepareShared($root, $staging, $sha);
        chordsheetsDeploySetReleasePermissions($staging);
        if (!copy($scriptPath, "$staging/$runnerName")) {
            chordsheetsDeployFail('Could not stage deployment runner.', 500);
        }
        chmod("$staging/$runnerName", 0600);
        if (!rename($staging, $release)) {
        if (!copy($tokenPath, "$staging/$tokenName")) {
            chordsheetsDeployFail('Could not stage deployment authorization.', 500);
        }
        chmod("$staging/$tokenName", 0600);
            chordsheetsDeployFail('Could not finalize release staging.', 500);
        }

        if (is_link($documentRoot)) {
            $oldTarget = readlink($documentRoot);
            if (!is_string($oldTarget)
                || !preg_match('#^releases/[a-f0-9]{40}$#D', $oldTarget)
                || !is_dir("$root/$oldTarget")) {
                chordsheetsDeployFail('Current deployment target is invalid.', 500);
            }
            $previousKind = 'symlink';
        } elseif (is_dir($documentRoot)) {
            $oldTarget = null;
            $previousKind = 'directory';
        } else {
            chordsheetsDeployFail('Current deployment root is unavailable.', 500);
        }

        if (!symlink("releases/$sha", $next)) {
            chordsheetsDeployFail('Could not prepare release activation.', 500);
        }
        if (!rename($documentRoot, $holder)) {
            chordsheetsDeployFail('Could not preserve current deployment.', 500);
        }
        if (!rename($next, $documentRoot)) {
            @rename($holder, $documentRoot);
            chordsheetsDeployFail('Could not activate release.', 500);
        }
        $switched = true;

        $token['phase'] = 'active';
        $token['runner'] = $runnerName;
        $token['holder'] = basename($holder);
        $token['previous_kind'] = $previousKind;
        $token['previous_target'] = $oldTarget;
        chordsheetsDeploySaveToken($tokenPath, $token);
    } catch (Throwable $exception) {
        if ($switched && (is_link($documentRoot) || is_dir($documentRoot))) {
            $failed = "$root/.failed-$nonce";
            if (!file_exists($failed) && !is_link($failed)
                && rename($documentRoot, $failed)
                && rename($holder, $documentRoot)) {
                chordsheetsDeployRemoveTree($failed);
            }
        }
        if (is_dir($staging) && !is_link($staging)) {
            chordsheetsDeployRemoveTree($staging);
        }
        if (is_dir($release) && !is_link($release)
            && (!is_link($documentRoot) || readlink($documentRoot) !== "releases/$sha")) {
            chordsheetsDeployRemoveTree($release);
        }
        throw $exception;
    }

    return ['ok' => true, 'state' => 'active', 'release' => $sha];
}

function chordsheetsDeployFinish(
    string $root,
    string $documentRoot,
    string $scriptPath,
    string $tokenPath,
    array $token,
    bool $rollback
): array {
    $nonce = $token['nonce'];
    $sha = $token['sha'];
    $runnerName = $token['runner'] ?? '';
    $holderName = $token['holder'] ?? '';
    $tokenName = basename($tokenPath);
    if ($runnerName !== basename($scriptPath)
        || !preg_match('/^deploy-' . preg_quote($nonce, '/') . '\.php$/D', $runnerName)
        || $holderName !== ".previous-$nonce"
        || $tokenName !== ".deploy-token-$nonce.php") {
        chordsheetsDeployFail('Deployment state is invalid.', 500);
    }
    $holder = "$root/$holderName";
    $archivePath = "$holder/{$token['archive']}";
    $release = "$root/releases/$sha";
    if (!is_link($documentRoot) || readlink($documentRoot) !== "releases/$sha") {
        chordsheetsDeployFail('Active deployment does not match the request.', 409);
    }

    if ($rollback) {
        $failedLink = "$root/.failed-$nonce";
        if (file_exists($failedLink) || is_link($failedLink)
            || (!is_link($holder) && !is_dir($holder))) {
            chordsheetsDeployFail('Rollback state is invalid.', 500);
        }
        if (!rename($documentRoot, $failedLink) || !rename($holder, $documentRoot)) {
            @rename($failedLink, $documentRoot);
            chordsheetsDeployFail('Could not restore previous deployment.', 500);
        }
        @unlink($failedLink);
        @unlink("$documentRoot/$runnerName");
        @unlink("$documentRoot/$tokenName");
        @unlink("$documentRoot/{$token['archive']}");
        if (is_dir($release) && !is_link($release)) {
            chordsheetsDeployRemoveTree($release);
        }
        return ['ok' => true, 'state' => 'rolled_back', 'release' => $sha];
    }

    @unlink("$holder/$runnerName");
    if (($token['previous_kind'] ?? null) === 'symlink') {
        $previous = "$root/previous";
    @unlink("$holder/$tokenName");
    @unlink($archivePath);
        if (file_exists($previous) && !is_link($previous)) {
            chordsheetsDeployFail('Previous deployment pointer is unsafe.', 500);
        }
        if (is_link($previous)) {
            unlink($previous);
        }
        if (!rename($holder, $previous)) {
            chordsheetsDeployFail('Could not retain previous deployment pointer.', 500);
        }
    }
    @unlink($tokenPath);
    @unlink($scriptPath);
    return ['ok' => true, 'state' => 'committed', 'release' => $sha];
}

function chordsheetsDeployExecute(
    array $request,
    string $signature,
    string $documentRoot,
    string $scriptPath
): array {
    $documentRoot = rtrim($documentRoot, DIRECTORY_SEPARATOR);
    if (basename($documentRoot) !== 'current') {
        chordsheetsDeployFail('Deployment document root is invalid.', 500);
    }
    $root = dirname($documentRoot);
    if (!is_dir($root) || is_link($root)) {
        chordsheetsDeployFail('Deployment root is invalid.', 500);
    }
    $nonce = $request['nonce'] ?? '';
    if (!is_string($nonce) || !preg_match('/^[a-f0-9]{32}$/D', $nonce)) {
        chordsheetsDeployFail('Invalid deployment request.');
    }
    $tokenPath = "$documentRoot/.deploy-token-$nonce.php";
    $token = chordsheetsDeployReadToken($tokenPath);
    chordsheetsDeployValidateAuthorization($request, $signature, $token);

    $lockPath = "$root/.deploy.lock";
    $lock = @fopen($lockPath, 'x');
    if ($lock === false) {
        chordsheetsDeployFail('Another deployment is active.', 409);
    }
    chmod($lockPath, 0600);
    try {
        fwrite($lock, $nonce);
        return match ($request['action']) {
            'deploy' => chordsheetsDeployActivate(
                $root,
                $documentRoot,
                $scriptPath,
                $tokenPath,
                $token
            ),
            'commit' => chordsheetsDeployFinish(
                $root,
                $documentRoot,
                $scriptPath,
                $tokenPath,
                $token,
                false
            ),
            'rollback' => chordsheetsDeployFinish(
                $root,
                $documentRoot,
                $scriptPath,
                $tokenPath,
                $token,
                true
            ),
        };
    } finally {
        fclose($lock);
        if (is_file($lockPath) && !is_link($lockPath)) {
            @unlink($lockPath);
        }
    }
}

function chordsheetsDeployRespond(array $payload, int $status): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

if (!defined('CHORDSHEETS_DEPLOY_TESTING')) {
    try {
        $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
        if (!in_array($https, ['on', '1'], true)) {
            chordsheetsDeployFail('HTTPS is required.', 400);
        }
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            chordsheetsDeployFail('Only POST is allowed.', 405);
        }
        $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
        if (!str_starts_with($contentType, 'application/json')) {
            chordsheetsDeployFail('Content type must be application/json.', 415);
        }
        $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($contentLength < 1 || $contentLength > 4096) {
            chordsheetsDeployFail('Request body size is invalid.', 413);
        }
        $rawBody = file_get_contents('php://input');
        if (!is_string($rawBody) || strlen($rawBody) > 4096) {
            chordsheetsDeployFail('Request body is invalid.');
        }
        $request = json_decode($rawBody, true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($request)) {
            chordsheetsDeployFail('Request body is invalid.');
        }
        $signature = strtolower((string) ($_SERVER['HTTP_X_DEPLOY_SIGNATURE'] ?? ''));
        $result = chordsheetsDeployExecute(
            $request,
            $signature,
            (string) ($_SERVER['DOCUMENT_ROOT'] ?? ''),
            __FILE__
        );
        if (in_array($result['state'] ?? '', ['committed', 'rolled_back'], true)
            && is_file(__FILE__)) {
            @unlink(__FILE__);
        }
        chordsheetsDeployRespond($result, 200);
    } catch (ChordsheetsDeployException $exception) {
        chordsheetsDeployRespond(
            ['ok' => false, 'error' => $exception->getMessage()],
            $exception->httpStatus
        );
    } catch (Throwable) {
        chordsheetsDeployRespond(
            ['ok' => false, 'error' => 'Unexpected deployment failure.'],
            500
        );
    }
}
