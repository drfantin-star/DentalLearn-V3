'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  LogOut,
  Shield,
  Beaker
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
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

      // Vérification admin par email
      const adminEmails = ['drfantin@gmail.com'];
      if (!adminEmails.includes(session.user.email || '')) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Erreur vérification admin:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
          <p className="text-gray-600 mb-6">
            Vous n'avez pas les droits d'accès à l'interface administrateur.
          </p>
          <Link
            href="/"
            className="inline-block bg-[#2D1B96] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#231575] transition-colors"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#2D1B96] text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold">DentalLearn</h1>
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
                href="/admin/access-management"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <Users className="w-5 h-5" />
                Utilisateurs
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

        <div className="p-4 border-t border-white/10">
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
  );
}
