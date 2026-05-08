# Protocole de test POC-T6 BLOC 2 — Drag & drop + Régénération LLM + Concepts + Versions

Date : 8 mai 2026
Pré-requis : session connectée en super_admin sur l'instance staging
DentalLearn V3.
Banc de test pilote : séquence
`e8dfa6b8-ef34-4454-a198-e6f973f466de` (Communication non verbale — 5 scènes).

URL principale : `/admin/timelines/formation/e8dfa6b8-ef34-4454-a198-e6f973f466de`.

Compter ~15 minutes pour dérouler le protocole complet (≈ 35 minutes
si on inclut le test de régénération LLM réelle, qui prend 25–35 s).

---

## Test 1 — Smoke ouverture pilote

1. Ouvrir l'URL ci-dessus.
2. Vérifier l'affichage en 3 colonnes (sidebar gauche, audio + preview
   centre, éditeur droit), avec en bas deux panneaux dépliables
   (« Concepts » et « Versions précédentes »).
3. Sidebar : 5 scènes listées, ordre par défaut figures/grid/comparison/
   grid/flowchart, avec une **poignée drag ⋮⋮** à gauche de chaque ligne.
4. Bouton « Régénérer via LLM » en bas de sidebar : style turquoise,
   hover OK, **PAS de spinner**.

✅ Si tout est conforme → test 2.
❌ Si la page plante / 500 → vérifier session admin + console réseau
    (le GET initial du JSON Storage peut échouer si le bucket est en
    privé).

---

## Test 2 — Drag-reorder cosmétique d'une scène (T6.4.b)

1. Noter le `start_sec` de la **scène 2** (afficher le panneau
   d'édition droit) — pour la pilote c'est ~52 s.
2. Saisir la poignée ⋮⋮ de la scène 2 (clic-drag).
3. Glisser au-dessus de la scène 1, déposer.
4. La liste se réorganise : scène 2 en première position, scène 1 en
   deuxième.
5. Bouton « Enregistrer » (header) doit s'activer.
6. Cliquer Enregistrer → toast vert « Sauvegardé (version …) ».
7. Recharger la page (F5).
8. Vérifier : ordre persisté en sidebar.
9. Cliquer sur ce qui était la scène 2 (maintenant en tête) →
   panneau droit montre `start_sec` ~52 s, **inchangé**.
10. Lancer le Play audio (centre). À t=52 s la preview affiche bien
    cette scène (whiteboard correspond) — preuve que `getActiveScene`
    fonctionne toujours sur la base de `start_sec`.

✅ Validations attendues : ordre persisté + `start_sec` inchangé +
    lecture audio toujours synchro.

---

## Test 3 — Tooltip « ? » en sidebar (T6.4.b)

1. En haut de sidebar, à côté de « Scènes (5) », repérer le bouton `?`.
2. Cliquer dessus.
3. Bandeau d'info apparaît : « L'ordre est cosmétique : il n'affecte
   pas la lecture audio. Les scènes restent jouées à leur start_sec. »
4. Re-cliquer → bandeau se ferme.

✅ Le bouton et le bandeau sont visibles, lisibles, et le toggle
   fonctionne.

---

## Test 4 — Drag-reorder cards intra-template (T6.4.c)

1. Sélectionner la scène **Grid** du pilote (3 cards).
2. Dans l'éditeur droit (panneau template), repérer les **3 poignées
   ⋮⋮** à gauche de chaque card.
3. Saisir la poignée de la card 3, glisser tout en haut.
4. Vérifier en preview centre : les cards changent d'ordre en temps
   réel.
5. Bouton Enregistrer s'active. Save. Reload. → ordre persisté.
6. Répéter pour :
   - Une scène **Flowchart** (steps reorder).
   - Une scène **Comparison** (reorder côté gauche → vérifier que
     côté droit n'est PAS affecté).
   - Une scène **Figures** (3 chiffres clés).
   - Une scène **Timeline** events (frise).
7. Pour chaque, vérifier la persistance après save+reload.

✅ Tous les sous-éditeurs concernés réordonnent correctement.

---

## Test 5 — Causal sans drag (T6.4.c)

1. Si le pilote n'a pas de scène causal, créer une scène temporaire :
   « + Ajouter une scène » → dropdown kind → « Causal ».
2. Vérifier qu'**AUCUNE** poignée ⋮⋮ n'est présente dans l'éditeur
   causal (ni sur les nœuds ni sur les liens).
3. Les boutons « + Nœud », « + Lien », et les × restent fonctionnels.
4. Supprimer la scène temporaire en sortie.

✅ Pas de drag affiché, édition manuelle conservée.

---

## Test 6 — Drag clavier (a11y) (T6.4)

1. Sur la sidebar, presser **Tab** jusqu'à atteindre une poignée drag
   d'une scène (l'item devient focusé).
2. Presser **Espace** pour saisir.
3. Flèches **Bas** ou **Haut** pour déplacer la scène d'un cran.
4. **Espace** pour déposer.
5. La liste s'est réorganisée comme attendu. Bouton Enregistrer s'active.

✅ Le drag est accessible au clavier (utile pour les utilisateurs
    sans souris ou avec tablette).

---

## Test 7 — Régénération LLM — modal (T6.5.a, sans confirmation)

1. Cliquer le bouton « Régénérer via LLM » en bas de sidebar.
2. Vérifier l'ouverture de la modal :
   - Titre « Régénérer la timeline via LLM ? »
   - Texte expliquant l'action
   - Coût estimé : ~0,07 €
   - Durée : 25 – 35 s
   - Mention « l'ancienne version reste accessible »
   - Boutons « Annuler » et « Confirmer »
3. Cliquer **Annuler** → modal disparaît, aucune requête réseau.
4. Re-cliquer le bouton, puis cliquer **hors modal** (sur l'overlay
   noir) → idem, modal disparaît.

✅ Modal fonctionne, annulation propre.

---

## Test 8 — Régénération LLM — appel réel (T6.5.a)

⚠️ Ce test consomme des tokens Anthropic (~0,07 €). À ne dérouler
que sur un environnement où c'est OK.

1. Cliquer le bouton « Régénérer via LLM ».
2. Cliquer **Confirmer** dans la modal.
3. Le bouton sidebar se met en spinner (« Génération… »).
4. L'éditeur (3 colonnes + footer panels) devient grisé
   (`pointer-events-none + opacity-60`) — clic impossible.
5. Attendre 25 – 35 s.
6. Toast vert apparaît : « Nouvelle version générée — N scènes,
   M concepts, X,XX € ».
7. La sidebar affiche les nouvelles scènes (potentiellement N≠5).
8. Le panneau « Versions précédentes » affiche maintenant 1 entrée de
   plus, avec la nouvelle en tête badgée `[ACTUELLE]`.
9. Bouton Enregistrer reste **disabled** (la timeline a été
   persistée côté serveur par la route `extract-scenes`, pas de
   modif locale dirty).

✅ La régénération a fonctionné de bout en bout.

---

## Test 9 — Échec régénération LLM (T6.5.a)

1. Couper le réseau (DevTools → Network → Offline) ou bloquer la route
   `/api/admin/timeline/extract-scenes` via un proxy local.
2. Cliquer « Régénérer via LLM » → Confirmer.
3. Toast rouge attendu : « Régénération échouée : … » avec un détail
   d'erreur.
4. UI éditeur redevient utilisable (`isRegenerating === false`).
5. Aucune nouvelle version en panneau « Versions précédentes ».
6. Rétablir le réseau et continuer.

✅ Gestion d'erreur propre, état restauré.

---

## Test 10 — Concepts éditeur — toggle, édition, ajout (T6.5.b)

1. Faire défiler en bas de page jusqu'au panneau **Concepts (12)**.
2. Vérifier qu'il est **collapsed** par défaut (chevron pointe vers
   le bas).
