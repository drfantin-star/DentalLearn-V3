'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ClipboardCheck, ChevronLeft, Play, Clock, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Audit {
  id: string;
  title: string;
  slug: string;
  description: string;
  nb_dossiers_min: number;
  nb_dossiers_max: number;
  delai_t2_mois_min: number;
  delai_t2_mois_max: number;
}

interface Criterion {
  id: string;
  code: string;
  type: 'R' | 'P' | 'S';
  label: string;
  source: string;
}

interface UserSession {
  id: string;
  tour: number;
  started_at: string;
  completed_at: string | null;
  score_global: number | null;
  nb_dossiers: number | null;
}

export default function AuditDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [audit, setAudit] = useState<Audit | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    // Charger l'audit
    const { data: auditData } = await supabase
      .from('epp_audits')
      .select('*')
      .eq('slug', slug)
      .single();

    if (!auditData) {
      router.push('/formation/epp');
      return;
    }
    setAudit(auditData);

    // Charger les critères
    const { data: criteriaData } = await supabase
      .from('epp_criteria')
      .select('*')
      .eq('audit_id', auditData.id)
      .order('sort_order');

    if (criteriaData) setCriteria(criteriaData);

    // Charger les sessions utilisateur
    if (user) {
      const { data: sessionsData } = await supabase
        .from('user_epp_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('audit_id', auditData.id)
        .order('tour');

      if (sessionsData) setSessions(sessionsData);
    }

    setLoading(false);
  };

  const startTour = async (tour: number) => {
    setStarting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !audit) return;

    // Créer la session
    const { data: session, error } = await supabase
      .from('user_epp_sessions')
      .insert({
        user_id: user.id,
        audit_id: audit.id,
        tour: tour
      })
      .select()
      .single();

    if (session && !error) {
      router.push(`/formation/epp/${slug}/grille?session=${session.id}`);
    }
    setStarting(false);
  };

  const t1Session = sessions.find(s => s.tour === 1);
  const t2Session = sessions.find(s => s.tour === 2);

  // Calculer si T2 est disponible (délai respecté)
  const canStartT2 = () => {
    if (!t1Session?.completed_at || !audit) return false;
    const t1Date = new Date(t1Session.completed_at);
    const now = new Date();
    const monthsDiff = (now.getFullYear() - t1Date.getFullYear()) * 12 + (now.getMonth() - t1Date.getMonth());
    return monthsDiff >= audit.delai_t2_mois_min;
  };

  const getT2AvailableDate = () => {
    if (!t1Session?.completed_at || !audit) return null;
    const t1Date = new Date(t1Session.completed_at);
    t1Date.setMonth(t1Date.getMonth() + audit.delai_t2_mois_min);
    return t1Date;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F7B6C]" />
      </div>
    );
  }

  if (!audit) return null;

  return (
    <>
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/formation/epp"
              className="p-2 -ml-2 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{audit.title}</h1>
              <p className="text-xs text-gray-400">Audit EPP • {criteria.length} critères</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-4">

        {/* Description */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-600">{audit.description}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <FileText size={14} />
              {audit.nb_dossiers_min}-{audit.nb_dossiers_max} dossiers
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              Délai T2 : {audit.delai_t2_mois_min}-{audit.delai_t2_mois_max} mois
            </span>
          </div>
        </div>

        {/* Statut Tours */}
        <div className="space-y-3">

          {/* Tour 1 */}
          <div className={`bg-white rounded-2xl border p-4 ${
            t1Session?.completed_at ? 'border-green-200 bg-green-50/30' : 'border-gray-100'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  t1Session?.completed_at ? 'bg-green-100' : 'bg-teal-100'
                }`}>
                  {t1Session?.completed_at ? (
                    <CheckCircle2 size={20} className="text-green-600" />
                  ) : (
                    <span className="text-sm font-bold text-[#0F7B6C]">T1</span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Tour 1 — Évaluation initiale</h3>
                  {t1Session?.completed_at ? (
                    <p className="text-xs text-green-600">
                      Terminé le {new Date(t1Session.completed_at).toLocaleDateString('fr-FR')} •
                      Score : {t1Session.score_global?.toFixed(0)}%
                    </p>
                  ) : t1Session ? (
                    <p className="text-xs text-blue-600">En cours</p>
                  ) : (
                    <p className="text-xs text-gray-400">Non commencé</p>
                  )}
                </div>
              </div>

              {!t1Session?.completed_at && (
                <button
                  onClick={() => t1Session ? router.push(`/formation/epp/${slug}/grille?session=${t1Session.id}`) : startTour(1)}
                  disabled={starting}
                  className="px-4 py-2 bg-[#0F7B6C] text-white text-sm font-semibold rounded-xl hover:bg-[#0a5f54] transition-colors disabled:opacity-50"
                >
                  {starting ? '...' : t1Session ? 'Continuer' : 'Commencer'}
                </button>
              )}
            </div>
          </div>

          {/* Tour 2 */}
          <div className={`bg-white rounded-2xl border p-4 ${
            t2Session?.completed_at ? 'border-green-200 bg-green-50/30' :
            !t1Session?.completed_at ? 'border-gray-100 opacity-50' : 'border-gray-100'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  t2Session?.completed_at ? 'bg-green-100' :
                  !t1Session?.completed_at ? 'bg-gray-100' : 'bg-teal-100'
                }`}>
                  {t2Session?.completed_at ? (
                    <CheckCircle2 size={20} className="text-green-600" />
                  ) : (
                    <span className={`text-sm font-bold ${!t1Session?.completed_at ? 'text-gray-400' : 'text-[#0F7B6C]'}`}>T2</span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Tour 2 — Réévaluation</h3>
                  {t2Session?.completed_at ? (
                    <p className="text-xs text-green-600">
                      Terminé le {new Date(t2Session.completed_at).toLocaleDateString('fr-FR')} •
                      Score : {t2Session.score_global?.toFixed(0)}%
                    </p>
                  ) : !t1Session?.completed_at ? (
                    <p className="text-xs text-gray-400">Terminez le T1 d&apos;abord</p>
                  ) : !canStartT2() ? (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Disponible à partir du {getT2AvailableDate()?.toLocaleDateString('fr-FR')}
                    </p>
                  ) : t2Session ? (
                    <p className="text-xs text-blue-600">En cours</p>
                  ) : (
                    <p className="text-xs text-gray-400">Prêt à démarrer</p>
                  )}
                </div>
              </div>

              {t1Session?.completed_at && !t2Session?.completed_at && canStartT2() && (
                <button
                  onClick={() => t2Session ? router.push(`/formation/epp/${slug}/grille?session=${t2Session.id}`) : startTour(2)}
                  disabled={starting}
                  className="px-4 py-2 bg-[#0F7B6C] text-white text-sm font-semibold rounded-xl hover:bg-[#0a5f54] transition-colors disabled:opacity-50"
                >
                  {starting ? '...' : t2Session ? 'Continuer' : 'Commencer'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Critères d'audit */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Critères d&apos;évaluation ({criteria.length})</h3>
          <div className="space-y-2">
            {criteria.map((c) => (
              <div key={c.id} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  c.type === 'R' ? 'bg-purple-100 text-purple-700' :
                  c.type === 'P' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {c.code}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{c.label}</p>
                  {c.source && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{c.source}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">
            R = Ressources • P = Processus • S = Résultats
          </p>
        </div>

        {/* Résultats si EPP complète */}
        {t1Session?.completed_at && t2Session?.completed_at && (
          <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl border border-green-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 size={24} className="text-green-600" />
              <h3 className="font-bold text-green-800">EPP Validée !</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{t1Session.score_global?.toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Score T1</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{t2Session.score_global?.toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Score T2</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${
                  (t2Session.score_global || 0) >= (t1Session.score_global || 0) ? 'text-green-600' : 'text-red-600'
                }`}>
                  {((t2Session.score_global || 0) - (t1Session.score_global || 0) >= 0 ? '+' : '')}
                  {((t2Session.score_global || 0) - (t1Session.score_global || 0)).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">Amélioration</p>
              </div>
            </div>
            <button className="w-full mt-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors">
              Télécharger l&apos;attestation EPP
            </button>
          </div>
        )}

      </main>
    </>
  );
}
