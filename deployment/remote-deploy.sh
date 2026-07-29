#!/usr/bin/env bash
set -euo pipefail
umask 0077

root=${1:-}
sha=${2:-}
expected_hash=${3:-}
upload_name=${4:-}

[[ "$root" =~ ^/home/www/[A-Za-z0-9._-]+$ ]] || { echo 'Unsafe remote root.' >&2; exit 2; }
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid release SHA.' >&2; exit 2; }
[[ "$expected_hash" =~ ^[a-f0-9]{64}$ ]] || { echo 'Invalid archive SHA-256.' >&2; exit 2; }
[[ "$upload_name" =~ ^\.upload\.$sha\.[A-Za-z0-9]{6}$ ]] || { echo 'Invalid upload name.' >&2; exit 2; }

for command_name in unzip zipinfo realpath sha256sum stat php; do
  command -v "$command_name" >/dev/null || { echo "Missing command: $command_name" >&2; exit 2; }
done

mkdir -p "$root"
[[ "$(realpath -e "$root")" == "$root" ]] || { echo 'Remote root resolves through a symlink.' >&2; exit 2; }

uploads="$root/uploads"
releases="$root/releases"
shared="$root/shared"
archive="$uploads/$upload_name"
release="$releases/$sha"
staging="$releases/.$sha.tmp"
lock="$root/.deploy.lock"

for managed in "$uploads" "$releases" "$shared"; do
  [[ ! -L "$managed" ]] || { echo "Managed path is a symlink: $managed" >&2; exit 2; }
done
mkdir -p "$uploads" "$releases" "$shared"
chmod 0700 "$uploads" "$shared"

[[ -f "$archive" && ! -L "$archive" ]] || { echo 'Uploaded ZIP is missing or unsafe.' >&2; exit 3; }
archive_bytes=$(stat -c '%s' "$archive")
(( archive_bytes > 0 && archive_bytes <= 67108864 )) || { echo 'ZIP size is outside the allowed range.' >&2; exit 3; }
actual_hash=$(sha256sum "$archive" | awk '{print $1}')
[[ "$actual_hash" == "$expected_hash" ]] || { echo 'Uploaded ZIP checksum mismatch.' >&2; exit 3; }

unzip -tqq "$archive"
if zipinfo -l "$archive" | grep -Eq '^[lbcps]'; then
  echo 'ZIP contains a link or special file.' >&2
  exit 3
fi

read -r entry_count unpacked_bytes < <(
  zipinfo -l "$archive" | awk '
    $1 ~ /^[-d][rwxStTs-]+$/ {
      entries += 1
      unpacked += $4
    }
    END { printf "%d %d\n", entries, unpacked }
  '
)
(( entry_count > 0 && entry_count <= 25000 )) || { echo 'ZIP entry count is unsafe.' >&2; exit 3; }
(( unpacked_bytes <= 536870912 )) || { echo 'ZIP expands beyond the size limit.' >&2; exit 3; }
(( unpacked_bytes <= archive_bytes * 200 )) || { echo 'ZIP compression ratio is unsafe.' >&2; exit 3; }

unzip -Z1 "$archive" | awk '
  {
    entry = $0
    lower = tolower(entry)
    if (entry == "" || entry == "." || entry ~ /^\// || entry ~ /\\/ || entry ~ /(^|\/)\.\.(\/|$)/ || entry ~ /\/\// || entry !~ /^[A-Za-z0-9._+@\/-]+$/ || seen[lower]++) {
      bad = 1
    }
  }
  END { exit bad ? 1 : 0 }
' || { echo 'ZIP contains an unsafe or duplicate path.' >&2; exit 3; }

mkdir "$lock" 2>/dev/null || { echo 'Another deployment is active.' >&2; exit 5; }
locked=1
cleanup() {
  [[ ! -e "$staging" && ! -L "$staging" ]] || rm -rf -- "$staging"
  if [[ "${locked:-0}" -eq 1 && -d "$lock" && ! -L "$lock" ]]; then
    rmdir "$lock"
  fi
}
trap cleanup EXIT

[[ ! -e "$release" && ! -L "$release" ]] || { echo 'Release already exists.' >&2; exit 4; }
[[ ! -e "$staging" && ! -L "$staging" ]] || rm -rf -- "$staging"
mkdir "$staging"
unzip -q "$archive" -d "$staging"

if find "$staging" \( -type l -o -type b -o -type c -o -type p -o -type s \) -print -quit | grep -q .; then
  echo 'Expanded ZIP contains a link or special file.' >&2
  exit 3
fi

[[ -f "$staging/doku.php" ]]
[[ -f "$staging/inc/init.php" ]]
[[ -f "$staging/lib/plugins/chordsheets/syntax.php" ]]
[[ ! -e "$staging/install.php" ]]
[[ ! -e "$staging/data" ]]
[[ ! -e "$staging/conf/local.php" ]]

for persistent in "$shared/conf" "$shared/data"; do
  [[ ! -L "$persistent" ]] || { echo "Persistent path is a symlink: $persistent" >&2; exit 2; }
done

