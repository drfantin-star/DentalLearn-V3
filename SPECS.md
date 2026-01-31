# DENTALLEARN V3 - SPÉCIFICATIONS TECHNIQUES COMPLÈTES
## Document de référence pour Claude Code

---

## 📋 CONTEXTE DU PROJET

**DentalLearn V3** est une application web/mobile de formation continue gamifiée pour chirurgiens-dentistes français. Elle accompagne les praticiens dans leur obligation de formation avec un format engageant inspiré de Duolingo.

### Principes clés V3
- ❌ **PAS de mention "Certification Périodique" ou "CP"** visible pour l'utilisateur
- ✅ 4 axes de progression (sans les nommer CP)
- ✅ Formations enrichies : Cours vidéo/audio → Quiz → Récompense (coffre PDF)
- ✅ Modèle Freemium/Premium
- ✅ Section Veille métier (actualités)

### Stack technique
- **Frontend** : Next.js 14+ (App Router), React 18, TypeScript
- **Styling** : Tailwind CSS
- **Backend** : Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Déploiement** : Vercel
- **Icons** : Lucide React
- **Animations** : Framer Motion

---

## 🎨 CHARTE GRAPHIQUE DENTALSCHOOL

### Couleurs
```css
:root {
  /* Brand Dentalschool */
  --ds-turquoise: #00D1C1;
  --ds-turquoise-dark: #00B8A9;
  --ds-blue-deep: #2D1B96;
  --ds-blue-dark: #1A0F5C;
  
  /* Axes (couleurs internes, pas affichées à l'utilisateur) */
  --axe1-color: #2D1B96; /* Connaissances */
  --axe2-color: #00D1C1; /* Pratiques */
  --axe3-color: #F59E0B; /* Relation Patient */
  --axe4-color: #EC4899; /* Santé Pro */
  
  /* États */
  --success: #10B981;
  --warning: #F59E0B;
  --error: #EF4444;
  
  /* Neutres */
  --gray-50: #F8FAFC;
  --gray-100: #F1F5F9;
  --gray-400: #94A3B8;
  --gray-600: #475569;
  --gray-900: #0F172A;
}
```

### Composants UI
- **Border radius** : 12px (buttons), 16px (cards), 24px (modals)
- **Shadows** : Tailwind `shadow-sm`, `shadow-md`
- **Transitions** : 300ms ease-in-out
- **Points** : Toujours multiples de 5

---

## 📱 ÉCRAN D'ACCUEIL (HOME)

### Structure
```
┌─────────────────────────────────────────┐
│ HEADER                                  │
│ [Avatar] Bonjour, Dr. Martin  [🔥12][🔔]│
├─────────────────────────────────────────┤
│ PROGRESSION GLOBALE (pas de titre)      │
│ ┌─────────────────────────────────────┐ │
│ │ 🎓 [████░░░░] │ │
│ │ 🛡️ [██████░░] │ │
│ │ 🤝 [██░░░░░░] │ │
│ │ 💗 [░░░░░░░░] │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ENTRAÎNEMENT DU JOUR        [2/4]       │
│ ┌─────────┐ ┌─────────┐                 │
│ │Connais. │ │Pratiques│                 │
│ │CCAM 2026│ │ ✓ Fait  │                 │
│ │[+1 pt]  │ │[██████] │                 │
│ └─────────┘ └─────────┘                 │
│ ┌─────────┐ ┌─────────┐                 │
│ │Relation │ │Santé Pro│                 │
│ │Annonce  │ │Ergonomie│                 │
│ │[+1 pt]  │ │[+1 pt]  │                 │
│ └─────────┘ └─────────┘                 │
├─────────────────────────────────────────┤
│ MA FORMATION               [Catalogue >]│
│ ┌─────────────────────────────────────┐ │
│ │ 🎬 Éclaircissements & Taches...     │ │
│ │ Dr Elbeze • Séquence 5/15           │ │
│ │ [████████░░░░░░░░░░░░] [Continuer]  │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ VEILLE MÉTIER              [Tout voir >]│
│ ┌─────────────────────────────────────┐ │
│ │ ⚖️ RÉGLEMENTAIRE • Aujourd'hui      │ │
│ │ Convention 2026 : nouveaux tarifs   │ │
│ │ ONCD                                │ │
│ ├─────────────────────────────────────┤ │
│ │ 🧪 SCIENTIFIQUE • Hier              │ │
│ │ Méta-analyse éclaircissement 2025   │ │
│ │ J. Dental Research                  │ │
│ ├─────────────────────────────────────┤ │
│ │ 🎉 HUMOUR • Il y a 3 jours    [↗️]  │ │
│ │ Les perles patients de la semaine   │ │
│ │ @dentiste_humour                    │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [🏠] [🎓] [🛡️] [🤝] [💗]  BOTTOM NAV   │
└─────────────────────────────────────────┘
```

