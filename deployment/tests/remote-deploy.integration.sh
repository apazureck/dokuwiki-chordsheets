#!/usr/bin/env bash
set -euo pipefail

artifact=${1:-}
test -f "$artifact"

deployment_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
deploy_script="$deployment_dir/remote-deploy.sh"
rollback_script="$deployment_dir/remote-rollback.sh"
archive_sha256=$(sha256sum "$artifact" | awk '{print $1}')

run_deploy() {
  local root=$1
  local sha=$2
  local suffix=$3
  local upload_name=".upload.$sha.$suffix"
  mkdir -p "$root/uploads"
  cp "$artifact" "$root/uploads/$upload_name"
  bash "$deploy_script" "$root" "$sha" "$archive_sha256" "$upload_name"
}

invalid_sha=9999999999999999999999999999999999999999
if bash "$deploy_script" '/home/www/../escape' "$invalid_sha" "$archive_sha256" ".upload.$invalid_sha.abc123"; then
  echo 'Deploy accepted a traversing remote root.' >&2
  exit 1
fi

first_root=/home/www/chordsheets-demo
first_sha=1111111111111111111111111111111111111111
second_sha=2222222222222222222222222222222222222222

run_deploy "$first_root" "$first_sha" abc123

test "$(readlink "$first_root/current")" = "releases/$first_sha"
test ! -e "$first_root/previous"
test -L "$first_root/current/conf"
test -L "$first_root/current/data"
test -f "$first_root/shared/conf/local.php"
test -f "$first_root/shared/data/.htaccess"
test ! -e "$first_root/current/install.php"
test ! -e "$first_root/uploads/.upload.$first_sha.abc123"

cat > "$first_root/shared/conf/local.php" <<'PHP'
<?php
$conf['useacl'] = 0;
$conf['disableactions'] = '';
PHP
cat > "$first_root/shared/conf/acl.auth.php" <<'ACL'
# deliberately unsafe drift
*               @ALL        16
ACL
cat > "$first_root/shared/conf/users.auth.php" <<'USERS'
# users.auth.php
# <?php exit()?>
demo-user:$2y$10$placeholder:Demo User:user:demo@example.invalid
USERS
rm -f -- "$first_root/shared/conf/.htaccess" "$first_root/shared/data/.htaccess"

run_deploy "$first_root" "$second_sha" def456

test "$(readlink "$first_root/current")" = "releases/$second_sha"
test "$(readlink "$first_root/previous")" = "releases/$first_sha"
test -f "$first_root/shared/conf/.htaccess"
test -f "$first_root/shared/data/.htaccess"
grep -Fq "\$conf['useacl'] = 1;" "$first_root/shared/conf/local.php"
grep -Fq "\$conf['disableactions'] = 'register';" "$first_root/shared/conf/local.php"
grep -Fq '*               @ALL        1' "$first_root/shared/conf/acl.auth.php"
grep -Fq 'demo-user:$2y$10$placeholder' "$first_root/shared/conf/users.auth.php"

symlink_sha=5555555555555555555555555555555555555555
ln -s /tmp "$first_root/shared/data/cache/unsafe-link"
mkdir -p "$first_root/uploads"
cp "$artifact" "$first_root/uploads/.upload.$symlink_sha.ghi789"
if bash "$deploy_script" "$first_root" "$symlink_sha" "$archive_sha256" ".upload.$symlink_sha.ghi789"; then
  echo 'Deploy accepted a symlink in persistent storage.' >&2
  exit 1
fi
test "$(readlink "$first_root/current")" = "releases/$second_sha"
rm -f -- "$first_root/shared/data/cache/unsafe-link" "$first_root/uploads/.upload.$symlink_sha.ghi789"

mkdir "$first_root/.deploy.lock"
if bash "$rollback_script" "$first_root" "$second_sha"; then
  echo 'Rollback ignored an active deployment lock.' >&2
  exit 1
fi
test "$(readlink "$first_root/current")" = "releases/$second_sha"
rmdir "$first_root/.deploy.lock"

ln -sfn 'releases/11111111../../shared' "$first_root/previous"
if bash "$rollback_script" "$first_root" "$second_sha"; then
  echo 'Rollback accepted a malformed previous target.' >&2
  exit 1
fi
test "$(readlink "$first_root/current")" = "releases/$second_sha"

ln -sfn "releases/$first_sha" "$first_root/previous"
bash "$rollback_script" "$first_root" "$second_sha"
test "$(readlink "$first_root/current")" = "releases/$first_sha"

bootstrap_root=/home/www/chordsheets-bootstrap
bootstrap_sha=3333333333333333333333333333333333333333
run_deploy "$bootstrap_root" "$bootstrap_sha" jkl012
test "$(readlink "$bootstrap_root/current")" = "releases/$bootstrap_sha"
test ! -e "$bootstrap_root/previous"

bash "$rollback_script" "$bootstrap_root" "$bootstrap_sha"
test ! -e "$bootstrap_root/current"

locked_root=/home/www/chordsheets-locked
locked_sha=4444444444444444444444444444444444444444
mkdir -p "$locked_root/uploads" "$locked_root/.deploy.lock"
cp "$artifact" "$locked_root/uploads/.upload.$locked_sha.mno345"
if bash "$deploy_script" "$locked_root" "$locked_sha" "$archive_sha256" ".upload.$locked_sha.mno345"; then
  echo 'Deploy ignored an active deployment lock.' >&2
  exit 1
fi
test ! -e "$locked_root/current"

echo 'remote-deploy.integration.sh: PASS'
