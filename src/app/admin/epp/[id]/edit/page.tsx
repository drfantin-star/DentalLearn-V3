'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';

const themeOptions = [
  { value: 'esthetique', label: 'Esthetique Dentaire' },
  { value: 'restauratrice', label: 'Dentisterie Restauratrice' },
  { value: 'endodontie', label: 'Endodontie' },
  { value: 'chirurgie', label: 'Chirurgie Orale' },
  { value: 'implant', label: 'Implantologie' },
  { value: 'prothese', label: 'Prothese' },
  { value: 'parodontologie', label: 'Parodontologie' },
  { value: 'radiologie', label: 'Radiologie' },
  { value: 'ergonomie', label: 'Ergonomie' },
  { value: 'relation-patient', label: 'Relation Patient' },
  { value: 'sante-pro', label: 'Sante du Praticien' },
  { value: 'numerique', label: 'Numerique & IA' },
  { value: 'environnement', label: 'Environnement' },
];

export default function EditEppAuditPage() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    theme_slug: 'esthetique',
    description: '',
    nb_dossiers_min: 10,
    nb_dossiers_max: 20,
    delai_t2_mois_min: 2,
    delai_t2_mois_max: 6,
    is_published: false,
  });
  const router = useRouter();
  const params = useParams();
  const auditId = params.id as string;
  const supabase = createClient();

  useEffect(() => {
    loadAudit();
  }, [auditId]);

  const loadAudit = async () => {
    try {
      const { data, error } = await supabase
        .from('epp_audits')
        .select('*')
        .eq('id', auditId)
        .single();

      if (error) throw error;

      setFormData({
        title: data.title || '',
        slug: data.slug || '',
        theme_slug: data.theme_slug || 'esthetique',
        description: data.description || '',
        nb_dossiers_min: data.nb_dossiers_min ?? 10,
        nb_dossiers_max: data.nb_dossiers_max ?? 20,
        delai_t2_mois_min: data.delai_t2_mois_min ?? 2,
        delai_t2_mois_max: data.delai_t2_mois_max ?? 6,
        is_published: data.is_published ?? false,
      });
    } catch (error) {
      console.error('Erreur chargement audit:', error);
      router.push('/admin/epp');
    } finally {
      setInitialLoading(false);
    }
  };

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
      const { error } = await supabase
        .from('epp_audits')
        .update(formData)
        .eq('id', auditId);

      if (error) throw error;

      router.push(`/admin/epp/${auditId}`);
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader backHref={`/admin/epp/${auditId}`} backLabel="Retour à l'audit" title="Modifier l'audit EPP" />

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card className="p-8 space-y-6">
          <TextField
            label="Titre"
            required
            size="lg"
            type="text"
            value={formData.title}
            onChange={handleTitleChange}
            placeholder="Ex: Audit Traitement Endodontique"
            className="rounded-xl"
          />

          <TextField
            label="Slug"
            size="lg"
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="auto-genere-depuis-le-titre"
            className="rounded-xl"
          />

          <Select
            label="Thematique"
            size="lg"
            value={formData.theme_slug}
            onChange={(e) => setFormData({ ...formData, theme_slug: e.target.value })}
            options={themeOptions}
            className="rounded-xl"
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            placeholder="Description de l'audit EPP..."
            className="px-4 py-3 rounded-xl text-base"
          />

          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Dossiers min"
              size="lg"
              type="number"
              min={1}
              value={formData.nb_dossiers_min}
              onChange={(e) => setFormData({ ...formData, nb_dossiers_min: parseInt(e.target.value) })}
              className="rounded-xl"
            />
            <TextField
              label="Dossiers max"
              size="lg"
              type="number"
              min={1}
              value={formData.nb_dossiers_max}
              onChange={(e) => setFormData({ ...formData, nb_dossiers_max: parseInt(e.target.value) })}
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Delai T2 min (mois)"
              size="lg"
              type="number"
              min={1}
              value={formData.delai_t2_mois_min}
              onChange={(e) => setFormData({ ...formData, delai_t2_mois_min: parseInt(e.target.value) })}
              className="rounded-xl"
            />
            <TextField
              label="Delai T2 max (mois)"
              size="lg"
              type="number"
              min={1}
              value={formData.delai_t2_mois_max}
              onChange={(e) => setFormData({ ...formData, delai_t2_mois_max: parseInt(e.target.value) })}
              className="rounded-xl"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_published"
              checked={formData.is_published}
              onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label htmlFor="is_published" className="text-sm font-medium text-gray-700">Publie</label>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Link href={`/admin/epp/${auditId}`} className="px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50">
              Annuler
            </Link>
            <Button
              variant="primary"
              size="lg"
              type="submit"
              loading={loading}
            >
              <Save className="w-5 h-5" />
              Enregistrer
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
