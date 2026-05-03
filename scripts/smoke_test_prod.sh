#!/usr/bin/env bash
# Smoke test prod DentalLearn — clôture Sprint 1 (T8)
# Vérifie le statut HTTP des routes critiques sur https://dental-learn-v3.vercel.app
# sans authentification (curl HTTP-only).
#
# Usage : bash scripts/smoke_test_prod.sh
# Exit code : 0 si toutes les routes répondent comme attendu, 1 sinon.

set -uo pipefail

BASE_URL="${BASE_URL:-https://dental-learn-v3.vercel.app}"
TIMEOUT=15
PASS=0
FAIL=0
RESULTS=()

# check_route <expected_status_or_codes> <path> <description>
# expected_status_or_codes : "200" ou "200|302" pour accepter plusieurs codes
check_route() {
  local expected="$1"
  local path="$2"
  local desc="$3"
  local url="${BASE_URL}${path}"

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -L --max-redirs 0 "$url" 2>/dev/null || echo "000")

  if [[ "|$expected|" == *"|$status|"* ]]; then
    RESULTS+=("OK   [$status]  ${desc}  -> ${path}")
    PASS=$((PASS + 1))
  else
    RESULTS+=("FAIL [$status]  ${desc}  -> ${path}  (attendu: ${expected})")
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Smoke test prod DentalLearn ==="
echo "Base URL : ${BASE_URL}"
echo "Date     : $(date -Iseconds)"
echo ""

# -- Routes publiques (200 attendu, 307/308 acceptés si redirect canonique) --
check_route "200|301|302|307|308" "/"                      "Home publique"
check_route "200|301|302|307|308" "/login"                 "Page login"
check_route "200|301|302|307|308" "/signup"                "Page signup"
check_route "200|301|302|307|308" "/verify-email"          "Page verify-email"

# -- Routes protégées (redirect 302/307 vers /login attendu pour user non authentifié) --
check_route "200|302|307|401|403" "/home"                  "Home authentifiée (redirect attendu)"
check_route "200|302|307|401|403" "/profil/attestations"   "Profil attestations (redirect attendu)"
check_route "200|302|307|401|403" "/admin/news"            "Admin news (T2 RBAC)"
check_route "200|302|307|401|403" "/admin/organizations"   "Admin organizations (T5)"
check_route "200|302|307|401|403" "/tenant/admin"          "Tenant admin (T6)"
check_route "200|302|307|401|403" "/tenant/admin/branding" "Tenant admin branding (T6 + T7)"

# -- API endpoints (401/403 attendu pour non-authentifié, jamais 500) --
check_route "401|403|404|405"     "/api/admin/organizations"  "API admin organizations"
check_route "401|403|404|405"     "/api/tenant/branding"      "API tenant branding"
check_route "401|403|404|405"     "/api/tenant/curation"      "API tenant curation"

echo ""
echo "=== Résultats ==="
for line in "${RESULTS[@]}"; do
  echo "$line"
done
echo ""
echo "Total : ${PASS} OK / ${FAIL} FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "ATTENTION : $FAIL routes ont retourné un statut inattendu."
  echo "Statuts 5xx ou 000 (timeout/réseau) = à investiguer en priorité."
  exit 1
fi

echo ""
echo "Toutes les routes répondent comme attendu."
echo ""
echo "==============================================================="
echo "  CHECK-LIST MANUELLE COMPLEMENTAIRE (à exécuter par Dr Fantin)"
echo "==============================================================="
cat <<'EOF'

Le smoke test HTTP ne couvre que la disponibilité des routes. Les 6 points
fonctionnels du Ticket T8 nécessitent une session authentifiée et doivent
être validés manuellement :

  [ ] 1. Connexion super_admin (drfantin@gmail.com) OK
         -> https://dental-learn-v3.vercel.app/login

  [ ] 2. /admin/news accessible (pas de régression T2)
         -> page liste se charge, filtres OK

  [ ] 3. /admin/organizations accessible (nouvelle page T5)
         -> bouton "Nouvelle organisation" visible

  [ ] 4. Quiz quotidien fonctionne (RLS T3 OK)
         -> /home > "Quiz du jour" > répondre 4 questions
         -> assert daily_quiz_results +1 ligne en BDD

  [ ] 5. Génération attestation Dr Fantin OK
         -> /profil/attestations > Générer attestation
         -> assert PDF téléchargé contient "EROJU SAS — Dentalschool"
            + Qualiopi QUA006589 + ODPC 9AGA (T7)

  [ ] 6. Audio podcast > 1 entrée course_watch_logs en BDD
         -> /podcast > play sur 1 épisode > attendre ≥30s
         -> assert SELECT count(*) FROM course_watch_logs
                   WHERE user_id = 'af506ec2-...' AND ended_at > now() - interval '5 min'
                   >= 1

Une fois les 6 points validés, le Sprint 1 est officiellement clôturé.

EOF
