'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function NewFormationPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    instructor_name: '',
    description_short: '',
    description_long: '',
    category: 'esthetique',
    level: 'intermediate',
    total_sequences: 16,
    axe_cp: null as number | null,
  });
  const router = useRouter();

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData({ ...formData, title, slug: generateSlug(title) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/formations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la création');
      }

      router.push(`/admin/formations/${result.formation.id}`);
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader backHref="/admin/formations" backLabel="Retour aux formations" title="Nouvelle formation" />

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Titre *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={handleTitleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Ex: Éclaircissements & Taches Blanches"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Formateur *</label>
            <input
              type="text"
              required
              value={formData.instructor_name}
              onChange={(e) => setFormData({ ...formData, instructor_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Ex: Dr Laurent Elbeze"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description courte</label>
            <input
              type="text"
              value={formData.description_short}
              onChange={(e) => setFormData({ ...formData, description_short: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Résumé en 1-2 phrases"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="esthetique">Esthétique</option>
                <option value="restauratrice">Restauratrice</option>
                <option value="chirurgie">Chirurgie</option>
                <option value="implant">Implantologie</option>
                <option value="prothese">Prothèse</option>
                <option value="parodontologie">Parodontologie</option>
                <option value="endodontie">Endodontie</option>
                <option value="soft-skills">Soft Skills</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Niveau</label>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="beginner">Débutant</option>
                <option value="intermediate">Intermédiaire</option>
                <option value="advanced">Avancé</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Axe CP</label>
            <select
              value={formData.axe_cp ?? ''}
              onChange={(e) => setFormData({ ...formData, axe_cp: e.target.value === '' ? null : parseInt(e.target.value) })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Hors CP / formation bonus</option>
              <option value={1}>Axe 1 — Actualiser les connaissances et compétences</option>
              <option value={2}>Axe 2 — Renforcer la qualité des pratiques</option>
              <option value={3}>Axe 3 — Améliorer la relation avec les patients</option>
              <option value={4}>Axe 4 — Mieux prendre en compte sa santé personnelle</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de séquences</label>
            <input
              type="number"
              min="1"
              value={formData.total_sequences}
              onChange={(e) => setFormData({ ...formData, total_sequences: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Link href="/admin/formations" className="px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50">
              Annuler
            </Link>
            <Button
              variant="primary"
              size="lg"
              type="submit"
              loading={loading}
            >
              <Save className="w-5 h-5" />
              Créer
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
