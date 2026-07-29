<?php

declare(strict_types=1);

define('CHORDSHEETS_DEPLOY_TESTING', true);
require $argv[1] ?? __DIR__ . '/../web-deploy.php';

function testAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function testRemoveTree(string $path): void
{
    if (is_link($path) || is_file($path)) {
        @unlink($path);
        return;
    }
    if (!is_dir($path)) {
        return;
    }
    foreach (new FilesystemIterator($path, FilesystemIterator::SKIP_DOTS) as $entry) {
        testRemoveTree($entry->getPathname());
    }
    rmdir($path);
}

function testCreateArchive(string $archivePath, string $label, ?string $sourceArchive = null): string
{
    if ($sourceArchive !== null) {
        testAssert(is_file($sourceArchive), 'Full release ZIP is unavailable.');
        testAssert(copy($sourceArchive, $archivePath), 'Could not copy full release ZIP.');
        return hash_file('sha256', $archivePath);
    }
    $zip = new ZipArchive();
    testAssert($zip->open($archivePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true, 'Could not create test ZIP.');
    $zip->addFromString('doku.php', "<?php echo '" . addslashes($label) . "';");
    $zip->addFromString('inc/init.php', "<?php\n");
    $zip->addFromString('lib/plugins/chordsheets/syntax.php', "<?php\n");
    $zip->addFromString('lib/plugins/chordsheets/script.js', "console.log('demo');\n");
    $zip->addEmptyDir('conf');
    $zip->close();
    return hash_file('sha256', $archivePath);
}

function testWriteToken(
    string $root,
    string $nonce,
    string $sha,
    string $archiveName,
    string $archiveHash,
    string $secret
): string {
    $tokenPath = "$root/uploads/.deploy-$nonce.json";
    $token = [
        'version' => 1,
        'nonce' => $nonce,
        'sha' => $sha,
        'archive' => $archiveName,
        'archive_sha256' => $archiveHash,
        'secret' => $secret,
        'expires_at' => time() + 600,
        'phase' => 'uploaded',
    ];
    testAssert(file_put_contents($tokenPath, json_encode($token, JSON_THROW_ON_ERROR), LOCK_EX) !== false, 'Could not write token.');
    chmod($tokenPath, 0600);
    return $tokenPath;
}

function testSignedRequest(array $request, string $secret): string
{
    return hash_hmac('sha256', chordsheetsDeployCanonicalRequest($request), $secret);
}

if (!class_exists(ZipArchive::class)) {
    throw new RuntimeException('ZipArchive is required for this integration test.');
}

$root = sys_get_temp_dir() . '/chordsheets-php-deploy-' . bin2hex(random_bytes(8));
$current = "$root/current";
$uploads = "$root/uploads";
mkdir($current, 0700, true);
mkdir($uploads, 0700, true);

try {
    $runnerSource = realpath($argv[1] ?? __DIR__ . '/../web-deploy.php');
    testAssert(is_string($runnerSource), 'Runner source not found.');

    $nonce1 = str_repeat('1', 32);
    $sha1 = str_repeat('a', 40);
    $secret1 = str_repeat('b', 64);
    $runnerName1 = ".deploy-$nonce1.php";
    $archiveName1 = ".release-$nonce1.zip";
    $archivePath1 = "$uploads/$archiveName1";
    $archiveHash1 = testCreateArchive($archivePath1, 'release-one', $argv[2] ?? null);
    copy($runnerSource, "$current/$runnerName1");
    $tokenPath1 = testWriteToken($root, $nonce1, $sha1, $archiveName1, $archiveHash1, $secret1);

    $invalidRequest = [
        'action' => 'deploy',
        'nonce' => $nonce1,
        'sha' => $sha1,
        'timestamp' => time(),
        'archive_sha256' => $archiveHash1,
    ];
    try {
        chordsheetsDeployExecute($invalidRequest, str_repeat('0', 64), $current, "$current/$runnerName1");
        throw new RuntimeException('Invalid signature was accepted.');
    } catch (ChordsheetsDeployException $exception) {
        testAssert($exception->httpStatus === 403, 'Invalid signature did not return 403.');
    }
    testAssert(is_file($tokenPath1), 'Invalid request changed deployment state.');

    $result1 = chordsheetsDeployExecute(
        $invalidRequest,
        testSignedRequest($invalidRequest, $secret1),
        $current,
        "$current/$runnerName1"
    );
    testAssert($result1['state'] === 'active', 'First release was not activated.');
    testAssert(is_link($current), 'Current was not switched to a release symlink.');
    testAssert(readlink($current) === "releases/$sha1", 'Current points to the wrong first release.');
    testAssert(is_file("$current/lib/plugins/chordsheets/syntax.php"), 'Plugin entry point is missing.');
    testAssert(is_file("$root/shared/conf/local.php"), 'Shared local configuration is missing.');
    testAssert(is_file("$root/shared/data/pages/start.txt"), 'Demo start page is missing.');

    $commit1 = $invalidRequest;
    $commit1['action'] = 'commit';
    $commit1['timestamp'] = time();
    $resultCommit1 = chordsheetsDeployExecute(
        $commit1,
        testSignedRequest($commit1, $secret1),
        $current,
        "$current/$runnerName1"
    );
    testAssert($resultCommit1['state'] === 'committed', 'First release was not committed.');
    testAssert(!file_exists($tokenPath1), 'Token survived commit.');
    testAssert(!file_exists($archivePath1), 'Archive survived commit.');
    testAssert(!file_exists("$current/$runnerName1"), 'Runner survived commit.');

    $nonce2 = str_repeat('2', 32);
    $sha2 = str_repeat('c', 40);
    $secret2 = str_repeat('d', 64);
    $runnerName2 = ".deploy-$nonce2.php";
    $archiveName2 = ".release-$nonce2.zip";
    $archivePath2 = "$uploads/$archiveName2";
    $archiveHash2 = testCreateArchive($archivePath2, 'release-two', $argv[2] ?? null);
    copy($runnerSource, "$current/$runnerName2");
    $tokenPath2 = testWriteToken($root, $nonce2, $sha2, $archiveName2, $archiveHash2, $secret2);
    $deploy2 = [
        'action' => 'deploy',
        'nonce' => $nonce2,
        'sha' => $sha2,
        'timestamp' => time(),
        'archive_sha256' => $archiveHash2,
    ];
    $result2 = chordsheetsDeployExecute(
        $deploy2,
        testSignedRequest($deploy2, $secret2),
        $current,
        "$current/$runnerName2"
    );
    testAssert($result2['state'] === 'active', 'Second release was not activated.');
    testAssert(readlink($current) === "releases/$sha2", 'Current points to the wrong second release.');

    $rollback2 = $deploy2;
    $rollback2['action'] = 'rollback';
    $rollback2['timestamp'] = time();
    $resultRollback2 = chordsheetsDeployExecute(
        $rollback2,
        testSignedRequest($rollback2, $secret2),
        $current,
        "$current/$runnerName2"
    );
    testAssert($resultRollback2['state'] === 'rolled_back', 'Second release was not rolled back.');
    testAssert(readlink($current) === "releases/$sha1", 'Rollback did not restore the first release.');
    testAssert(!file_exists("$root/releases/$sha2"), 'Rolled-back release was not removed.');
    testAssert(!file_exists($tokenPath2), 'Rollback token survived.');
    testAssert(!file_exists($archivePath2), 'Rollback archive survived.');

    echo "web-deploy.integration.php: PASS\n";
} finally {
    testRemoveTree($root);
}
