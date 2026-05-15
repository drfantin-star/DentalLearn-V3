# Design System DentalLearn — Guide pour nouvelles pages

> **À inclure dans chaque handoff / prompt Claude Code** dès qu'une nouvelle page admin est créée.  
> Dernière mise à jour : 15 mai 2026 — Étape 3 terminée.

---

## 1. Composants UI disponibles — OBLIGATOIRES

**Ne jamais recréer ces patterns à la main.** Ces composants existent dans `src/components/ui/` et doivent être utilisés pour tout nouveau code.

### `<Button>`

```tsx
import { Button } from '@/components/ui/Button'

// Variantes disponibles
<Button variant="primary">Enregistrer</Button>       // fond primary, texte blanc
<Button variant="secondary">Annuler</Button>          // fond blanc, bordure grise
<Button variant="ghost">Voir plus</Button>            // transparent, hover gris
<Button variant="danger">Supprimer</Button>           // fond rouge

// Tailles
<Button size="sm">Petit</Button>    // px-3 py-1.5, pagination
<Button size="md">Moyen</Button>    // px-4 py-2 (défaut)
<Button size="lg">Grand</Button>    // px-6 py-3, boutons principaux

// États
<Button loading={isSaving}>Enregistrer</Button>       // spinner automatique + disabled
<Button disabled>Non disponible</Button>

// Props layout (passer en className, pas dans le composant)
<Button variant="primary" size="lg" className="w-full">Pleine largeur</Button>
<Button variant="primary" size="lg" className="flex-1">Flex</Button>

// Type submit (formulaires)
<Button type="submit" variant="primary" size="lg" loading={saving}>
  Créer
</Button>
```

**Règles critiques :**
- `loading` est réservé à `variant="primary"` (spinner blanc invisible sur secondary/ghost)
- Ne jamais écrire `<button className="bg-[#2D1B96]...">` — toujours passer par `<Button>`
- Les `<Link>` stylés comme boutons ne doivent PAS utiliser `<Button>` (sémantique HTML différente)

---

### `<Card>`

```tsx
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

// Variante par défaut (shadow-lg)
<Card>
  <div className="p-6">Contenu</div>
</Card>

// Avec padding direct
<Card className="p-6 space-y-6">
  Formulaire...
</Card>

// Variante flat (bordure, sans shadow)
<Card variant="flat" className="p-4">
  Contenu secondaire
</Card>

// Avec sous-composants (nouvelles pages — utiliser systématiquement)
<Card>
  <CardHeader>
    <h2 className="text-xl font-bold text-gray-900">Titre de section</h2>
  </CardHeader>
  <CardBody>
    Contenu
  </CardBody>
</Card>
```

**Règles critiques :**
- Ne jamais écrire `<div className="bg-white rounded-2xl shadow-lg p-6">` — toujours `<Card>`
- Les cards avec `overflow-hidden` + tableau `<table>` à l'intérieur : utiliser `<Card className="overflow-hidden">` sans padding (le padding casserait le tableau)
- Les cards cliquables `<Link>` : ne pas utiliser `<Card>` (sémantique différente)

---

### `<PageHeader>`

```tsx
import { PageHeader } from '@/components/ui/PageHeader'

// Standard
<PageHeader
  backHref="/admin/formations"
  backLabel="Retour aux formations"
  title="Nouvelle formation"
/>

// Avec sous-titre
<PageHeader
  backHref="/admin/organizations"
  backLabel="Retour aux organisations"
  title="Nouvelle organisation"
  subtitle="Créer un cabinet ou un groupe dentaire"
/>

// Avec boutons d'action à droite
<PageHeader
  backHref="/admin/epp"
  backLabel="Retour aux audits"
  title="Audit EPP"
  actions={
    <>
      <Button variant="secondary" size="md">Modifier</Button>
      <Button variant="primary" size="md">Publier</Button>
    </>
  }
/>
```

**Règles critiques :**
- Toujours utiliser `<PageHeader>` pour les pages admin avec un lien retour + titre
- Ne jamais recréer `<Link><ArrowLeft />...</Link>` + `<h1>` manuellement
- Si une description JSX complexe est nécessaire sous le titre (avec `<strong>`, lien, etc.) : utiliser `<PageHeader className="mb-2">` puis ajouter le `<p>` juste après le composant

---

### `<Badge>`

```tsx
import { Badge } from '@/components/ui/Badge'

// Variantes métier
<Badge variant="cp">CP</Badge>
<Badge variant="bonus">Bonus</Badge>
<Badge variant="epp">EPP</Badge>
<Badge variant="nouveau">Nouveau</Badge>
<Badge variant="populaire">Populaire</Badge>

// Variantes sémantiques
<Badge variant="success">Publié</Badge>
<Badge variant="warning">En attente</Badge>
<Badge variant="danger">Erreur</Badge>
<Badge variant="info">Info</Badge>
<Badge variant="neutral">Brouillon</Badge>

// Variantes news
<Badge variant="news-scientifique">Scientifique</Badge>
<Badge variant="news-pratique">Pratique</Badge>

// Tailles
<Badge variant="cp" size="sm">CP</Badge>   // défaut
<Badge variant="success" size="md">Publié</Badge>
<Badge variant="info" size="lg">Information</Badge>
```