### Composants à créer
1. `GlobalProgressBars` - 4 barres, pas de titre, pas de %
2. `TrainingCard` - Carte simplifiée avec badge "+1 pt", barre qui se remplit après quiz
3. `NewsSection` - Liste avec catégories (Réglementaire, Scientifique, Pratique, Humour)
4. `CurrentFormationCard` - Formation en cours avec progression

---

## 🎮 FLOW SÉQUENCE FORMATION (ENRICHI)

### Étapes obligatoires dans l'ordre

```
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 1 : COURS (AUDIO/VIDÉO)                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│  Composant : CoursePlayer                                       │
│                                                                 │
│  • Média : Audio MP3 ou Vidéo MP4                              │
│  • Sous-titres : Fichier VTT généré par IA                     │
│  • Durée : 5-10 minutes                                        │
│  • Barre de progression visible                                │
│  • Lecture obligatoire à 100%                                  │
│                                                                 │
│  📊 LOGS DPC (OBLIGATOIRE) :                                   │
│  {                                                              │
│    user_id, sequence_id,                                       │
│    started_at, ended_at,                                       │
│    total_duration_seconds,                                     │
│    watched_percent,                                            │
│    pause_count,                                                │
│    timestamps: [{time, action}...]                             │
│  }                                                              │
│                                                                 │
│  Bouton "Passer au quiz" : DÉSACTIVÉ si < 100%                 │
│                           ACTIVÉ si 100% visionné              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 2 : QUIZ (4 QUESTIONS)                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│  Composant : SequenceQuiz                                       │
│                                                                 │
│  • 4 questions liées au cours                                  │
│  • Types : QCM, Vrai/Faux, QCM Image, Cas clinique             │
│  • Feedback pédagogique après chaque réponse                   │
│  • Score final affiché                                         │
│                                                                 │
│  Validation : Complétion du quiz (pas de score minimum)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 3 : POP-UP VALIDATION 🎉                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│  Composant : SequenceCompleteModal                              │
│                                                                 │
│  ┌─────────────────────────────────────┐                       │
│  │         🎊 CONFETTIS 🎊             │                       │
│  │                                     │                       │
│  │      🏆 Séquence validée !          │                       │
│  │                                     │                       │
│  │      Score : 3/4 • +15 points       │                       │
│  │                                     │                       │
│  │   ┌─────────────────────────────┐   │                       │
│  │   │   🎁 OUVRIR MON COFFRE      │   │                       │
│  │   └─────────────────────────────┘   │                       │
│  └─────────────────────────────────────┘                       │
│                                                                 │
│  Animation : Framer Motion, confettis, scale bounce            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 4 : COFFRE RÉCOMPENSE 🎁                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│  Composant : RewardChestModal                                   │
│                                                                 │
│  ┌─────────────────────────────────────┐                       │
│  │                                     │                       │
│  │      ✨ Animation coffre ✨          │                       │
│  │         qui s'ouvre                 │                       │
│  │                                     │                       │
│  │   ┌───────────────────────────┐     │                       │
│  │   │  📄 INFOGRAPHIE           │     │                       │
│  │   │  "Les bases de            │     │                       │
│  │   │   l'éclaircissement"      │     │                       │
│  │   │                           │     │                       │
│  │   │  [📥 Télécharger PDF]     │     │                       │
│  │   └───────────────────────────┘     │                       │
│  │                                     │                       │
│  │   [Continuer vers séquence 6 →]     │                       │
│  └─────────────────────────────────────┘                       │
│                                                                 │
│  PDF : 1 page, généré NotebookLM, stocké Supabase Storage      │
└─────────────────────────────────────────────────────────────────┘
```

### Tables BDD associées

```sql
-- Logs de visionnage cours (conformité DPC)
CREATE TABLE course_watch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  sequence_id uuid REFERENCES sequences NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  total_duration_seconds integer,
  watched_percent integer DEFAULT 0,
  pause_count integer DEFAULT 0,
  playback_events jsonb, -- [{time: 30, action: 'pause'}, ...]
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Modifications table sequences
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS 
  course_media_url text,
  course_media_type varchar(10) CHECK (course_media_type IN ('audio', 'video')),
  course_duration_seconds integer,
  subtitles_url text,
  infographic_url text; -- PDF 1 page
```

---

## 📰 SECTION VEILLE MÉTIER

### Catégories