3. Cliquer pour ouvrir → liste des 12 concepts du pilote, chacun avec
   checkbox « Afficher » cochée par défaut.
4. **Toggle hidden** : décocher la case du concept 1 → la card devient
   plus pâle (opacity 60). Save (header) → reload → la case est
   redevenue cochée si on n'a pas re-modifié, sinon `hidden:true` est
   bien persisté dans le JSON Storage.
5. **Édition term/definition** : modifier le term du concept 2 (max 60
   chars — vérifier compteur orange à 50, rouge à 61). Save → reload
   → modification persistée.
6. **Suppression** : cliquer la corbeille du concept 3 → confirm()
   natif → confirmer → concept retiré. Save+reload → 11 concepts.
7. **Ajout manuel** : « + Ajouter manuellement » → modal :
   - Term : « Test concept BLOC 2 »
   - Definition : « Définition test pour valider l'ajout »
   - Position : 42
   - Cliquer Ajouter → modal disparaît, concept apparaît en bas de
     liste avec libellé `généré_manuel`.
   - Save → reload → persistance OK.
8. **Validation modal** :
   - Re-cliquer « + Ajouter manuellement », laisser term vide → bouton
     « Ajouter » disabled.
   - Saisir at_sec = -1 → bordure rouge + message d'erreur.
   - Saisir at_sec = 99999 (au-delà durée audio) → idem.

✅ Toutes les actions concept fonctionnent.

---

## Test 11 — Versions précédentes (T6.5.c)

1. Ouvrir le panneau **Versions précédentes (N)** en bas de page.
2. Vérifier l'affichage :
   - Liste triée date desc.
   - Nom de chaque version au format `2026-05-08T12-56-44-142Z`.
   - Première entrée badgée `[ACTUELLE]` en turquoise.
3. Cliquer « Voir cette version » sur une version non-actuelle.
4. Nouvel onglet ouvre l'URL Storage publique → JSON brut affiché.
5. Vérifier que cette URL n'est PAS la même que celle marquée
   `[ACTUELLE]`.
6. Pas de bouton « Restaurer » ni d'autre action de rollback (V1).

✅ Versions visibles, navigation OK, pas de rollback automatique.

---

## Test 12 — Régression news (T6.5)

1. Ouvrir une page news : `/admin/timelines/news/<uuid_synthese>`.
2. Si la synthèse n'a pas de timeline_url → bandeau orange habituel
   « Aucune timeline générée ».
3. Si la synthèse a une timeline (cas T8 futur), vérifier que :
   - Le bouton « Régénérer via LLM » est **disabled** (opacité réduite),
     hover montre le tooltip « Régénération LLM non disponible pour ce
     type de source ».
   - Tous les autres comportements (drag-reorder scène, drag-reorder
     cards, concepts, versions) fonctionnent identiques aux formations.

✅ Pas de régression news.

---

## Sortie attendue

Tous les tests 1–12 verts → POC-T6 BLOC 2 livré.
Si l'un échoue → noter le numéro de test et envoyer un screenshot
+ le contenu du toast d'erreur dans le retour.
