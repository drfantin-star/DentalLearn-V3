'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Beaker, BookOpen, FileText, HelpCircle, Users, Shield } from 'lucide-react';
import Link from 'next/link';

interface Stats {
  formations: number;
  sequences: number;
  questions: number;
  users: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    formations: 0,
    sequences: 0,
    questions: 0,
    users: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Vérifier si admin
      if (session.user.email !== 'drfantin@gmail.com') {
        router.push('/');
        return;
      }

      setIsAdmin(true);
      await loadStats();
    } catch (error) {
      console.error('Erreur:', error);
      router.push('/');
    }
  };

  const loadStats = async () => {
    try {
      const { count: formationsCount } = await supabase
        .from('formations')
        .select('*', { count: 'exact', head: true });

      const { count: sequencesCount } = await supabase
        .from('sequences')
        .select('*', { count: 'exact', head: true });

      const { count: questionsCount } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true });

      const { count: usersCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      setStats({
        formations: formationsCount || 0,
        sequences: sequencesCount || 0,
        questions: questionsCount || 0,
        users: usersCount || 0,
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Formations', value: stats.formations, icon: BookOpen, color: 'bg-blue-500', href: '/admin/formations' },
    { title: 'Séquences', value: stats.sequences, icon: FileText, color: 'bg-green-500', href: '/admin/formations' },
    { title: 'Questions', value: stats.questions, icon: HelpCircle, color: 'bg-purple-500', href: '/admin/formations' },
    { title: 'Utilisateurs', value: stats.users, icon: Users, color: 'bg-orange-500', href: '/admin/access-management' },
  ];

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Admin</h1>
        <p className="text-gray-600 mt-1">Vue d'ensemble de DentalLearn</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={`${card.color} p-3 rounded-xl`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? '...' : card.value}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/admin/formations/new"
            className="flex items-center gap-3 p-4 bg-[#2D1B96]/10 rounded-xl hover:bg-[#2D1B96]/20 transition-colors"
          >
            <BookOpen className="w-5 h-5 text-[#2D1B96]" />
            <span className="font-medium text-[#2D1B96]">Créer une formation</span>
          </Link>
          <Link
            href="/admin/formations"
            className="flex items-center gap-3 p-4 bg-green-100 rounded-xl hover:bg-green-200 transition-colors"
          >
            <FileText className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-600">Gérer les formations</span>
          </Link>
          <Link
            href="/admin/access-management"
            className="flex items-center gap-3 p-4 bg-purple-100 rounded-xl hover:bg-purple-200 transition-colors"
          >
            <Shield className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-purple-600">Gestion des accès utilisateurs</span>
          </Link>
          <Link
            href="/admin/test-mode"
            className="flex items-center gap-3 p-4 bg-yellow-50 hover:bg-yellow-100 rounded-xl transition-colors"
          >
            <Beaker className="w-5 h-5 text-yellow-600" />
            <span className="font-medium text-yellow-800">Mode Test (débloquer séquences)</span>
          </Link>
        </div>
      </div>

      {/* Version Info */}
      <div className="mt-8 text-center text-sm text-gray-500">
        DentalLearn Admin v3.0
      </div>
    </div>
  );
}