| Catégorie | Icône | Couleur | Description |
|-----------|-------|---------|-------------|
| Réglementaire | ⚖️ Scale | blue | Convention, CCAM, réglementation |
| Scientifique | 🧪 FlaskConical | purple | Articles, études, publications |
| Pratique | 🩺 Stethoscope | teal | Astuces, conseils, workflow |
| Humour | 🎉 PartyPopper | pink | Lien externe Instagram/Facebook |

### Table BDD

```sql
CREATE TABLE news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category varchar(20) NOT NULL CHECK (category IN ('reglementaire', 'scientifique', 'pratique', 'humour')),
  title varchar(255) NOT NULL,
  summary text,
  source varchar(100), -- "ONCD", "Journal of Dental Research", "@dentiste_humour"
  external_url text, -- Pour humour notamment
  image_url text,
  is_external boolean DEFAULT false,
  published_at timestamptz DEFAULT now(),
  is_published boolean DEFAULT true,
  view_count integer DEFAULT 0
);
```

---

## 🗂️ ARCHITECTURE PROJET

```
dentallearn-v3/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (main)/
│   │   │   ├── layout.tsx              # Layout avec BottomNav
│   │   │   ├── page.tsx                # HOME
│   │   │   ├── formation/
│   │   │   │   ├── page.tsx            # Liste/Catalogue
│   │   │   │   └── [slug]/
│   │   │   │       ├── page.tsx        # Détail formation
│   │   │   │       └── sequence/
│   │   │   │           └── [num]/page.tsx  # Player séquence
│   │   │   ├── conformite/page.tsx
│   │   │   ├── patient/page.tsx
│   │   │   ├── sante/page.tsx
│   │   │   └── profile/page.tsx
│   │   └── api/
│   │       ├── course-logs/route.ts    # Logs DPC
│   │       └── daily-quiz/route.ts
│   │
│   ├── components/
│   │   ├── navigation/
│   │   │   ├── BottomNav.tsx
│   │   │   └── Header.tsx
│   │   ├── home/
│   │   │   ├── GlobalProgressBars.tsx
│   │   │   ├── TrainingCard.tsx
│   │   │   ├── CurrentFormationCard.tsx
│   │   │   ├── NewsSection.tsx
│   │   │   └── DailyQuizModal.tsx
│   │   ├── sequence/
│   │   │   ├── CoursePlayer.tsx        # 🆕 Player audio/vidéo
│   │   │   ├── SubtitlesDisplay.tsx    # 🆕 Sous-titres
│   │   │   ├── SequenceQuiz.tsx
│   │   │   ├── SequenceCompleteModal.tsx
│   │   │   └── RewardChestModal.tsx    # 🆕 Coffre récompense
│   │   ├── quiz/
│   │   │   ├── QuestionCard.tsx
│   │   │   ├── TrueFalseButtons.tsx
│   │   │   ├── MCQOptions.tsx
│   │   │   └── FeedbackCard.tsx
│   │   └── shared/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Modal.tsx
│   │       ├── ProgressBar.tsx
│   │       └── ConfettiAnimation.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── hooks/
│   │   │   ├── useUser.ts
│   │   │   ├── useAxesProgress.ts
│   │   │   ├── useDailyQuiz.ts
│   │   │   ├── useCoursePlayer.ts      # 🆕 Gestion lecture + logs
│   │   │   └── useSubscription.ts
│   │   └── utils/
│   │       ├── dates.ts
│   │       ├── scoring.ts
│   │       └── constants.ts
│   │
│   └── types/
│       ├── database.ts
│       ├── quiz.ts
│       └── sequence.ts
│
├── supabase/
│   └── migrations/
│       └── 001_v3_tables.sql
│
└── public/
    └── animations/
        ├── confetti.json               # Lottie
        └── chest-open.json             # Lottie
```

---

## 🔧 HOOKS PRINCIPAUX

