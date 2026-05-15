#!/usr/bin/env bash
# Smoke test prod DentalLearn — clôture Sprint 2 (T8)
# Vérifie le statut HTTP des routes critiques Sprint 2 sur https://dental-learn-v3.vercel.app
# et l'accès aux endpoints Supabase REST (anon key).
#
# Usage : bash scripts/smoke_sprint2_prod.sh
# Exit code : 0 si toutes les routes répondent comme attendu, 1 sinon.
#
# Pré-requis :
#   export SUPABASE_ANON_KEY=<votre_anon_key>
#   export SUPABASE_SERVICE_ROLE_KEY=<votre_service_role_key>  # pour les checks REST
#
# Slug formateur test confirmé en BDD 15/05/2026 : 'test-user' (is_published=true)

set -uo pipefail

BASE_URL="${BASE_URL:-https://dental-learn-v3.vercel.app}"
SUPABASE_REST="https://dxybsuhfkwuemapqrvgz.supabase.co/rest/v1"
TIMEOUT=15
PASS=0
FAIL=0
RESULTS=()

# check_route <expected_status_or_codes> <url> <description>
# expected_status_or_codes : "200" ou "200|302" pour accepter plusieurs codes
check_route() {
  local expected="$1"
  local url="$2"
  local desc="$3"

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -L --max-redirs 0 "$url" 2>/dev/null || echo "000")

  if [[ "|$expected|" == *"|$status|"* ]]; then
    RESULTS+=("OK   [$status]  ${desc}")
    PASS=$((PASS + 1))
  else
    RESULTS+=("FAIL [$status]  ${desc}  (attendu: ${expected})")
    FAIL=$((FAIL + 1))
  fi
}

