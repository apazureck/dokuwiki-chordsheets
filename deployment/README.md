# DokuWiki demo deployment

The public demo is a normal PHP DokuWiki installation on Webgo. It does not
need a database. Pages and media live in `shared/data`; configuration, ACLs,
and users live in `shared/conf`.

## Server prerequisites

- `chordsheets.pazureck.de` points to `/chordsheets-demo/current`.
- PHP 8.3 or newer with the `ZipArchive` extension is selected for the domain.
- A valid Let's Encrypt certificate is active and HTTP redirects to the same
  HTTPS hostname.
- The additional Webgo FTP account is rooted at `/chordsheets-demo/current`.
- The FTP endpoint supports explicit TLS on port 21. The workflow refuses
  plaintext FTP and never disables certificate verification.

Webgo documents that additional FTP users are FTP-only. Therefore this
deployment does not require SSH or a remote shell. The application is still
uploaded as one ZIP rather than as thousands of individual files.

## GitHub environment

The workflow uses the GitHub environment `demo`.

Environment secrets:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`

Environment variables:

- `FTP_PORT=21`
- `DEMO_URL=https://chordsheets.pazureck.de`

The environment is restricted to the `master` branch. The workflow can only be
started manually and defaults to a build/test-only run. Set its `deploy` input
to `true` only for an intended release.

## Release process

The workflow builds one verified `dokuwiki-chordsheets-demo.zip`. For each
deployment it generates a 128-bit random runner name and a separate 256-bit
HMAC secret. It uploads over explicit FTPS:

1. the single application ZIP under a random hidden name;
2. a short-lived PHP authorization file that exits without returning its
   contents when requested directly;
3. the generic PHP runner under a separate random hidden name.

The pipeline then calls the runner over HTTPS with a timestamped HMAC-signed
JSON request. The secret is never placed in the URL or repository. Requests
expire after five minutes and each deployment phase can only run once.

The PHP runner verifies the ZIP checksum, compressed and expanded sizes, entry
count, compression ratio, path safety, duplicate names, and Unix entry types.
It rejects links, devices, traversal paths, `install.php`, and mutable DokuWiki
data in the release. It never invokes a shell.

The runner extracts into a fresh release directory, links the shared
configuration and wiki data, and switches `/current` to the new release. The
pipeline performs public smoke and access-control tests before sending a
signed commit request. If a test fails or the job terminates after activation,
it sends a signed rollback request. Runner, authorization file, and ZIP are
removed after commit or rollback; the pipeline additionally attempts exact
FTP cleanup.

The resulting layout is:

```text
/chordsheets-demo/
  current -> releases/<git-sha>
  previous -> releases/<former-git-sha>
  releases/
  shared/
    conf/
    data/
```

The setup boots DokuWiki without `install.php`, enables ACLs, disables
registration, and grants anonymous users read-only access. No default
administrator or password is created.

## Verification

Local checks:

```powershell
./deployment/tests/artifact-build.test.ps1
./deployment/tests/zip-output.test.ps1
./deployment/tests/workflow-policy.test.ps1
./deployment/tests/php-web-deploy-policy.test.ps1
docker run --rm `
  -v "${PWD}/deployment:/repo/deployment:ro" `
  composer:2@sha256:f0809732b2188154b3faa8e44ab900595acb0b09cd0aa6c34e798efe4ebc9021 `
  php /repo/deployment/tests/web-deploy.integration.php /repo/deployment/web-deploy.php
./docker/smoke-test.ps1
```

The integration test covers invalid signatures, first activation and cleanup,
a second release, and rollback to the previous release.
