# Local DokuWiki test environment

This repository contains a local DokuWiki environment for manual plugin testing.
It uses the official, version-pinned DokuWiki image and mounts the runtime files
from this repository read-only as the `chordsheets` plugin.

## Start

From the repository root:

```powershell
docker compose up --detach --wait
```

Open <http://127.0.0.1:8080/doku.php?id=start>. The preconfigured start page
contains a guitar sheet and a sheet prepared for ukulele support.

Compose derives its project and volume names from the checkout directory. If
you run multiple checkouts with the same directory name, set a unique project
name before running any Compose command:

```powershell
$env:COMPOSE_PROJECT_NAME = 'dokuwiki-chordsheets-my-branch'
```

```bash
export COMPOSE_PROJECT_NAME=dokuwiki-chordsheets-my-branch
```

Keep using the same value when stopping or resetting that checkout.

Wiki data is stored in the `dokuwiki-data` Docker volume, while plugin code is
read directly from the working tree. The seeded configuration and start page
are refreshed on every `docker compose up`; other pages remain in the volume.
Hard-refresh the browser if DokuWiki has cached a changed JavaScript or CSS
asset.

## Smoke test

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\docker\smoke-test.ps1
```

On Linux with PowerShell installed:

```bash
pwsh -NoProfile -File ./docker/smoke-test.ps1
```

Use a different host port when 8080 is occupied:

```powershell
.\docker\smoke-test.ps1 -Port 8081
```

## Stop and reset

Stop the environment without losing its data:

```powershell
docker compose down
```

To deliberately reset all local wiki configuration and pages:

```powershell
docker compose down --volumes
```

The last command permanently deletes this checkout's local `dokuwiki-data`
volume. Do not update or remove the `chordsheets` plugin through DokuWiki's
Extension Manager; the plugin files are read-only bind mounts from this
repository.
