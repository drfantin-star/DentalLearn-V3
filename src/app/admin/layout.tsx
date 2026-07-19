'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import DesktopOnly from '@/components/layout/DesktopOnly';
import Link from 'next/link';
import {
  LayoutDashboard,
  BookOpen,
  Newspaper,
  Users,
  LogOut,
  Shield,
  ShieldCheck,
  Beaker,
  ClipboardCheck,
  MessageSquareWarning,
  Building2,
  Star,
  UserCheck,
  FileAudio,
  Library,
  ArrowLeft,
  Video,
  Wrench,
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [masterclassPendingCount, setMasterclassPendingCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data: isSA } = await supabase.rpc('is_super_admin', {
        p_user_id: session.user.id,
      });
      if (!isSA) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);
      loadMasterclassPendingCount();
    } catch (error) {
      console.error('Erreur vérification admin:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const loadMasterclassPendingCount = async () => {
    const { count } = await supabase
      .from('live_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('awaiting', 'admin')
      .is('deleted_at', null);
    setMasterclassPendingCount(count ?? 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center" style={{ colorScheme: 'light' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center" style={{ colorScheme: 'light' }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
          <p className="text-gray-600 mb-6">
            Vous n'avez pas les droits d'accès à l'interface administrateur.
          </p>
          <Link
            href="/"
            className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-hover transition-colors"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DesktopOnly title="Administration">
    <div className="min-h-screen bg-gray-100 flex" style={{ colorScheme: 'light' }}>
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold">Certily</h1>
          <p className="text-sm text-white/70">Administration</p>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <Link
                href="/admin"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/admin/formations"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <BookOpen className="w-5 h-5" />
                Formations
              </Link>
            </li>
            <li>
              <Link
                href="/admin/bibliotheque"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Library className="w-5 h-5" />
                Bibliothèque
              </Link>
            </li>
            <li>
              <Link
                href="/admin/news"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Newspaper className="w-5 h-5" />
                News
              </Link>
            </li>
            <li>
              <Link
                href="/admin/news/journal"
                className="flex items-center gap-3 px-4 py-2 ml-6 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                <Newspaper className="w-4 h-4 opacity-70" />
                Journal hebdo
              </Link>
            </li>
            <li>
              <Link
                href="/admin/epp"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <ClipboardCheck className="w-5 h-5" />
                Audits EPP
              </Link>
            </li>
            <li>
              <Link
                href="/admin/organizations"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Building2 className="w-5 h-5" />
                Organisations
              </Link>
            </li>
            <li>
              <Link
                href="/admin/formateurs"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <UserCheck className="w-5 h-5" />
                Formateurs
              </Link>
            </li>
            <li>
              <Link
                href="/admin/masterclass"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Video className="w-5 h-5" />
                <span className="flex-1">Masterclass</span>
                {masterclassPendingCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                    {masterclassPendingCount}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link
                href="/admin/access-management"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Users className="w-5 h-5" />
                Utilisateurs
              </Link>
            </li>
            <li>
              <Link
                href="/admin/reclamations"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <MessageSquareWarning className="w-5 h-5" />
                Réclamations
              </Link>
            </li>
            <li>
              <Link
                href="/admin/satisfaction"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Star className="w-5 h-5" />
                Satisfaction
              </Link>
            </li>
            <li>
              <Link
                href="/admin/cs-members"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Users className="w-5 h-5" />
                Comité scientifique
              </Link>
            </li>
            <li>
              <Link
                href="/admin/editorial-validations"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <ShieldCheck className="w-5 h-5" />
                Validations éditoriales
              </Link>
            </li>
            <li>
              <Link
                href="/admin/poc"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <FileAudio className="w-5 h-5" />
                POC Audio
              </Link>
            </li>
            <li>
              <Link
                href="/admin/poc/extract-scenes"
                className="flex items-center gap-3 px-4 py-2 ml-6 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                <FileAudio className="w-4 h-4 opacity-70" />
                Extraction scènes (T5)
              </Link>
            </li>
            <li>
              <Link
                href="/admin/audio-jobs"
                className="flex items-center gap-3 px-4 py-2 ml-6 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                <FileAudio className="w-4 h-4 opacity-70" />
                Audio Jobs
              </Link>
            </li>
            <li>
              <Link
                href="/admin/poc/karaoke"
                className="flex items-center gap-3 px-4 py-2 ml-6 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                <FileAudio className="w-4 h-4 opacity-70" />
                Karaoké transcript (T3)
              </Link>
            </li>
            <li>
              <Link
                href="/admin/poc/extract-scenes"
                className="flex items-center gap-3 px-4 py-2 ml-6 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                <FileAudio className="w-4 h-4 opacity-70" />
                Éditeur timeline (via T5)
              </Link>
            </li>
            <li>
              <Link
                href="/admin/outils"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Wrench className="w-5 h-5" />
                Boîte à outils
              </Link>
            </li>
            <li>
              <Link
                href="/admin/test-mode"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Beaker className="w-5 h-5" />
                Mode Test
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors w-full text-left text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la plateforme
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
    </DesktopOnly>
  );
}