---

## 2. Tokens et classes à utiliser

### Couleurs — JAMAIS de hex en dur

| ❌ À ne plus écrire | ✅ À utiliser |
|---------------------|--------------|
| `bg-[#2D1B96]` | `bg-primary` |
| `text-[#2D1B96]` | `text-primary` |
| `hover:bg-[#231575]` | `hover:bg-primary-hover` |
| `bg-[#2D1B96]/10` | `bg-primary/10` |
| `border-[#2D1B96]` | `border-primary` |
| `text-[#00D1C1]` | `text-accent` |

### Tokens disponibles dans `tailwind.config.ts`

```
primary.DEFAULT  = #2D1B96
primary.hover    = #231575
primary.muted    = rgba(45,27,150,0.1)
accent.DEFAULT   = #00D1C1
accent.hover     = #00B8A9
accent.muted     = rgba(0,209,193,0.1)
```

---

## 3. Utilitaires

### `cn()` — fusion de classes Tailwind

```tsx
import { cn } from '@/lib/utils/cn'

// Utiliser systématiquement pour les classes conditionnelles
<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  variant === 'flat' && 'flat-classes',
  className  // toujours en dernier pour permettre l'override
)} />
```

---

## 4. Patterns structurels admin

### Page admin standard (avec header + contenu)

```tsx
export default function MaPageAdmin() {
  return (
    <div className="p-8">
      <PageHeader
        backHref="/admin/..."
        backLabel="Retour à ..."
        title="Titre de la page"
      />

      <Card className="p-6 space-y-6">
        {/* contenu */}
      </Card>
    </div>
  )
}
```

### Page avec tableau (overflow-hidden)

```tsx
<div className="p-8">
  <PageHeader ... />

  <Card className="overflow-hidden">
    <table className="w-full">
      <thead className="bg-gray-50 border-b">...</thead>
      <tbody>...</tbody>
    </table>
  </Card>
</div>
```

### Page avec plusieurs sections

```tsx
<div className="p-8 space-y-6">
  <PageHeader ... />

  <Card>
    <CardHeader>
      <h2 className="text-xl font-bold text-gray-900">Section 1</h2>
    </CardHeader>
    <CardBody>...</CardBody>
  </Card>

  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Section 2</h2>
        <Button variant="primary" size="md">Ajouter</Button>
      </div>
    </CardHeader>
    <CardBody>...</CardBody>
  </Card>
</div>
```

### Boutons de formulaire (pattern standard)

```tsx
<div className="flex gap-4 pt-4">
  <Button
    variant="secondary"
    size="lg"
    className="flex-1"
    onClick={() => router.back()}
  >
    Annuler
  </Button>
  <Button
    type="submit"
    variant="primary"
    size="lg"
    className="flex-1"
    loading={saving}
  >
    Enregistrer
  </Button>
</div>
```

---

## 5. Ce qui N'existe PAS encore — à ne pas inventer

Ces patterns n'ont pas encore de composant dédié. En attendant, utiliser le JSX natif :

- **Modal** — pas de composant `<Modal>` (Étape 4 design system, juin 2026)
- **TextField / Input / Select** — pas de composant unifié (Étape 4-bis)
- **IconButton** — pas de composant dédié (`p-2 hover:bg-gray-100 rounded-lg` en attendant)
- **`<Link>` stylé comme bouton** — utiliser les classes Tailwind directement avec token `primary`

---

## 6. Règles absolues

```
❌ JAMAIS localStorage ou sessionStorage → React state uniquement
❌ JAMAIS bg-[#2D1B96] en dur → bg-primary
❌ JAMAIS <button className="..."> pour les boutons standards → <Button>
❌ JAMAIS <div className="bg-white rounded-2xl shadow-lg p-6"> → <Card>
❌ JAMAIS recréer ArrowLeft + h1 → <PageHeader>
❌ JAMAIS ajouter de contrôles de vitesse audio (0.8x/1x/1.5x) nulle part

✅ TOUJOURS cn() pour les classes conditionnelles
✅ TOUJOURS type="button" sur les <button> non-submit (le composant Button le fait par défaut)
✅ TOUJOURS tsc --noEmit avant de commit
✅ TOUJOURS vérifier l'absence de #2D1B96 dans les nouveaux fichiers
```

---

## 7. Fichiers de référence dans le repo

| Fichier | Rôle |
|---------|------|
| `src/components/ui/Button.tsx` | Composant Button |
| `src/components/ui/Card.tsx` | Composant Card + CardHeader + CardBody |
| `src/components/ui/PageHeader.tsx` | Composant PageHeader |
| `src/components/ui/Badge.tsx` | Composant Badge (12 variantes) |
| `src/lib/utils/cn.ts` | Utilitaire cn() |
| `tailwind.config.ts` | Tokens primary/accent et variantes |
| `src/app/globals.css` | Variables CSS documentées |
| `src/types/theme.ts` | Types Theme, ThemeContent |
| `docs/AUDIT_DESIGN_SYSTEM_2026.md` | Audit complet (référence) |