### useCoursePlayer (nouveau)
```typescript
// src/lib/hooks/useCoursePlayer.ts
export function useCoursePlayer(sequenceId: string) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [watchedPercent, setWatchedPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [events, setEvents] = useState<PlaybackEvent[]>([]);
  
  // Référence au média
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  
  // Log un événement
  const logEvent = (action: 'play' | 'pause' | 'seek' | 'complete') => {
    setEvents(prev => [...prev, { 
      time: currentTime, 
      action, 
      timestamp: new Date().toISOString() 
    }]);
  };
  
  // Vérifier si 100% visionné
  useEffect(() => {
    if (watchedPercent >= 100 && !isComplete) {
      setIsComplete(true);
      logEvent('complete');
      saveLogsToDatabase();
    }
  }, [watchedPercent]);
  
  // Sauvegarder les logs pour DPC
  const saveLogsToDatabase = async () => {
    await supabase.from('course_watch_logs').insert({
      user_id: userId,
      sequence_id: sequenceId,
      started_at: startTime,
      ended_at: new Date().toISOString(),
      total_duration_seconds: duration,
      watched_percent: watchedPercent,
      pause_count: events.filter(e => e.action === 'pause').length,
      playback_events: events,
      completed: true
    });
  };
  
  return {
    mediaRef,
    isPlaying,
    currentTime,
    duration,
    watchedPercent,
    isComplete,
    play: () => { mediaRef.current?.play(); logEvent('play'); },
    pause: () => { mediaRef.current?.pause(); logEvent('pause'); },
    seek: (time: number) => { if(mediaRef.current) mediaRef.current.currentTime = time; logEvent('seek'); }
  };
}
```

### useAxesProgress (renommé de useCPProgress)
```typescript
// src/lib/hooks/useAxesProgress.ts
// Note: Pas de mention "CP" dans le code côté client

export function useAxesProgress() {
  return useQuery({
    queryKey: ['axes-progress'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      // Récupérer progression par axe (nombre de barres remplies sur 4)
      const { data } = await supabase
        .from('daily_axis_progress')
        .select('axe_id, points_earned')
        .eq('user_id', user.id);
      
      // Calculer le niveau de remplissage (0-4) par axe
      const progress = [1,2,3,4].map(axeId => {
        const axePoints = data?.filter(d => d.axe_id === axeId)
          .reduce((sum, d) => sum + d.points_earned, 0) || 0;
        
        // Seuils pour chaque barre (à ajuster)
        const filled = Math.min(4, Math.floor(axePoints / 25));
        
        return { axeId, filled };
      });
      
      return progress;
    }
  });
}
```

---

## 📦 PACKAGES

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "@supabase/supabase-js": "^2.38.0",
    "@supabase/ssr": "^0.1.0",
    "@tanstack/react-query": "^5.0.0",
    "lucide-react": "^0.294.0",
    "framer-motion": "^10.16.0",
    "date-fns": "^2.30.0",
    "zustand": "^4.4.0",
    "@lottiefiles/react-lottie-player": "^3.5.0"
  }
}
```

---

## ⚠️ RÈGLES IMPORTANTES

### À FAIRE
- ✅ Mobile-first (375px minimum)
- ✅ Couleurs Dentalschool (#00D1C1, #2D1B96)
- ✅ Points multiples de 5
- ✅ Logs DPC pour chaque visionnage cours
- ✅ Feedback pédagogique unique (pas correct/incorrect séparés)
- ✅ Animation coffre après validation séquence

### À NE PAS FAIRE
- ❌ Mention "CP" ou "Certification Périodique" visible
- ❌ localStorage / sessionStorage
- ❌ Pourcentages sur les barres de progression accueil
- ❌ Permettre de skip le cours (100% obligatoire)
- ❌ Afficher dates de cycle CP

---

## 🚀 ORDRE D'IMPLÉMENTATION RECOMMANDÉ

### Phase 1 : Setup (Jour 1)
1. Créer repo Git `dentallearn-v3`
2. Init Next.js + Tailwind + TypeScript
3. Configurer Supabase (client, server, middleware)
4. Générer types depuis BDD existante
5. Exécuter migration SQL V3

### Phase 2 : Home (Jour 2-3)
1. Layout principal + BottomNav
2. Header (avatar, streak, notifications)
3. GlobalProgressBars
4. TrainingCard + DailyQuizModal
5. NewsSection

### Phase 3 : Formation enrichie (Jour 4-6)
1. CoursePlayer (audio/vidéo)
2. SubtitlesDisplay
3. Hook useCoursePlayer avec logs
4. SequenceQuiz (existant, adapter)
5. SequenceCompleteModal
6. RewardChestModal (coffre)

### Phase 4 : Pages secondaires (Jour 7-8)
1. Page Catalogue formations
2. Page Conformité
3. Page Patient
4. Page Santé Pro
5. Page Profil

### Phase 5 : Polish (Jour 9-10)
1. Animations Framer Motion / Lottie
2. Tests responsive
3. Optimisation performance
4. PWA manifest

---

## 📎 FICHIERS DE RÉFÉRENCE

- **Prototype accueil** : `dentallearn-v3-home-final.tsx`
- **Migration SQL** : `dentallearn-v3-migration.sql`
- **Types questions** : `/mnt/project/REFERENTIEL_DENTALLEARN_v3_1_COMPLET.md`
- **Design system** : `/mnt/project/dentallearn-design-system.html`