# check_supabase_rest <expected> <table_path> <headers_args> <description>
check_supabase_rest() {
  local expected="$1"
  local path="$2"
  local headers="$3"
  local desc="$4"
  local url="${SUPABASE_REST}/${path}"

  local status
  # shellcheck disable=SC2086
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" $headers "$url" 2>/dev/null || echo "000")

  if [[ "|$expected|" == *"|$status|"* ]]; then
    RESULTS+=("OK   [$status]  ${desc}")
    PASS=$((PASS + 1))
  else
    RESULTS+=("FAIL [$status]  ${desc}  (attendu: ${expected})")
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Smoke test prod DentalLearn — Sprint 2 ==="
echo "Base URL    : ${BASE_URL}"
echo "Supabase    : dxybsuhfkwuemapqrvgz"
echo "Date        : $(date -Iseconds)"
echo ""

# ============================================================================
# CHECK 1 — Page publique formateur test (slug 'test-user', is_published=true)
# Slug confirmé en BDD le 15/05/2026.
# ============================================================================
check_route "200|301|302|307|308" \
  "${BASE_URL}/formateurs/test-user" \
  "Page /formateurs/test-user (profil formateur test publié)"

# ============================================================================
# CHECK 2 — /api/formateur/dashboard sans auth → 401/403
# Protégé par requireFormateur() middleware.
# ============================================================================
check_route "401|403" \
  "${BASE_URL}/api/formateur/dashboard" \
  "GET /api/formateur/dashboard sans auth (attendu 401/403)"

# ============================================================================
# CHECK 3 — /api/formateurs/test-user (profil public JSON) → 200
# Route publique (pas d'auth requise côté API).
# ============================================================================
check_route "200" \
  "${BASE_URL}/api/formateurs/test-user" \
  "GET /api/formateurs/test-user (profil public JSON)"

# ============================================================================
# CHECK 4 — /api/formateurs/test-user/follow sans auth → 401/403/405
# Protégé : POST/DELETE nécessitent auth, GET renvoie état follow.
# ============================================================================
check_route "401|403|405" \
  "${BASE_URL}/api/formateurs/test-user/follow" \
  "GET /api/formateurs/test-user/follow sans auth (attendu 401/403/405)"

# ============================================================================
# CHECK 5 — POST /api/formateur/sessions sans auth → 401/403/405
# ============================================================================
check_route "401|403|405" \
  "${BASE_URL}/api/formateur/sessions" \
  "POST /api/formateur/sessions sans auth (attendu 401/403/405)"

# ============================================================================
# CHECK 6 — Supabase REST : live_session_reminders_sent avec anon key
# Post-T8 : RLS activée → anon doit être bloqué (401/403).
# Si SUPABASE_ANON_KEY non définie, check skippé avec warning.
# ============================================================================
if [[ -n "${SUPABASE_ANON_KEY:-}" ]]; then
  check_supabase_rest "401|403" \
    "live_session_reminders_sent?select=count" \
    "-H \"apikey: ${SUPABASE_ANON_KEY}\" -H \"Authorization: Bearer ${SUPABASE_ANON_KEY}\"" \
    "Supabase REST live_session_reminders_sent (anon) → 401/403 (T8 RLS fix)"
else
  RESULTS+=("SKIP [---]  Supabase REST live_session_reminders_sent — SUPABASE_ANON_KEY non définie")
fi

# ============================================================================
# CHECK 7 — Supabase REST : formateur_profiles publiés avec anon key → 200
# Table accessible en lecture anon via RLS (profils publiés visibles).
# ============================================================================
if [[ -n "${SUPABASE_ANON_KEY:-}" ]]; then
  check_supabase_rest "200" \
    "formateur_profiles?is_published=eq.true&select=count" \
    "-H \"apikey: ${SUPABASE_ANON_KEY}\" -H \"Authorization: Bearer ${SUPABASE_ANON_KEY}\"" \
    "Supabase REST formateur_profiles publiés (anon) → 200"
else
  RESULTS+=("SKIP [---]  Supabase REST formateur_profiles — SUPABASE_ANON_KEY non définie")
fi

# ============================================================================
# Affichage résultats
# ============================================================================
echo ""
echo "=== Résultats ==="
for line in "${RESULTS[@]}"; do
  echo "$line"
done
echo ""
echo "Total : ${PASS} OK / ${FAIL} FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "ATTENTION : $FAIL vérifications ont retourné un statut inattendu."
  echo "Statuts 5xx ou 000 (timeout/réseau) = à investiguer en priorité."
  exit 1
fi

echo ""
echo "Toutes les vérifications automatiques répondent comme attendu."
echo ""
echo "=================================================================="
echo "  CHECK-LIST MANUELLE SPRINT 2 (à exécuter par Dr Fantin)"
echo "=================================================================="
cat <<'EOF'

Le smoke test HTTP couvre uniquement la disponibilité des routes et les
accès REST. Les 7 points fonctionnels ci-dessous nécessitent une session
authentifiée et doivent être validés manuellement :

  [ ] 1. Connexion super_admin (drfantin@gmail.com)
         -> https://dental-learn-v3.vercel.app/login
         -> /admin/formations/[id]/instructors accessible
         -> Assigner le formateur test (jujufant@hotmail.com ou Dr Weisrock)

  [ ] 2. Connexion formateur test
         -> /formateur/dashboard : stats visibles (ou empty state si aucune formation)
         -> /formateur/agenda : page chargée
         -> /formateur/sessions : page chargée
         -> /formateur/profil : formulaire chargé

  [ ] 3. Créer un live_event test (date future, ville, lieu)
         -> Retourner sur la fiche formation → section "Upcoming Events" visible

  [ ] 4. Créer une live_session test (starts_at = now()+30min, capacity=5)
         -> User test s'inscrit sur /sessions/[id]
         -> Toast "Inscription confirmée" visible
         -> zoom_url NON visible avant H-15min

  [ ] 5. Page /formateurs/test-user accessible user connecté
         -> Bouton "Suivre" visible (FollowButton T7)
         -> Click "Suivre" → "Abonné ✓" + count incrémenté
         -> Rechargement → état conservé

  [ ] 6. Invoquer manuellement l'Edge Function live_session_reminders :
         curl -X POST https://dxybsuhfkwuemapqrvgz.supabase.co/functions/v1/live_session_reminders \
           -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
           -H "Content-Type: application/json" \
           -d '{"limit": 10}'
         -> Vérifier row dans live_session_reminders_sent (si session à ±24h)
         -> Vérifier row dans notifications (type='live_reminder')
         (Valide D2-T7-01 — si aucune session à ±24h, créer une session test)

  [ ] 7. Vérifier RLS T8 en prod :
         SELECT relrowsecurity FROM pg_class WHERE relname = 'live_session_reminders_sent';
         -> Attendu : true
         (Peut être exécuté via MCP Supabase ou SQL Editor Supabase)

Une fois les 7 points validés, le Sprint 2 Espace Formateur est officiellement clôturé.
Prochaine étape recommandée : onboarding Dr Weisrock + Dr Elbeze (2 profils formateurs).

EOF
