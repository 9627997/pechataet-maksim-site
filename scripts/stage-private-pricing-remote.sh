#!/usr/bin/env bash
# Executed exclusively over authenticated SSH on REG.RU.
# No private costs, secret contents or stack traces are logged.
set -euo pipefail
BASE='/var/www/u2767403/data/www/private'
DEST="$BASE/pm-calc"
STAGE="${1:-}"
RELEASE_MODE="${2:-closed}"
# Only an explicitly approved deployment SHA may enable linked quote tokens.
QUOTE_RELEASE_MODE="${3:-closed}"
# Only explicitly approved preliminary display mode may enable quotations.
# It never enables orders, inventory claims, technical approval, or silicone.
case "$RELEASE_MODE" in
  closed|preliminary) ;;
  *) echo 'BLOCK: unknown public pricing mode' >&2; exit 1 ;;
esac
case "$QUOTE_RELEASE_MODE" in
  closed|enabled) ;;
  *) echo 'BLOCK: unknown linked quote mode' >&2; exit 1 ;;
esac
if [ "$QUOTE_RELEASE_MODE" = enabled ] && [ "$RELEASE_MODE" != preliminary ]; then
  echo 'BLOCK: quote tokens cannot run with public preliminary price disabled' >&2
  exit 1
fi
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
if [ "$RELEASE_MODE" = "preliminary" ]; then
  # The encrypted source secret stays closed and immutable. This change
  # applies only to the staged runtime config after every source proof passes.
  php -r 'if (hash_file("sha256", $argv[1]) !== $argv[2]) exit(1);' \
    "$STAGE/config.php" \
    '27f174a1b7b896515026966f12c4d29768e7f26f472f2dacbb5888c582eb0010' \
    || { echo 'BLOCK: unexpected sealed config' >&2; exit 1; }
  temporary_config="$STAGE/.config-preliminary-$"
  # The release switch is gated by an exact approved SHA in GitHub Environment
  # and never comes from a browser request or the Pricing 3 shadow observer.
  if [ "$QUOTE_RELEASE_MODE" = enabled ]; then
    quote_enabled_php=true
  else
    quote_enabled_php=false
  fi
  (umask 077; cat > "$temporary_config" <<PM_CONFIG
<?php
// Preliminary public price only. Linked orders still require manual approval.
// Quote tokens are enabled only for an explicitly approved release commit.
return ['preview_enabled' => true, 'mode' => 'preliminary_only',
        'quote_tokens_enabled' => ${quote_enabled_php}];
PM_CONFIG
  )
  php -l "$temporary_config" >/dev/null
  php -r '$c=require $argv[1]; $expected=$argv[2]==="enabled"; if (($c["preview_enabled"]??null)!==true || ($c["mode"]??null)!=="preliminary_only" || ($c["quote_tokens_enabled"]??null)!==$expected) exit(1);' \
    "$temporary_config" "$QUOTE_RELEASE_MODE" || { echo 'BLOCK: unsafe preliminary config' >&2; exit 1; }
  mv -- "$temporary_config" "$STAGE/config.php"
fi
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
if [ "$RELEASE_MODE" = "preliminary" ]; then
  echo "PASS: preliminary client estimates enabled; linked quote mode=${QUOTE_RELEASE_MODE}; production approval remains MANUAL"
else
  echo 'PASS: private Pricing 2.0 installed outside webroot; public quoting remains disabled'
fi
