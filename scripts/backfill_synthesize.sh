#!/usr/bin/env bash
# scripts/backfill_synthesize.sh
#
# Backfill manuel de l'Edge Function synthesize_articles (Ticket 5).
# Boucle des invocations HTTP POST jusqu'à épuisement des articles candidats
# (has_more=false dans la réponse), avec un cap dur d'invocations pour
# éviter une boucle infinie en cas de bug.
#
# Usage :
#   ./scripts/backfill_synthesize.sh
#
# Variables d'environnement supportées :
#   SUPABASE_URL              (default https://dxybsuhfkwuemapqrvgz.supabase.co)
#   BACKFILL_LIMIT            (default 15, max 15 — cap MAX_BATCH_LIMIT côté Edge)
#   BACKFILL_SLEEP_S          (default 2 — pause entre invocations)
#   BACKFILL_MAX_INVOCATIONS  (default 30 — cap dur anti-boucle infinie)
#   BACKFILL_FORCE            (default 0 ; 1 → body inclut "force": true)
#
# Sécurité (leçon Lz2 du Ticket 4) :
#   - SUPABASE_SERVICE_ROLE_KEY n'est jamais affichée à l'écran ni loggée.
#   - Saisie via `read -s` (silent input) avec vérification de longueur.
#   - Si la variable est déjà exportée dans l'environnement, on la
#     ré-utilise sans re-prompter (pratique pour CI / scripting).
#
# Cap MAX_INVOCATIONS=30 (leçon Lz nouvelle) : protection contre une boucle
# infinie si la fonction renvoie toujours has_more=true (bug, race
# condition, dérive Sonnet). 30 × 15 = 450 articles max/run du script,
# largement suffisant pour le backfill initial des 196 articles selected
# du Ticket 4 (≈14 invocations attendues, 2× la cible).
#
# Sortie : récap final stdout (compteurs cumulés + coût estimé) +
# code retour 0 si tout OK, 1 si HTTP non-200 / cap atteint avec has_more.

set -euo pipefail

# ----- Configuration -----
SUPABASE_URL="${SUPABASE_URL:-https://dxybsuhfkwuemapqrvgz.supabase.co}"
BACKFILL_LIMIT="${BACKFILL_LIMIT:-15}"
BACKFILL_SLEEP_S="${BACKFILL_SLEEP_S:-2}"
BACKFILL_MAX_INVOCATIONS="${BACKFILL_MAX_INVOCATIONS:-30}"
BACKFILL_FORCE="${BACKFILL_FORCE:-0}"

ENDPOINT="${SUPABASE_URL}/functions/v1/synthesize_articles"

# ----- Pré-requis : curl + jq -----
if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required but not installed." >&2
  exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required but not installed." >&2
  echo "Install : brew install jq  (macOS)  |  apt install jq  (Linux)" >&2
  exit 2
fi

# ----- Validation cap limite côté script -----
# Cap miroir du MAX_BATCH_LIMIT côté Edge Function (15). Le script ne peut pas
# imposer un limit > 15 — l'Edge Function le re-cappera silencieusement et
# loguera un warning "limit_capped". Mais autant éviter le détour.
if [ "$BACKFILL_LIMIT" -gt 15 ]; then
  echo "WARNING: BACKFILL_LIMIT=${BACKFILL_LIMIT} > 15, capping to 15 (Edge MAX_BATCH_LIMIT)." >&2
  BACKFILL_LIMIT=15
fi
if [ "$BACKFILL_LIMIT" -lt 1 ]; then
  echo "ERROR: BACKFILL_LIMIT must be >= 1 (got ${BACKFILL_LIMIT})." >&2
  exit 2
fi

# ----- Récupération de la SERVICE_ROLE_KEY -----
# Si déjà exportée → on la ré-utilise. Sinon → prompt silencieux.
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Saisie de la SUPABASE_SERVICE_ROLE_KEY (input invisible)..."
  echo -n "  > "
  # -s : silent (no echo to terminal). -r : pas d'interprétation backslash.
  read -rs SUPABASE_SERVICE_ROLE_KEY
  echo  # newline après l'input
fi

# Vérification longueur (leçon Lz2 du Ticket 4 : Authorization Bearer ""
# vide → 401 silencieux côté Supabase).
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY is empty after prompt." >&2
  exit 2
fi
KEY_LEN=${#SUPABASE_SERVICE_ROLE_KEY}
if [ "$KEY_LEN" -lt 100 ]; then
  echo "WARNING: SUPABASE_SERVICE_ROLE_KEY length=${KEY_LEN}, expected ≥100. Continuer ?" >&2
  read -r -p "  [y/N] " ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) exit 2 ;;
  esac
fi
echo "Key length OK (${KEY_LEN} chars)"

# ----- Body POST construction -----
if [ "$BACKFILL_FORCE" = "1" ]; then
  BODY="{\"limit\": ${BACKFILL_LIMIT}, \"force\": true}"
  echo "FORCE mode active : DELETE+INSERT même les synthèses 'active' existantes."
else
  BODY="{\"limit\": ${BACKFILL_LIMIT}}"
