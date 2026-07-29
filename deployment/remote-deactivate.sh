#!/usr/bin/env bash
set -euo pipefail
umask 0077

remote_root=${1:-}
expected_sha=${2:-}

[[ "$remote_root" =~ ^/home/www/[A-Za-z0-9._-]+$ ]] || {
  echo 'Unsafe remote root.' >&2
  exit 2
}
[[ "$expected_sha" =~ ^[a-f0-9]{40}$ ]] || {
  echo 'Expected release must be a full lowercase Git SHA.' >&2
  exit 2
}

test -d "$remote_root"
test ! -L "$remote_root"
canonical_parent=$(realpath -e /home/www)
canonical_root=$(realpath -e "$remote_root")
test "$canonical_root" = "$canonical_parent/${remote_root##*/}"

lock="$remote_root/.deploy.lock"
mkdir "$lock" 2>/dev/null || {
  echo 'Another deployment operation is active.' >&2
  exit 5
}
locked=1
cleanup() {
  if [[ "${locked:-0}" -eq 1 && -d "$lock" && ! -L "$lock" ]]; then
    rmdir "$lock"
  fi
}
trap cleanup EXIT

test -L "$remote_root/current"
current_target=$(readlink "$remote_root/current")
[[ "$current_target" == "releases/$expected_sha" ]] || {
  echo 'Active release changed; refusing deactivation.' >&2
  exit 3
}

rm -f -- "$remote_root/current"
rmdir "$lock"
locked=0
trap - EXIT
echo "Deactivated unverified release $expected_sha."