if [[ ! -d "$shared/conf" ]]; then
  mv "$staging/conf" "$shared/conf"
else
  rm -rf -- "$staging/conf"
fi

if [[ ! -d "$shared/data" ]]; then
  mkdir -p \
    "$shared/data/attic" "$shared/data/cache" "$shared/data/index" "$shared/data/locks" \
    "$shared/data/media" "$shared/data/media_attic" "$shared/data/media_meta" \
    "$shared/data/meta" "$shared/data/pages" "$shared/data/tmp"
  cat > "$shared/data/pages/start.txt" <<'START'
====== DokuWiki Chordsheets Demo ======

This instance runs the current chordsheets plugin from GitHub.

<chordSheet>
[C]Hello [G]world
[Am]This is the [F]guitar demo
</chordSheet>

<chordSheet instrument="ukulele">
[C]Ukulele [G]preview
</chordSheet>
START
fi

for persistent in "$shared/conf" "$shared/data"; do
  if find "$persistent" \( -type l -o -type b -o -type c -o -type p -o -type s \) -print -quit | grep -q .; then
    echo "Persistent tree contains a link or special file: $persistent" >&2
    exit 4
  fi
done

local_tmp="$shared/conf/.local.php.$sha.tmp"
acl_tmp="$shared/conf/.acl.auth.php.$sha.tmp"
rm -f -- "$local_tmp" "$acl_tmp"
cat > "$local_tmp" <<'PHP'
<?php
$conf['title'] = 'DokuWiki Chordsheets Demo';
$conf['lang'] = 'en';
$conf['license'] = 'cc-by-sa';
$conf['useacl'] = 1;
$conf['superuser'] = '@admin';
$conf['authtype'] = 'authplain';
$conf['disableactions'] = 'register';
$conf['breadcrumbs'] = 0;
$conf['youarehere'] = 1;
PHP
cat > "$acl_tmp" <<'ACL'
# acl.auth.php
# <?php exit()?>
*               @ALL        1
*               @user       1
demo:*          @user       2
playground:*    @user       2
ACL
chmod 0600 "$local_tmp" "$acl_tmp"
mv -Tf "$local_tmp" "$shared/conf/local.php"
mv -Tf "$acl_tmp" "$shared/conf/acl.auth.php"

if [[ ! -e "$shared/conf/users.auth.php" ]]; then
  users_tmp="$shared/conf/.users.auth.php.$sha.tmp"
  cat > "$users_tmp" <<'USERS'
# users.auth.php
# <?php exit()?>
USERS
  chmod 0600 "$users_tmp"
  mv -T "$users_tmp" "$shared/conf/users.auth.php"
fi
[[ -f "$shared/conf/users.auth.php" && ! -L "$shared/conf/users.auth.php" ]]

for protected_dir in "$shared/conf" "$shared/data"; do
  htaccess_tmp="$protected_dir/.htaccess.$sha.tmp"
  rm -f -- "$htaccess_tmp"
  cat > "$htaccess_tmp" <<'HTACCESS'
<IfModule mod_authz_core.c>
  Require all denied
</IfModule>
<IfModule !mod_authz_core.c>
  Order allow,deny
  Deny from all
</IfModule>
HTACCESS
  chmod 0600 "$htaccess_tmp"
  mv -Tf "$htaccess_tmp" "$protected_dir/.htaccess"
done

ln -s ../../shared/conf "$staging/conf"
ln -s ../../shared/data "$staging/data"
find "$staging" -type d -exec chmod 0755 {} +
find "$staging" -type f -exec chmod 0644 {} +
find "$shared/conf" "$shared/data" -type d -exec chmod 0700 {} +
find "$shared/conf" "$shared/data" -type f -exec chmod 0600 {} +
php -l "$staging/lib/plugins/chordsheets/syntax.php" >/dev/null

mv "$staging" "$release"
[[ ! -e "$release/install.php" ]]

old_target=
if [[ -e "$root/current" && ! -L "$root/current" ]]; then
  echo 'Current deployment target is not a symlink.' >&2
  exit 4
fi
if [[ -L "$root/current" ]]; then
  old_target=$(readlink "$root/current")
  [[ "$old_target" =~ ^releases/[a-f0-9]{40}$ ]] || { echo 'Current target is invalid.' >&2; exit 4; }
  old_path="$root/$old_target"
  [[ -d "$old_path" && ! -L "$old_path" && ! -e "$old_path/install.php" ]]
  case "$(realpath -e "$old_path")" in
    "$releases"/*) ;;
    *) echo 'Current release resolves outside releases.' >&2; exit 4 ;;
  esac
fi

for next_link in "$root/current.next" "$root/previous.next"; do
  [[ ! -e "$next_link" && ! -L "$next_link" ]] || { echo "Stale switch path: $next_link" >&2; exit 4; }
done

if [[ -n "$old_target" ]]; then
  ln -s "$old_target" "$root/previous.next"
  mv -Tf "$root/previous.next" "$root/previous"
fi
ln -s "releases/$sha" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"

rm -f -- "$archive"
rmdir "$lock"
locked=0
trap - EXIT
echo "Activated release $sha."
