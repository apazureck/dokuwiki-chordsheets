#!/usr/bin/env bash

set -euo pipefail
umask 0077

fail() {
    printf 'Remote upload preflight failed: %s\n' "$1" >&2
    exit 1
}

if (( $# != 2 )); then
    fail 'expected deployment root and commit SHA arguments'
fi

root=$1
sha=$2

if [[ ! "$root" =~ ^/home/www/([A-Za-z0-9][A-Za-z0-9._-]*)$ ]]; then
    fail 'deployment root must be a direct safe child of /home/www'
fi
root_basename=${BASH_REMATCH[1]}

if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    fail 'commit SHA must contain exactly 40 lowercase hexadecimal characters'
fi

command -v realpath >/dev/null 2>&1 || fail 'required command realpath is unavailable'
command -v mktemp >/dev/null 2>&1 || fail 'required command mktemp is unavailable'
command -v find >/dev/null 2>&1 || fail 'required command find is unavailable'

mkdir -p -- "$root" || fail 'could not create deployment root'
test -d "$root" || fail 'deployment root is not a directory'
test ! -L "$root" || fail 'deployment root must not be a symbolic link'

if ! canonical_parent=$(realpath -e /home/www); then
    fail 'could not resolve /home/www'
fi
if ! canonical_root=$(realpath -e -- "$root"); then
    fail 'could not resolve deployment root'
fi
if [[ "$canonical_root" != "$canonical_parent/$root_basename" ]]; then
    fail 'deployment root resolves outside its expected location'
fi

uploads="$root/uploads"
mkdir -p -- "$uploads" || fail 'could not create uploads directory'
test -d "$uploads" || fail 'uploads path is not a directory'
test ! -L "$uploads" || fail 'uploads directory must not be a symbolic link'

if ! canonical_uploads=$(realpath -e -- "$uploads"); then
    fail 'could not resolve uploads directory'
fi
if [[ "$canonical_uploads" != "$canonical_root/uploads" ]]; then
    fail 'uploads directory resolves outside the deployment root'
fi

chmod 0700 -- "$uploads" || fail 'could not secure uploads directory permissions'

if ! find "$uploads" -maxdepth 1 -type f -mmin +45 -print0 |
    while IFS= read -r -d '' stale_upload; do
        stale_upload_basename=${stale_upload##*/}
        if [[ "$stale_upload_basename" =~ ^\.upload\.[0-9a-f]{40}\.[A-Za-z0-9]{6}$ ]] &&
            [[ -f "$stale_upload" ]] && [[ ! -L "$stale_upload" ]]; then
            rm -f -- "$stale_upload" || exit 1
        fi
    done
then
    fail 'could not remove stale upload files'
fi

if ! upload_file=$(mktemp -- "$uploads/.upload.$sha.XXXXXX"); then
    fail 'could not create upload file'
fi
readonly upload_file

cleanup_upload_file() {
    if [[ -f "$upload_file" ]] && [[ ! -L "$upload_file" ]]; then
        rm -f -- "$upload_file"
    fi
}
trap cleanup_upload_file EXIT

upload_basename=${upload_file##*/}

if [[ "$upload_file" != "$uploads/$upload_basename" ]] ||
    [[ ! "$upload_basename" =~ ^\.upload\.${sha}\.[A-Za-z0-9]{6}$ ]]; then
    fail 'generated upload filename does not match the required format'
fi

trap - EXIT
printf 'UPLOAD:%s' "$upload_basename"
