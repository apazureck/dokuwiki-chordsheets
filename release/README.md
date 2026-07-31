# Release runbook

This directory prepares the `v1.0.0` release. The generated ZIP has exactly one
top-level directory, `chordsheets/`, so it can be installed directly through
DokuWiki's extension manager.

## Authentication decision

DokuWiki Core has kein OAuth-Device-Flow. A DokuWiki user can generate a bearer
token in the user profile, and an administrator can enable JSON-RPC at
`lib/exe/jsonrpc.php`. The public DokuWiki.org endpoint currently answers
`JSON-RPC server not enabled`, so the plugin registry cannot safely be updated
through that API.

Do not automate the website login, scrape cookies, or store a DokuWiki password.
In particular, there are keine DokuWiki-Passwörter in repository or GitHub
secrets. If DokuWiki.org enables JSON-RPC in the future, use a dedicated,
least-privilege account and its revocable bearer token, then verify identity and
page ACLs before any write.

## GitHub environments

Create these environments in the GitHub repository settings:

1. `release`
   - Require a reviewer.
   - Limit deployment branches/tags to protected semantic-version tags.
   - Do not add FTP or DokuWiki credentials. GitHub's short-lived workflow token
     publishes the release asset.
2. `dokuwiki-registry`
   - Set the environment URL to
     `https://www.dokuwiki.org/plugin:chordsheets`.
   - Require a reviewer and prevent self-review where the plan supports it.
   - Store no DokuWiki username or password.

The second environment is deliberately a human approval and handoff boundary.
Its job summary contains the reviewed registry block from
`release/dokuwiki-registry.txt`.

## Release v1.0.0

The local integration test uses DokuWiki `2026-07-14a "Mort"` and the registry
metadata also keeps compatibility with the preceding `Librarian` release.

1. Confirm `plugin.info.txt`, `CHANGELOG.md`, `release/release-manifest.psd1`,
   and `release/dokuwiki-registry.txt` use the same version and date.
2. Run the JavaScript tests, release policy tests, package test, PHP lint, and
   Docker smoke test.
3. Review the generated ZIP and checksum.
4. Merge the release preparation, then create and push the signed or annotated
   tag `v1.0.0`.
5. Approve the `release` environment. The workflow builds the ZIP from the tag,
   creates a GitHub Release, and uploads the ZIP plus SHA-256 checksum.
6. Approve `dokuwiki-registry`, log in to DokuWiki.org manually, and copy the
   prepared registry block. Confirm that the immutable download URL and
   `lastupdate` date are unchanged.

For a broken release, do not replace the immutable asset. Fix the problem and
publish a new patch version, then point the registry page to that version.
