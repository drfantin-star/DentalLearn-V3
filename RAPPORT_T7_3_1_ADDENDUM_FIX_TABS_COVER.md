# Addendum POC-T7.3.1 — Fix tabs UI masqués + cover mobile dupliquée

> Micro-correctif post-T7.3 livré sur la même branche
> `claude/integrate-enriched-audio-player-9tqQP`. Suit le smoke Vercel
> preview de Dr Fantin sur le commit T7.3 `cc06aab` qui a relevé deux
> régressions visuelles.
>
> Date : 10/05/2026.
> Périmètre strict : tab UI + cover duplication. Hors scope : T7.4.

---

## §1. Diagnostic mécanisme `activeTab` (résultat investigation §1 prompt)

### 1.1 Lecture de `EnrichedAudioPlayer.tsx` (T7.2)

| Élément | État réel | Hypothèse prompt T7.3.1 |
|---|---|---|
| Type de `activeTab` | Prop **REQUISE** (`activeTab: EnrichedPlayerTab`, lignes 38, 61) | « controlled qui désactive la barre quand fournie » |
| `useState` interne pour `activeTab` | **Absent** | (impliqué par l'hypothèse) |
| Valeur par défaut interne | **Absente** (prop required) | (impliqué) |
| Rendu d'une barre de tabs | **Aucun** dans le composant | « la barre UI » |

### 1.2 Lecture de `EnrichedPlayerPocClient.tsx` (page démo T7.2)

- Lignes 52, 74, 158-184 : la barre `<TabSelector>` (3 boutons pill rounded-full) **vit dans le client de la page démo**, pas dans `<EnrichedAudioPlayer>`.
- Le state `useState<EnrichedPlayerTab>('combined')` est local à ce client.
- La page démo passe `activeTab={activeTab}` à `<EnrichedAudioPlayer>` en mode controlled.

### 1.3 Conclusion

→ **Retirer `activeTab="combined"` au call-site (b) ne pouvait restaurer aucune barre de tabs** (il n'y a jamais eu de barre rendue par `<EnrichedAudioPlayer>`), et aurait cassé le build TypeScript (prop required manquante).

→ **STOP, remontée à Dr Fantin** conformément à l'instruction du prompt § *« Si la prop fonctionne autrement → stop, remonter avant patcher »*.

### 1.4 Décision Dr Fantin (chat session 10/05/2026)

**Option A retenue** : ajouter `useState<EnrichedPlayerTab>('combined')` + une `<EnrichedTabSelector>` inline dans `SequencePlayer.tsx` au call-site (b). Design repris à l'identique de la démo (3 boutons pill rounded-full, fond `ds-turquoise` actif). Aucun fichier protégé modifié pour la partie tabs.

---

## §2. Diff appliqué pour les tabs (call-site b)

### 2.1 Imports

```diff
 import AudioPlayer from './AudioPlayer'
-import EnrichedAudioPlayer from './EnrichedAudioPlayer'
+import EnrichedAudioPlayer, { type EnrichedPlayerTab } from './EnrichedAudioPlayer'
 import TreasureChest from '@/components/sequences/TreasureChest'
```

### 2.2 State

```diff
   const [playerStep, setPlayerStep] = useState<PlayerStep>(showVideo ? 'video' : 'quiz')
   const [courseCompleted, setCourseCompleted] = useState(false)
   const [courseProgress, setCourseProgress] = useState(0)
+  const [enrichedActiveTab, setEnrichedActiveTab] = useState<EnrichedPlayerTab>('combined')
```

Default `'combined'` cohérent avec Q2 et la démo T7.2.

### 2.3 Call-site (b) (lignes 637-653 post-T7.3, +6 lignes en T7.3.1)

```diff
             {/* ─── AudioPlayer enrichi (POC-T7.3) ─── */}
             {mediaType === 'audio' && sequence.course_media_url && (
               <div className="mb-6">
+                {sequence.timeline_url && sequence.timeline_published && (
+                  <EnrichedTabSelector
+                    active={enrichedActiveTab}
+                    onChange={setEnrichedActiveTab}
+                  />
+                )}
                 <EnrichedAudioPlayer
                   src={sequence.course_media_url}
                   …
                   timelineUrl={sequence.timeline_url ?? null}
                   timelinePublished={sequence.timeline_published ?? false}
-                  activeTab="combined"
+                  activeTab={enrichedActiveTab}
                 />
               </div>
             )}
```

**Conditionnel d'affichage de la barre** : la barre de tabs **n'apparaît que si la séquence a une timeline publiée** (`timeline_url && timeline_published`). Justification :

- Si la séquence n'a pas de timeline (pilote unique en T7.3, autres séquences à venir T5-bis/T9), le panneau enrichi ne se rend pas (cf. `<EnrichedAudioPlayer>` Q6 fallback). Une barre de tabs « Combiné / Whiteboard / Audio seul » n'aurait alors aucun effet visible → on évite le bruit UX.
- Dès qu'une séquence a `timeline_published === true`, la barre apparaît automatiquement.

### 2.4 Sous-composant `<EnrichedTabSelector>` (ajout +37 lignes en fin de fichier)

```tsx
function EnrichedTabSelector({
  active,
  onChange,
}: {
  active: EnrichedPlayerTab
  onChange: (tab: EnrichedPlayerTab) => void
}) {
  const tabs: { id: EnrichedPlayerTab; label: string; hint: string }[] = [
    { id: 'combined',   label: 'Combiné',   hint: 'Karaoké + Whiteboard' },
    { id: 'whiteboard', label: 'Whiteboard', hint: 'Visuels seuls' },
    { id: 'audio_only', label: 'Audio seul', hint: 'Player nu (pas d\'enrichissement)' },
  ]
  return (
    <div className="flex flex-wrap justify-center gap-2 mb-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            active === t.id
              ? 'bg-ds-turquoise text-[#0F0F0F]'
              : 'border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] text-[color:var(--color-text-primary)] hover:border-ds-turquoise/50 hover:bg-[color:var(--color-bg-card-hover)]'
          }`}
          title={t.hint}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
```

Différences mineures vs la `<TabSelector>` de la démo :
- `justify-center` ajouté pour centrer la barre (cohérent avec le wrapper `text-center py-6` du call-site b dans `SequencePlayer`).
- `mb-4` ajouté pour gap visuel entre tabs et `<EnrichedAudioPlayer>`.
- `type="button"` ajouté pour éviter qu'un éventuel `<form>` parent ne capture le clic.

Tokens utilisés (vérifiés présents) :
- `ds-turquoise` (`tailwind.config.ts:14`).
- `--color-bg-card-hover` (`src/app/globals.css:25`).

---

## §3. Diagnostic cover mobile dupliquée (résultat investigation §2 prompt)

### 3.1 Recherche systématique des `<img>` / `coverImageUrl` user-side

| Lieu | Render | Statut |
|---|---|---|
| `(app)/formation/page.tsx:231` `(app)/patient/page.tsx:216` | Cards de sélection séquence (vue *liste*) | Hors flow rendu pendant la séquence — masqué par le viewMode parent. **Pas la source.** |
| `SequencePlayer.tsx` | `coverImageUrl` est uniquement *passé* à `<AudioPlayer>` (call-site a ligne 565) et `<EnrichedAudioPlayer>` (call-site b ligne 646). **Aucun `<img>` rendu directement.** | **Pas la source.** |
| `AudioPlayer.tsx:88-98` (`md:hidden`) | Mobile cover 160×160 au-dessus de la carte gradient | **Cover #1 légitime** (existait avant T7.3, identique au comportement legacy). |
| `AudioPlayer.tsx:104-114` (`hidden md:flex`) | Desktop cover 280×280 à côté de la carte gradient | Pas la source mobile. |
| `EnrichedAudioPlayer.tsx:218-247` (`<WhiteboardOrCover>` fallback Q6 cas 5) | Cover dans le panneau enrichi quand `displayedScene === null` (gap initial) | **Cover #2 — source identifiée.** |

### 3.2 Diagnostic Cas A/B/C

→ **Cas B confirmé** : la duplication est interne à `<EnrichedAudioPlayer>` (sous-composant `<WhiteboardOrCover>` rend la cover quand aucune scène n'est active, en plus de la cover déjà rendue par `<AudioPlayer>` au-dessus).

Sur mobile en Variante A (whiteboard sticky top-0, cf. T7.2 D2), tant que `currentTime < scene[0].start_sec` (gap initial), Cover #2 reste collée en haut de la zone de scroll **en plus** de Cover #1 qui suit le flow normal du document juste au-dessus → deux fois la même image visible simultanément.

Sur desktop, les deux covers s'affichent dans des positions différentes (#1 à gauche de la carte AudioPlayer, #2 dans la colonne whiteboard à droite) — moins jarrant visuellement mais toujours redondant.

### 3.3 Décision Dr Fantin (chat session 10/05/2026)

**Protection `EnrichedAudioPlayer.tsx` levée explicitement** pour ce point. Diff strictement limité au sous-composant `<WhiteboardOrCover>` et à ses 2 call-sites internes au composant.

Sous-option de fix retenue (parmi les 3 du prompt) : **« supprimer la branche cover du fallback »** — la fallback Q6 cas 5 affiche désormais uniquement le placeholder texte *« Visualisation suivante à venir… »*, qui était déjà le comportement pour les séquences sans `coverImageUrl`. La cover image n'est plus jamais rendue par `<EnrichedAudioPlayer>` lui-même.

Justification :
- Cover #1 (mobile) reste intacte : `<AudioPlayer>` continue de l'afficher, comportement legacy non modifié.
- Cover desktop reste intacte côté `<AudioPlayer>` (à gauche de la carte gradient, lignes 104-114).
- Cover #2 dans `<WhiteboardOrCover>` était une duplication superflue ; le placeholder texte reste informatif (« la prochaine scène arrive »).

---

## §4. Diff appliqué pour la cover (`EnrichedAudioPlayer.tsx`)

### 4.1 `<WhiteboardOrCover>` interface props (suppression `coverImageUrl` + `title`)

```diff
 interface WhiteboardOrCoverProps {
   displayedScene: Scene | null
   timeline: NonNullable<ReturnType<typeof useEnrichedTimeline>['timeline']>
-  coverImageUrl?: string | null
-  title?: string
 }

 function WhiteboardOrCover({
   displayedScene,
   timeline,
-  coverImageUrl,
-  title,
 }: WhiteboardOrCoverProps) {
```

### 4.2 `<WhiteboardOrCover>` body fallback (remplace conditionnel `<img>`/`<p>` par `<p>` seul)

```diff
   return (
     <div className="bg-[color:var(--color-bg-card)]/30 rounded-xl p-6 flex items-center justify-center min-h-[240px]">
-      {coverImageUrl ? (
-        <img
-          src={coverImageUrl}
-          alt={title ?? 'Cover'}
-          className="max-h-[240px] w-auto rounded-lg object-contain"
-        />
-      ) : (
-        <p className="text-sm italic text-[color:var(--color-text-muted)]">
-          Visualisation suivante à venir…
-        </p>
-      )}
+      <p className="text-sm italic text-[color:var(--color-text-muted)]">
+        Visualisation suivante à venir…
+      </p>
     </div>
   )
 }
```

### 4.3 Les 2 call-sites internes à `<EnrichedAudioPlayer>` (suppression props passées)

```diff
   // Tab whiteboard (ligne ~147)
   <WhiteboardOrCover
     displayedScene={displayedScene}
     timeline={timeline}
-    coverImageUrl={coverImageUrl}
-    title={sequenceTitle}
   />

   // Tab combined, colonne whiteboard (ligne ~178)
   <WhiteboardOrCover
     displayedScene={displayedScene}
     timeline={timeline}
-    coverImageUrl={coverImageUrl}
-    title={sequenceTitle}
   />
```

### 4.4 Commentaire JSDoc actualisé (Q6 cas 5)

```diff
 // ──────────────────────────────────────────────────────────────
 // Sous-composant : whiteboard quand une scène doit être affichée
-// (active ou en extension via getActiveOrLastScene), cover sinon
-// (uniquement le gap initial avant la première scène — Q6 cas 5).
+// (active ou en extension via getActiveOrLastScene), placeholder
+// texte sinon (uniquement le gap initial avant la première scène
+// — Q6 cas 5). T7.3.1 : la cover image n'est plus rendue ici car
+// `<AudioPlayer>` affiche déjà la cover (mobile au-dessus de la
+// carte gradient, desktop à gauche), ce qui produisait une
+// duplication visible en flow user (cf. dette D7-13 résolue T7.3.1).
 // ──────────────────────────────────────────────────────────────
```

### 4.5 Récap diff `EnrichedAudioPlayer.tsx`

`git diff --stat` : `30 lignes touchées (+10 / -20 net = -10)`. Périmètre 100 % contenu dans le sous-composant `<WhiteboardOrCover>` + ses 2 call-sites internes au composant. Aucun changement à la signature publique (`EnrichedAudioPlayerProps` inchangée), aucun changement à la logique audio / DPC / `useAudio()`.

**Note** : `coverImageUrl` et `sequenceTitle` restent passés au composant principal `<EnrichedAudioPlayer>` car ils sont toujours consommés par `<AudioPlayer>` (lignes 136, 139). Pas de modification de la signature publique.

---

## §5. Conformité contraintes architecturales T7.3.1

| Contrainte | Statut | Preuve |
|---|---|---|
| `src/context/AudioContext.tsx` non modifié | ✅ | `git diff origin/main -- src/context/AudioContext.tsx` = vide |
| `src/components/formation/AudioPlayer.tsx` non modifié | ✅ | `git diff origin/main -- src/components/formation/AudioPlayer.tsx` = vide |
| `src/components/formation/EnrichedAudioPlayer.tsx` modifié — protection levée explicitement par Dr Fantin (§3.3) | ✅ scope limité | Diff 100 % dans `<WhiteboardOrCover>` + 2 call-sites internes ; signature publique inchangée |
| Call-site (a) intro audio (lignes 558-571) inchangé | ✅ | `<AudioPlayer>` legacy mot pour mot, vérifié au repo post-patch |
| DPC `course_watch_logs` write path immuable | ✅ | Aucune écriture nouvelle. La barre de tabs ne touche pas l'AudioContext. La suppression du `<img>` cover n'affecte pas le DPC. |
| Anti-skip jamais contourné | ✅ | Aucun appel `seekTo` / `audio.currentTime` ajouté. |
| Lecture seule sur AudioContext | ✅ | `<EnrichedTabSelector>` ne consomme PAS `useAudio()`. |
| Pas de `localStorage` / `sessionStorage` | ✅ | `grep` négatif sur les fichiers modifiés. |
| Modèle LLM `claude-sonnet-4-6` | n/a | Pas d'appel LLM. |
| Seul write path `user_points` = `useSubmitSequenceResult` | n/a | Pas touché. |
| Enum `point_reason` jamais `'sequence_completed'` | n/a | Pas touché. |

---

## §6. `npm run build` — vérification

```
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
```

→ **Compilation TypeScript clean, aucun nouveau warning lié au patch T7.3.1**. Linting valide.

⚠️ Erreurs `prerender-error` qui suivent : pré-existantes (env vars Supabase manquantes en sandbox). Cf. T7.2 §8 row 15, T7.3 §9.

---

## §7. Critères d'acceptation T7.3.1 — checklist

| # | Critère | Statut | Preuve |
|---|---|---|---|
| 1 | Diff minimal sur `SequencePlayer.tsx` (ajout state + tab selector + remplacement prop) | ✅ +47 / −2 (incl. `<EnrichedTabSelector>` 37 lignes) | §2 |
| 2 | `<EnrichedAudioPlayer>` modifié : 100 % dans `<WhiteboardOrCover>` (autorisé par Dr Fantin §3.3) | ✅ Scope limité, signature publique inchangée | §4 |
| 3 | `AudioPlayer.tsx`, `AudioContext.tsx` : 0 ligne diff vs `origin/main` | ✅ | `git diff --stat origin/main` |
| 4 | Call-site (a) lignes 558-571 inchangé | ✅ | Vérifié post-patch |
| 5 | `npm run build` clean | ✅ | §6 |
| 6 | Cover Cas A/B/C identifié + justification | ✅ Cas B | §3 |
| 7 | Cover patchée (sous-option choisie + diff exact) | ✅ « supprimer la branche cover du fallback » | §4 |
| 8 | Tab selector affiché conditionnellement (`timeline_url && timeline_published`) | ✅ | §2.3 |
| 9 | Addendum T7.3.1 rédigé à la racine | ✅ | Ce document |
| 10 | Push sur `claude/integrate-enriched-audio-player-9tqQP` | ⏳ | Étape suivante |

---

## §8. Statut critères d'acceptation T7.3 final (post-T7.3.1)

| # | Critère T7.3 (rappel rapport T7.3 §12) | Statut |
|---|---|---|
| 1 | Diff minimal sur SequencePlayer.tsx (call-site b + import) | ✅ T7.3 + extension T7.3.1 (state + tab UI) |
| 2 | Call-site (a) inchangé | ✅ |
| 3 | AudioContext.tsx, AudioPlayer.tsx, EnrichedAudioPlayer.tsx : 0 ligne diff | ⚠️ EnrichedAudioPlayer modifié en T7.3.1 — protection levée (§3.3) |
| 4 | `npm run build` clean | ✅ T7.3.1 §6 |
| 5 | Investigation D7-7 documentée | ✅ T7.3 §5 |
| 6 | Inspection ancestor layout D7-10 documentée | ✅ T7.3 §6 |
| 7 | Schéma BDD vérifié | ✅ T7.3 §3 |
| 8 | État pilote BDD documenté | ✅ T7.3 §3.2 |
| 9 | Plan smoke local | ✅ T7.3 §8 |
| 10 | Branche conservée | ✅ |
| 11 | Rapport T7.3 + addendum T7.3.1 | ✅ |

---

## §9. Smoke utilisateur attendu post-T7.3.1

À valider par Dr Fantin sur Vercel preview de la branche après push :

| # | Cas | Attendu post-T7.3.1 |
|---|---|---|
| 1 | Desktop : barre de 3 tabs présente entre `<AudioPlayer>` et panneau enrichi | ✅ visible (tabs au centre, mb-4) |
| 2 | Mobile : barre de 3 tabs présente entre `<AudioPlayer>` et panneau enrichi | ✅ visible |
| 3 | Clic sur "Whiteboard" | Karaoké disparaît, seul whiteboard reste rendu en pleine largeur |
| 4 | Clic sur "Audio seul" | Panneau enrichi disparaît, seul `<AudioPlayer>` reste rendu |
| 5 | Clic sur "Combiné" (default) | Karaoké + whiteboard côte à côte (desktop) ou stack vertical (mobile) |
| 6 | Mobile : cover orange unique (au-dessus de l'AudioPlayer card) | ✅ Plus de duplication ; placeholder texte « Visualisation suivante à venir… » à la place de la 2ᵉ cover dans le whiteboard column en gap initial |
| 7 | Desktop : cover unique à gauche de l'AudioPlayer card | ✅ Idem ; whiteboard column affiche le placeholder texte en gap initial |
| 8 | Tabs masqués pour séquences sans `timeline_published` | ✅ La barre n'apparaît pas (cohérent avec fallback Q6) |
| 9 | DPC `course_watch_logs` non-régressé vs T7.3 cc06aab | ✅ Aucun nouveau write path. À reconfirmer au smoke. |
| 10 | Anti-skip toujours actif | ✅ Aucun nouveau seek introduit. |

---

## §10. Restant T7.4

(rappel rapport T7.3 §11, complété)

1. ~~**Smoke local** sur compte user non super_admin~~ — couvert au smoke prod via Vercel preview T7.3 cc06aab.
2. **Smoke utilisateur sur Vercel preview T7.3.1** — §9 ci-dessus, à valider Dr Fantin sur le push de cet addendum.
3. ~~**Tab selector UI** — concevoir et brancher~~ → ✅ livré T7.3.1 §2 (design pris-en-l'état de la démo, sous-réserve d'ajustements esthétiques en T7.4).
4. **Fix D7-7** (`demoMode = true` ligne 238) — toujours ouvert.
5. **Validation MiniPlayer mobile** lors de la sortie de viewport AudioPlayer — toujours ouvert.
6. **Logger D7-11** (fenêtre karaoké fixe Spotify-like mobile) — toujours ouvert.
7. ~~**D7-13 cover dupliquée**~~ → ✅ résolu T7.3.1 §4.
8. **Recap final T7** — fusionner T7.0 + T7.1 + T7.2 + T7.3 + T7.3.1 + smoke prod.

---

*Fin de l'addendum T7.3.1. Prochaine étape : commit + push sur
`claude/integrate-enriched-audio-player-9tqQP`, smoke Vercel preview Dr
Fantin, ouverture PR.*
