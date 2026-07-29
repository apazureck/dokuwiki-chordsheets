#!/usr/bin/env bash
set -euo pipefail

preflight_script=${1:-}
test -f "$preflight_script"

root=/home/www/chordsheets-preflight
sha=7777777777777777777777777777777777777777
old_sha=6666666666666666666666666666666666666666
fresh_sha=5555555555555555555555555555555555555555
symlink_sha=9999999999999999999999999999999999999999
stale_upload="$root/uploads/.upload.$old_sha.AbC123"
fresh_upload="$root/uploads/.upload.$fresh_sha.FrE123"
foreign_file="$root/uploads/keep-me.txt"
upload_symlink="$root/uploads/.upload.$symlink_sha.SyM123"

cleanup_test_root() {
  rm -rf -- "$root"
}
trap cleanup_test_root EXIT

rm -rf -- "$root"
mkdir -p -- "$root/uploads"
printf 'stale\n' > "$stale_upload"
touch -d '46 minutes ago' "$stale_upload"
printf 'fresh\n' > "$fresh_upload"
printf 'foreign\n' > "$foreign_file"
ln -s "${foreign_file##*/}" "$upload_symlink"

result=$(bash "$preflight_script" "$root" "$sha")

[[ "$result" =~ ^UPLOAD:(\.upload\.$sha\.[A-Za-z0-9]{6})$ ]]
upload_name=${BASH_REMATCH[1]}
test ! -e "$stale_upload"
test -f "$fresh_upload"
test -f "$foreign_file"
test -L "$upload_symlink"
test -f "$root/uploads/$upload_name"
test ! -L "$root"
test ! -L "$root/uploads"

matching_upload_count=0
new_upload_count=0
while IFS= read -r -d '' candidate; do
  candidate_basename=${candidate##*/}
  if [[ "$candidate_basename" =~ ^\.upload\.[0-9a-f]{40}\.[A-Za-z0-9]{6}$ ]]; then
    ((matching_upload_count += 1))
    if [[ "$candidate_basename" == "$upload_name" ]]; then
      ((new_upload_count += 1))
    else
      [[ "$candidate_basename" == "${fresh_upload##*/}" ]]
    fi
  fi
done < <(find "$root/uploads" -maxdepth 1 -type f -print0)
((matching_upload_count == 2))
((new_upload_count == 1))

rm -rf -- "$root"
ln -s /tmp "$root"
if bash "$preflight_script" "$root" 8888888888888888888888888888888888888888; then
  echo 'Preflight accepted a symlink deployment root.' >&2
  exit 1
fi

echo 'remote-upload-preflight.integration.sh: PASS'
