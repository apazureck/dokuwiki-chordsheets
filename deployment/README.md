# DokuWiki demo deployment

The public demo is a normal PHP DokuWiki installation on Webgo. It does not
need a database. Pages and media live in `shared/data`; configuration, ACLs,
and users live in `shared/conf`.

## Server prerequisites

- The Webgo subdomain `chordsheets.pazureck.de` points to
  `/chordsheets-demo/current`.
- PHP 8.3 is selected for the subdomain.
- A valid Let's Encrypt certificate is active and HTTP redirects to the same
  HTTPS hostname.
- The credentials belong to the SSH/SFTP-capable Webgo main account on port
  22. A plain FTP-only account is not supported by this workflow.
- The account provides `bash`, `unzip`, `zipinfo`, `realpath`, `sha256sum`,
  `stat`, and `php`.

## GitHub environment

The workflow uses the GitHub environment `demo`.

Environment secrets:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`

The `FTP_*` names are retained for compatibility, but the transport is
encrypted SSH/SCP, not plain FTP.

Environment variables:

- `FTP_PORT=22`
- `FTP_REMOTE_PATH=/home/www/chordsheets-demo`
- `DEMO_URL=https://chordsheets.pazureck.de`
- `FTP_KNOWN_HOSTS=<verified OpenSSH known_hosts line>`

Obtain the server key from the configured SSH hostname and compare its
fingerprint with an independently trusted value from Webgo before storing the
complete known-hosts line. Do not disable strict host-key checking and do not
trust an unverified `ssh-keyscan` result.

The environment is restricted to the `master` branch. The workflow can only be
started manually and defaults to a build/test-only run. Set its `deploy` input
to `true` only for an intended release.

## Release process

The workflow builds one verified `dokuwiki-chordsheets-demo.zip`. It creates a
random, private upload file on the server, uploads exactly that one ZIP with
SCP, verifies its SHA-256, and extracts it into a fresh staging directory with
`unzip`. No application files are uploaded individually.

Before extraction, the server CRC-tests the ZIP and rejects unsafe paths,
links and special files, duplicate case-insensitive names, oversized archives,
excessive expansion ratios, unsafe persistent storage, and concurrent
deployments. The enforced demo configuration and ACL are repaired on each
release while existing users and wiki data are preserved. A validated release
is activated atomically through the `current` symlink.

The first deployment creates this layout:

```text
/home/www/chordsheets-demo/
  current -> releases/<git-sha>
  releases/
  shared/
    conf/
    data/
  uploads/
```

From the second deployment onward, `previous` points to the former release for
rollback.

The setup boots DokuWiki without `install.php`, enables ACLs, disables
registration, and grants anonymous users read-only access. Authenticated users
can later be granted edit access to `demo:*` and `playground:*`.

No default administrator or password is created. Provision the first
administrator separately over SSH with a precomputed DokuWiki password hash.
Never place a plaintext administrator password in the repository or release
artifact, and never expose the web installer.

## Verification

Local checks:

```powershell
./deployment/tests/artifact-build.test.ps1
./deployment/tests/zip-output.test.ps1
./deployment/tests/workflow-policy.test.ps1
./docker/smoke-test.ps1
```

The GitHub workflow also simulates two remote releases and both rollback paths
inside a temporary Docker filesystem. A live deployment succeeds only if the
start page and plugin asset load, sensitive `conf` and `data` paths remain
blocked, `install.php` is unavailable, and HTTP redirects to the correct HTTPS
hostname.

If the smoke test fails, rollback is scoped to the Git SHA that was just
deployed. With no earlier release, the unsafe `current` link is removed; with a
previous release, the link is switched back atomically and its public page and
plugin asset are tested again.
