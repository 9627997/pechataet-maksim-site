#!/usr/bin/env bash
# Executed exclusively over authenticated SSH on REG.RU.
# No private costs, secret contents or stack traces are logged.
set -euo pipefail
BASE='/var/www/u2767403/data/www/private'
DEST="$BASE/pm-calc"
STAGE="${1:-}"
if [[ ! "$STAGE" =~ ^/var/www/u2767403/data/www/private/\.pm-calc-stage-[0-9]+-[0-9]+$ ]]; then
  echo 'BLOCK: private staging path outside allowlist' >&2
  exit 1
fi
[ -d "$STAGE" ] && [ ! -L "$STAGE" ] || { echo 'BLOCK: stage missing'; exit 1; }
[ -d "$BASE" ] && [ ! -L "$BASE" ] || { echo 'BLOCK: private root missing'; exit 1; }
for f in PmCalcPreview.php BigNat.php ExactPricing.php PmOrderRounding.php PmStudioOrderContract.php AVAILABILITY/PmAvailabilityGate.php config.php; do
  [ -f "$STAGE/$f" ] && [ ! -L "$STAGE/$f" ] || { echo 'BLOCK: missing PHP component' >&2; exit 1; }
  php -l "$STAGE/$f" >/dev/null
 done
php -r 'if (PHP_VERSION_ID < 80100) exit(2); $c=require $argv[1]; if (($c["preview_enabled"]??null)!==false || ($c["mode"]??null)!=="preliminary_only") exit(3);' "$STAGE/config.php" || { echo 'BLOCK: invalid PHP runtime or enabled preview' >&2; exit 1; }
php -r '$a=json_decode(file_get_contents($argv[1]),true,32,JSON_THROW_ON_ERROR);$s=json_decode(file_get_contents($argv[2]),true,32,JSON_THROW_ON_ERROR);foreach([$a,$s] as $v){foreach(["published","public_quote_enabled","physical_print_tests_verified"] as $k){if (($v[$k]??null)!==false)exit(4);}}' "$STAGE/ASSORTMENT_PRIVATE.json" "$STAGE/SILICONE_STAGING_PRIVATE.json" || { echo 'BLOCK: publication flags are not closed' >&2; exit 1; }
php -r 'require $argv[1]."/PmCalcPreview.php"; $x=new PmCalcPreview($argv[1]."/SNAPSHOT_ASSORTMENT_PRIVATE.json",$argv[1]."/ASSORTMENT_PRIVATE.json"); if(count($x->visibleCatalog())!==124)exit(5);' "$STAGE" || { echo 'BLOCK: private PHP catalog contract invalid' >&2; exit 1; }
chmod -R go-rwx "$STAGE"
BACKUP=''
if [ -e "$DEST" ]; then
  [ -d "$DEST" ] && [ ! -L "$DEST" ] || { echo 'BLOCK: existing private target unsafe'; exit 1; }
  BACKUP="$BASE/.pm-calc-backup-$(date +%Y%m%d%H%M%S)-$$"
  mv -- "$DEST" "$BACKUP"
fi
if ! mv -- "$STAGE" "$DEST"; then
  if [ -n "$BACKUP" ] && [ -d "$BACKUP" ]; then mv -- "$BACKUP" "$DEST"; fi
  echo 'BLOCK: failed private promotion; previous engine restored' >&2
  exit 1
fi
chmod 700 "$DEST"
echo 'PASS: private Pricing 2.0 installed outside webroot; public quoting remains disabled'
