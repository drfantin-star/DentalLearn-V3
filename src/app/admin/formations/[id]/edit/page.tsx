'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Save, Upload, FileText } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Select } from '@/components/ui/Select';

interface FormData {
  title: string;
  slug: string;
  instructor_name: string;
  description_short: string;
  description_long: string;
  cover_image_url: string;
  biblio_pdf_url: string;
  category: string;
  level: string;
  total_sequences: number;
  axe_cp: number | null;
}

export default function EditFormationPage() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingBiblio, setUploadingBiblio] = useState(false);
  // URL biblio au chargement : sert à déclencher le retrait storage au submit
  // si l'admin a supprimé la fiche (mise à NULL en DB + remove storage atomiques).
  const [initialBiblioUrl, setInitialBiblioUrl] = useState('');
  const [formData, setFormData] = useState<FormData>({
    title: '',
    slug: '',
    instructor_name: '',
    description_short: '',
    description_long: '',
    cover_image_url: '',
    biblio_pdf_url: '',
    category: 'esthetique',
    level: 'intermediate',
    total_sequences: 16,
    axe_cp: null,
  });
  const router = useRouter();
  const params = useParams();
  const formationId = params.id as string;

  useEffect(() => {
    loadFormation();
  }, [formationId]);

  const loadFormation = async () => {
    try {
      const response = await fetch(`/api/admin/formations/${formationId}`);
      const result = await response.json();

      if (!response.ok) {
        console.error('Erreur chargement formation:', result.error);
        router.push('/admin/formations');
        return;
      }

      const data = result.formation;
      setFormData({
        title: data.title || '',
        slug: data.slug || '',
        instructor_name: data.instructor_name || '',
        description_short: data.description_short || '',
        description_long: data.description_long || '',
        cover_image_url: data.cover_image_url || '',
        biblio_pdf_url: data.biblio_pdf_url || '',
        category: data.category || 'esthetique',
        level: data.level || 'intermediate',
        total_sequences: data.total_sequences || 16,
        axe_cp: data.axe_cp ?? null,
      });
      setInitialBiblioUrl(data.biblio_pdf_url || '');
    } catch (error) {
      console.error('Erreur:', error);
      router.push('/admin/formations');
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

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const maxWidth = 1200;
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        canvas.toBlob(
          (blob) => resolve(blob!),
          'image/jpeg',
          0.85
        );
      };
      img.src = url;
    });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressed = await compressImage(file);

      if (compressed.size > 2 * 1024 * 1024) {
        alert('Image trop lourde même après compression. Essayez une image plus petite.');
        return;
      }

      const supabase = createClient();
      const fileName = `covers/${formationId}-${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from('formations')
        .upload(fileName, compressed, {
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (error) {
        console.error('Upload error:', error);
        alert('Erreur lors de l\'upload');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('formations')
        .getPublicUrl(fileName);

      setFormData({ ...formData, cover_image_url: publicUrl });
    } catch (err) {
      console.error('Upload error:', err);
      alert('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      // Réinitialise l'input pour autoriser la re-sélection du même fichier
      // (sinon onChange ne se redéclenche pas). Couvre succès et chemins d'erreur.
      input.value = '';
    }
  };

  const handleBiblioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Format invalide : seuls les fichiers PDF sont acceptés.');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('PDF trop lourd (5 Mo max).');
      input.value = '';
      return;
    }

    setUploadingBiblio(true);
    try {
      const supabase = createClient();
      const fileName = `biblio/${formationId}.pdf`;

      const { error } = await supabase.storage
        .from('formations')
        .upload(fileName, file, {
          upsert: true,
          contentType: 'application/pdf',
        });

      if (error) {
        console.error('Upload error:', error);
        alert('Erreur lors de l\'upload');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('formations')
        .getPublicUrl(fileName);

      // Path fixe + upsert : on ajoute un cache-buster pour éviter de servir
      // l'ancien PDF après un « Remplacer ».
      setFormData({ ...formData, biblio_pdf_url: `${publicUrl}?v=${Date.now()}` });
    } catch (err) {
      console.error('Upload error:', err);
      alert('Erreur lors de l\'upload');
    } finally {
      setUploadingBiblio(false);
      // Réinitialise l'input pour autoriser la re-sélection du même fichier
      // (sinon onChange ne se redéclenche pas). Couvre succès et chemins d'erreur.
      input.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/formations/${formationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la mise à jour');
      }

      // Si la fiche biblio a été supprimée, retirer aussi le fichier du storage
      // (différé jusqu'ici pour rester atomique avec la mise à NULL en DB).
      if (initialBiblioUrl && !formData.biblio_pdf_url) {
        const supabase = createClient();
        await supabase.storage
          .from('formations')
          .remove([`biblio/${formationId}.pdf`]);
      }

      router.push(`/admin/formations/${formationId}`);
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
      <PageHeader backHref={`/admin/formations/${formationId}`} backLabel="Retour à la formation" title="Modifier la formation" />

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <TextField
            label="Titre"
            required
            size="lg"
            type="text"
            value={formData.title}
            onChange={handleTitleChange}
            placeholder="Ex: Éclaircissements & Taches Blanches"
            className="rounded-xl"
          />

          <TextField
            label="Formateur"
            required
            size="lg"
            type="text"
            value={formData.instructor_name}
            onChange={(e) => setFormData({ ...formData, instructor_name: e.target.value })}
            placeholder="Ex: Dr Laurent Elbeze"
            className="rounded-xl"
          />

          <TextField
            label="Description courte"
            size="lg"
            type="text"
            value={formData.description_short}
            onChange={(e) => setFormData({ ...formData, description_short: e.target.value })}
            placeholder="Résumé en 1-2 phrases"
            className="rounded-xl"
          />

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image de couverture
            </label>

            {formData.cover_image_url ? (
              <div className="relative w-full h-40 rounded-xl overflow-hidden mb-3">
                <img
                  src={formData.cover_image_url}
                  alt="Couverture"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, cover_image_url: '' })}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors">
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2" />
                    <span className="text-sm text-gray-500">Upload en cours...</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Cliquer pour uploader</span>
                    <span className="text-xs text-gray-400">PNG, JPG — 2 Mo max</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleCoverUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Fiche bibliographie (PDF) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fiche bibliographie (PDF)
            </label>

            {formData.biblio_pdf_url ? (
              <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <FileText className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">Fiche bibliographie</p>
                    <a
                      href={formData.biblio_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Voir la fiche actuelle
                    </a>
                  </div>
                  <label className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    {uploadingBiblio ? 'Upload…' : 'Remplacer'}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleBiblioUpload}
                      disabled={uploadingBiblio}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, biblio_pdf_url: '' })}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors">
                {uploadingBiblio ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2" />
                    <span className="text-sm text-gray-500">Upload en cours...</span>
                  </>
                ) : (
                  <>
                    <FileText size={24} className="text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Cliquer pour uploader</span>
                    <span className="text-xs text-gray-400">PDF — 5 Mo max</span>
                  </>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleBiblioUpload}
                  disabled={uploadingBiblio}
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Catégorie"
              size="lg"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={[
                { value: 'esthetique', label: 'Esthétique' },
                { value: 'restauratrice', label: 'Restauratrice' },
                { value: 'chirurgie', label: 'Chirurgie' },
                { value: 'implant', label: 'Implantologie' },
                { value: 'prothese', label: 'Prothèse' },
                { value: 'parodontologie', label: 'Parodontologie' },
                { value: 'endodontie', label: 'Endodontie' },
                { value: 'soft-skills', label: 'Soft Skills' },
              ]}
              className="rounded-xl"
            />
            <Select
              label="Niveau"
              size="lg"
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              options={[
                { value: 'beginner', label: 'Débutant' },
                { value: 'intermediate', label: 'Intermédiaire' },
                { value: 'advanced', label: 'Avancé' },
              ]}
              className="rounded-xl"
            />
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

          <TextField
            label="Nombre de séquences"
            size="lg"
            type="number"
            min={1}
            value={formData.total_sequences}
            onChange={(e) => setFormData({ ...formData, total_sequences: parseInt(e.target.value) })}
            className="rounded-xl"
          />

          <div className="flex justify-end gap-4 pt-4">
            <Link href={`/admin/formations/${formationId}`} className="px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50">
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
        </div>
      </form>
    </div>
  );
}
