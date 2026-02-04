'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Unlock,
  Lock,
  CheckCircle,
  AlertCircle,
  Search,
  RefreshCw,
  BookOpen
} from 'lucide-react';

interface UserEnrollment {
  id: string;
  user_id: string;
  formation_id: string;
  started_at: string;
  is_active: boolean;
  access_type: 'demo' | 'full';
  user_profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  user_email: string;
  formation: {
    id: string;
    title: string;
  };
}

export default function AccessManagementPage() {
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<UserEnrollment[]>([]);
  const [filteredEnrollments, setFilteredEnrollments] = useState<UserEnrollment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccess, setFilterAccess] = useState<'all' | 'demo' | 'full'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  useEffect(() => {
    filterEnrollments();
  }, [enrollments, searchTerm, filterAccess]);

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

      await loadEnrollments();
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async () => {
    try {
      const res = await fetch('/api/admin/enrollments');

      if (!res.ok) {
        const errorData = await res.json();
        console.error('Erreur API:', errorData);
        return;
      }

      const { enrollments: enrollmentsData } = await res.json();

      if (!enrollmentsData) {
        setEnrollments([]);
        return;
      }

      setEnrollments(enrollmentsData);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const filterEnrollments = () => {
    let filtered = [...enrollments];

    // Filtre par recherche
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        (e.user_profile?.first_name?.toLowerCase().includes(search)) ||
        (e.user_profile?.last_name?.toLowerCase().includes(search)) ||
        (e.user_email?.toLowerCase().includes(search)) ||
        (e.formation?.title?.toLowerCase().includes(search))
      );
    }

    // Filtre par type d'accès
    if (filterAccess !== 'all') {
      filtered = filtered.filter(e => e.access_type === filterAccess);
    }

    setFilteredEnrollments(filtered);
  };

  const toggleAccessType = async (enrollmentId: string, currentType: 'demo' | 'full') => {
    setProcessing(enrollmentId);
    setMessage(null);

    const newType = currentType === 'demo' ? 'full' : 'demo';

    try {
      const res = await fetch('/api/admin/enrollments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, accessType: newType })
      });

      if (!res.ok) throw new Error('Erreur API');

      // Mettre à jour l'état local
      setEnrollments(prev => prev.map(e =>
        e.id === enrollmentId ? { ...e, access_type: newType } : e
      ));

      setMessage({
        type: 'success',
        text: newType === 'full'
          ? 'Accès complet activé avec succès'
          : 'Accès révoqué (mode démo)'
      });
    } catch (error) {
      console.error('Erreur:', error);
      setMessage({
        type: 'error',
        text: 'Erreur lors de la modification'
      });
    } finally {
      setProcessing(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getUserDisplayName = (enrollment: UserEnrollment): string => {
    if (enrollment.user_profile?.first_name) {
      return enrollment.user_profile.last_name
        ? `${enrollment.user_profile.first_name} ${enrollment.user_profile.last_name}`
        : enrollment.user_profile.first_name;
    }
    if (enrollment.user_email && enrollment.user_email.includes('@')) {
      return enrollment.user_email;
    }
    return `Utilisateur ${enrollment.user_id.substring(0, 8)}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const stats = {
    total: enrollments.length,
    demo: enrollments.filter(e => e.access_type === 'demo').length,
    full: enrollments.filter(e => e.access_type === 'full').length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D1B96]"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#2D1B96]/10 rounded-xl">
            <Users className="w-8 h-8 text-[#2D1B96]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des accès</h1>
            <p className="text-gray-600">Gérer les accès aux formations</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total inscriptions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Lock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Mode Démo</p>
              <p className="text-2xl font-bold text-orange-600">{stats.demo}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Unlock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Accès complet</p>
              <p className="text-2xl font-bold text-green-600">{stats.full}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-md p-5 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou formation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B96]/50 focus:border-[#2D1B96]"
            />
          </div>

          {/* Filtre accès */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterAccess('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterAccess === 'all'
                  ? 'bg-[#2D1B96] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterAccess('demo')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterAccess === 'demo'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Démo
            </button>
            <button
              onClick={() => setFilterAccess('full')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterAccess === 'full'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Complet
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => loadEnrollments()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Liste des inscriptions */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Formation
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date inscription
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut accès
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Aucune inscription trouvée
                  </td>
                </tr>
              ) : (
                filteredEnrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#2D1B96]/10 flex items-center justify-center">
                          <span className="font-medium text-[#2D1B96]">
                            {enrollment.user_profile?.first_name?.[0]?.toUpperCase() || enrollment.user_email?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {getUserDisplayName(enrollment)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {enrollment.user_email && enrollment.user_email.includes('@')
                              ? enrollment.user_email
                              : `ID: ${enrollment.user_id.substring(0, 8)}...`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{enrollment.formation?.title || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(enrollment.started_at)}
                    </td>
                    <td className="px-6 py-4">
                      {enrollment.access_type === 'demo' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          <Lock className="w-3 h-3" />
                          Démo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <Unlock className="w-3 h-3" />
                          Complet
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleAccessType(enrollment.id, enrollment.access_type)}
                        disabled={processing === enrollment.id}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                          enrollment.access_type === 'demo'
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        } ${processing === enrollment.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {processing === enrollment.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : enrollment.access_type === 'demo' ? (
                          <>
                            <Unlock className="w-4 h-4" />
                            Débloquer
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            Révoquer
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Informations sur les types d'accès :</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Démo</strong> : L'utilisateur n'a accès qu'à la séquence 1</li>
              <li><strong>Complet</strong> : L'utilisateur a accès progressif aux 15 séquences</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
