'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  Save,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Bell,
  Star,
  Flame,
  BookOpen,
  Mail,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  profile_photo_url: string | null;
  created_at: string;
}

interface UserStats {
  total_points: number;
  current_streak: number;
  longest_streak: number;
  completed_sequences: number;
  completed_formations: number;
}

export default function ProfilPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUserAndLoadData();
  }, []);

  const checkUserAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      await loadOrCreateProfile(session.user.id, session.user.email!);
      await loadStats();
    } catch (error) {
      console.error('Erreur:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement du profil' });
    } finally {
      setLoading(false);
    }
  };

  const loadOrCreateProfile = async (userId: string, email: string) => {
    const { data: existingProfile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: createdProfile } = await supabase
        .from('user_profiles')
        .insert({ id: userId, first_name: null, last_name: null, profile_photo_url: null })
        .select()
        .single();

      setProfile({
        ...(createdProfile || { id: userId, first_name: null, last_name: null, profile_photo_url: null, created_at: new Date().toISOString() }),
        email
      });
    } else if (existingProfile) {
      setProfile({ ...existingProfile, email });
      setFirstName(existingProfile.first_name || '');
      setLastName(existingProfile.last_name || '');
      setPhotoUrl(existingProfile.profile_photo_url);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/user/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner une image' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'L\'image doit faire moins de 2 MB' });
      return;
    }

    setUploadingPhoto(true);
    setMessage(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ profile_photo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setPhotoUrl(publicUrl);
      setProfile(prev => prev ? { ...prev, profile_photo_url: publicUrl } : null);
      setMessage({ type: 'success', text: 'Photo mise à jour !' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erreur lors de l\'upload' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          first_name: firstName || null,
          last_name: lastName || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, first_name: firstName, last_name: lastName } : null);
      setEditMode(false);
      setMessage({ type: 'success', text: 'Profil mis à jour !' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Minimum 8 caractères' });
      return;
    }

    setPasswordSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setMessage({ type: 'success', text: 'Mot de passe modifié !' });
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erreur' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getInitials = () => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (profile?.email) return profile.email[0].toUpperCase();
    return 'U';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2D1B96]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Mon Profil</h1>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <p className="text-sm">{message.text}</p>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Carte Photo + Nom */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          {/* Banner gradient */}
          <div className="h-20 bg-gradient-to-r from-[#2D1B96] to-[#00D1C1]" />

          {/* Photo + infos */}
          <div className="px-5 pb-5">
            <div className="flex items-end gap-4 -mt-10">
              {/* Photo */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center text-xl font-bold text-[#2D1B96] overflow-hidden">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    getInitials()
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors border"
                >
                  {uploadingPhoto ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2D1B96]" />
                  ) : (
                    <Camera className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>

              {/* Nom + email */}
              <div className="flex-1 pt-12">
                {editMode ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                        placeholder="Prénom"
                      />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
                        placeholder="Nom"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-[#2D1B96] text-white text-sm font-medium rounded-xl hover:bg-[#2D1B96]/90 disabled:opacity-50"
                      >
                        {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Save className="w-4 h-4" />}
                        Enregistrer
                      </button>
                      <button
                        onClick={() => { setEditMode(false); setFirstName(profile?.first_name || ''); setLastName(profile?.last_name || ''); }}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">
                          {firstName && lastName ? `Dr ${firstName} ${lastName}` : 'Compléter mon profil'}
                        </h2>
                        <p className="text-sm text-gray-500">Chirurgien-dentiste</p>
                      </div>
                      <button
                        onClick={() => setEditMode(true)}
                        className="text-sm text-[#2D1B96] font-medium hover:underline"
                      >
                        Modifier
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Infos supplémentaires */}
            {!editMode && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{profile?.email}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Membre depuis {formatDate(profile?.created_at || '')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">Mes statistiques</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <p className="text-xl font-bold text-gray-900">{stats?.total_points || 0}</p>
              <p className="text-xs text-gray-500">Points</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-orange-100 rounded-xl flex items-center justify-center">
                <Flame className="w-6 h-6 text-orange-600" />
              </div>
              <p className="text-xl font-bold text-gray-900">{stats?.current_streak || 0}</p>
              <p className="text-xs text-gray-500">Jours de suite</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-blue-100 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-xl font-bold text-gray-900">{stats?.completed_sequences || 0}</p>
              <p className="text-xs text-gray-500">Séquences</p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Notifications</h3>
              <p className="text-sm text-gray-500">Rappels et résultats</p>
            </div>
          </div>
          <PushNotificationToggle />
        </div>

        {/* Sécurité */}
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gray-100 rounded-xl">
              <Lock className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Sécurité</h3>
              <p className="text-sm text-gray-500">Mot de passe</p>
            </div>
          </div>

          {showPasswordForm ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2D1B96] pr-10"
                    placeholder="Minimum 8 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2D1B96]"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !newPassword || !confirmPassword}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2D1B96] text-white text-sm font-medium rounded-xl disabled:opacity-50"
                >
                  {passwordSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Save className="w-4 h-4" />}
                  Changer
                </button>
                <button
                  onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="flex items-center justify-between w-full py-3 text-left hover:bg-gray-50 rounded-xl px-3 -mx-3"
            >
              <span className="text-sm text-gray-700">Changer mon mot de passe</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
