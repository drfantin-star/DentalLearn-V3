'use client';

import { useState, useEffect } from 'react';
import { ClipboardCheck, ChevronRight, Lock } from 'lucide-react';
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

interface UserSession {
  audit_id: string;
  tour: number;
  completed_at: string | null;
  score_global: number | null;
}

export default function EPPListPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    // Charger les audits publiés
    const { data: auditsData } = await supabase
      .from('epp_audits')
      .select('*')
      .eq('is_published', true)
      .order('title');

    if (auditsData) setAudits(auditsData);

    // Charger les sessions de l'utilisateur
    if (user) {
      const { data: sessionsData } = await supabase
        .from('user_epp_sessions')
        .select('audit_id, tour, completed_at, score_global')
        .eq('user_id', user.id);

      if (sessionsData) setUserSessions(sessionsData);
    }

    setLoading(false);
  };

  const getAuditStatus = (auditId: string) => {
    const sessions = userSessions.filter(s => s.audit_id === auditId);
    const t1 = sessions.find(s => s.tour === 1);
    const t2 = sessions.find(s => s.tour === 2);

    if (t2?.completed_at) return { status: 'completed', label: 'EPP validée ✓', color: 'green' };
    if (t1?.completed_at) return { status: 't1_done', label: 'T1 terminé — T2 à faire', color: 'amber' };
    if (t1) return { status: 't1_started', label: 'T1 en cours', color: 'blue' };
    return { status: 'not_started', label: 'Non commencé', color: 'gray' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F7B6C]" />
      </div>
    );
  }

  return (
    <>
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <ClipboardCheck size={20} className="text-[#0F7B6C]" />
            </div>
            Audit Quest
          </h1>
          <p className="text-xs text-gray-400 mt-1 ml-12">
            Axe 2 • Évaluation des Pratiques Professionnelles
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-4">

        {/* Info box */}
        <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
          <p className="text-xs text-teal-700 leading-relaxed">
            <strong>EPP — Audit clinique en 2 tours :</strong> Évaluez votre pratique sur 10-20 dossiers (T1),
            mettez en place des actions d&apos;amélioration, puis réévaluez après 2-6 mois (T2).
            Validez l&apos;Axe 2 de votre Certification Périodique.
          </p>
        </div>

        {/* Liste des audits */}
        {audits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <ClipboardCheck size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Aucun audit disponible pour le moment</p>
            <p className="text-gray-400 text-xs mt-1">Les audits seront bientôt disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {audits.map((audit) => {
              const { status, label, color } = getAuditStatus(audit.id);

              return (
                <Link
                  key={audit.id}
                  href={`/formation/epp/${audit.slug}`}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:scale-[1.01] transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                      <ClipboardCheck size={20} className="text-[#0F7B6C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm">{audit.title}</h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{audit.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          color === 'green' ? 'bg-green-100 text-green-700' :
                          color === 'amber' ? 'bg-amber-100 text-amber-700' :
                          color === 'blue' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {label}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {audit.nb_dossiers_min}-{audit.nb_dossiers_max} dossiers
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 mt-2 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