fi

echo "===================================================================="
echo " Backfill synthesize_articles"
echo "   endpoint        : ${ENDPOINT}"
echo "   limit           : ${BACKFILL_LIMIT}"
echo "   force           : ${BACKFILL_FORCE}"
echo "   sleep entre runs: ${BACKFILL_SLEEP_S}s"
echo "   cap invocations : ${BACKFILL_MAX_INVOCATIONS}"
echo "===================================================================="
echo

# ----- Compteurs cumulés -----
total_succeeded=0
total_failed=0
total_skipped=0
total_promoted=0
total_processed=0
total_cost_eur="0"
invocation=0
last_has_more=true

# ----- Boucle principale -----
while [ "$last_has_more" = "true" ] && [ "$invocation" -lt "$BACKFILL_MAX_INVOCATIONS" ]; do
  invocation=$((invocation + 1))
  echo "--- Invocation ${invocation}/${BACKFILL_MAX_INVOCATIONS} ---"

  # POST + capture HTTP status + body. -w écrit le status après le body
  # (séparé par un newline qu'on parse côté shell).
  http_response=$(curl -sS -w "\n__HTTP_STATUS:%{http_code}__" -X POST \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    "$ENDPOINT" || true)

  # Extraction status + body via paramètres bash.
  http_status="${http_response##*__HTTP_STATUS:}"
  http_status="${http_status%__}"
  body="${http_response%__HTTP_STATUS:*}"
  body="${body%$'\n'}" # strip trailing newline avant le marqueur

  if [ "$http_status" != "200" ]; then
    echo "  ERROR: HTTP ${http_status}"
    echo "  body: $(echo "$body" | head -c 500)"
    echo
    echo "Arrêt du backfill — vérifier les logs Supabase pour diagnostic."
    exit 1
  fi

  # Parse de la réponse via jq. Tous les champs sont garantis par le
  # RunSummary du run() côté Edge.
  succeeded=$(echo "$body" | jq -r '.articles_succeeded // 0')
  failed=$(echo "$body" | jq -r '.articles_failed // 0')
  skipped=$(echo "$body" | jq -r '.articles_skipped // 0')
  promoted=$(echo "$body" | jq -r '.promoted_to_permanent // 0')
  processed=$(echo "$body" | jq -r '.articles_processed // 0')
  remaining=$(echo "$body" | jq -r '.total_remaining_estimate // 0')
  has_more=$(echo "$body" | jq -r '.has_more // false')
  cost_eur=$(echo "$body" | jq -r '.estimated_cost_eur // 0')
  errors_count=$(echo "$body" | jq -r '.errors | length')

  echo "  processed=${processed}  succeeded=${succeeded}  failed=${failed}  skipped=${skipped}  promoted=${promoted}"
  echo "  remaining_after=${remaining}  has_more=${has_more}  cost_eur=${cost_eur}"
  if [ "$errors_count" != "0" ]; then
    echo "  WARN run-level errors (${errors_count}) :"
    echo "$body" | jq -r '.errors[]?' | sed 's/^/    - /'
  fi
  echo

  # Cumul (utilise bc pour les flottants côté coût ; les entiers via expr).
  total_succeeded=$((total_succeeded + succeeded))
  total_failed=$((total_failed + failed))
  total_skipped=$((total_skipped + skipped))
  total_promoted=$((total_promoted + promoted))
  total_processed=$((total_processed + processed))
  total_cost_eur=$(awk -v a="$total_cost_eur" -v b="$cost_eur" 'BEGIN {printf "%.4f", a + b}')

  last_has_more="$has_more"

  if [ "$processed" = "0" ]; then
    echo "  Aucun article traité cette invocation — fin de boucle (rien à faire)."
    break
  fi

  if [ "$last_has_more" = "true" ] && [ "$invocation" -lt "$BACKFILL_MAX_INVOCATIONS" ]; then
    sleep "$BACKFILL_SLEEP_S"
  fi
done

# ----- Récap final -----
echo "===================================================================="
echo " Backfill terminé"
echo "   invocations         : ${invocation}/${BACKFILL_MAX_INVOCATIONS}"
echo "   total processed     : ${total_processed}"
echo "   total succeeded     : ${total_succeeded}"
echo "   total failed        : ${total_failed}"
echo "   total skipped       : ${total_skipped}"
echo "   total promoted_perm : ${total_promoted}"
echo "   total cost EUR      : ${total_cost_eur}"
echo "===================================================================="

# Code retour 1 si on a atteint le cap avec has_more encore true (boucle
# probable côté Edge Function — diagnostic requis).
if [ "$last_has_more" = "true" ] && [ "$invocation" -ge "$BACKFILL_MAX_INVOCATIONS" ]; then
  echo
  echo "WARNING: cap MAX_INVOCATIONS=${BACKFILL_MAX_INVOCATIONS} atteint avec has_more=true."
  echo "         Diagnostic requis : un article peut boucler en failed sans promotion ?"
  echo "         Vérifier dans Supabase Logs Logflare les events 'article_failed' récents."
  exit 1
fi

exit 0
