#!/usr/bin/env bash
set -euo pipefail
umask 0077

remote_root=${1:-}
failed_sha=${2:-}

if [[ ! "$remote_root" =~ ^/home/www/[A-Za-z0-9._-]+$ ]]; then
  echo "Remote root must be one direct, safe child below /home/www." >&2
  exit 2
fi

if [[ ! "$failed_sha" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Failed release SHA must be a full lowercase Git commit SHA." >&2
  exit 2
fi

test -d "$remote_root"
test ! -L "$remote_root"
canonical_parent=$(realpath -e /home/www)
canonical_root=$(realpath -e "$remote_root")
if [[ "$canonical_root" != "$canonical_parent/${remote_root##*/}" ]]; then
  echo "Remote root must not resolve through a symlink." >&2
  exit 2
fi

releases_dir="$remote_root/releases"
lock="$remote_root/.deploy.lock"
test -d "$releases_dir"
test ! -L "$releases_dir"

mkdir "$lock" 2>/dev/null || { echo 'Another deployment operation is active.' >&2; exit 5; }
locked=1
cleanup() {
  if [[ "${locked:-0}" -eq 1 && -d "$lock" && ! -L "$lock" ]]; then
    rmdir "$lock"
  fi
}
trap cleanup EXIT

if [[ ! -L "$remote_root/current" ]]; then
  echo 'No active release exists; nothing to roll back.'
  exit 0
fi

current_target=$(readlink "$remote_root/current")
if [[ "$current_target" != "releases/$failed_sha" ]]; then
  echo 'Current release is not the failed release; refusing rollback.' >&2
  exit 3
fi

if [[ ! -L "$remote_root/previous" ]]; then
  rm -f -- "$remote_root/current"
  rmdir "$lock"
  locked=0
  trap - EXIT
  echo "No previous release existed; deactivated $current_target."
  exit 0
fi

previous_target=$(readlink "$remote_root/previous")
if [[ ! "$previous_target" =~ ^releases/[a-f0-9]{40}$ ]]; then
  echo 'Previous release target is invalid.' >&2
  exit 3
fi

previous_path="$remote_root/$previous_target"
test -d "$previous_path"
test ! -L "$previous_path"
test ! -e "$previous_path/install.php"
test -f "$previous_path/doku.php"
test -f "$previous_path/inc/init.php"
test -f "$previous_path/lib/plugins/chordsheets/syntax.php"
test -L "$previous_path/conf"
test -L "$previous_path/data"
test "$(readlink "$previous_path/conf")" = '../../shared/conf'
test "$(readlink "$previous_path/data")" = '../../shared/data'

resolved_previous=$(realpath -e "$previous_path")
case "$resolved_previous" in
  "$releases_dir"/*) ;;
  *) echo 'Previous release resolves outside the release directory.' >&2; exit 3 ;;
esac

if [[ -e "$remote_root/current.rollback" || -L "$remote_root/current.rollback" ]]; then
  rm -f -- "$remote_root/current.rollback"
fi

ln -s "$previous_target" "$remote_root/current.rollback"
mv -Tf "$remote_root/current.rollback" "$remote_root/current"
rmdir "$lock"
locked=0
trap - EXIT
echo "Rolled back to $previous_target."
