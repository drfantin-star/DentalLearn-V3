'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface SearchedUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  formations: Array<{ id: string; title: string }>;
}

export default function AddEnrollmentModal({ isOpen, onClose, onSuccess, formations }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);
  const [selectedFormationId, setSelectedFormationId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedUser(null);
      setSelectedFormationId('');
      setSubmitting(false);
      setError(null);
      setShowDropdown(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedUser) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          setResults([]);
        } else {
          const { users } = await res.json();
          setResults(users || []);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedUser]);

  const handleSelectUser = (user: SearchedUser) => {
    setSelectedUser(user);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  const handleChangeUser = () => {
    setSelectedUser(null);
    setQuery('');
    setResults([]);
  };

  const userDisplayName = (u: SearchedUser): string => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    return name || u.email || u.id.substring(0, 8);
  };

  const handleSubmit = async () => {
    if (!selectedUser || !selectedFormationId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, formationId: selectedFormationId })
      });

      if (res.status === 409) {
        setError('Cet utilisateur est déjà inscrit à cette formation');
        return;
      }

      if (!res.ok) {
        setError('Erreur lors de la création');
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError('Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canSubmit = !!selectedUser && !!selectedFormationId && !submitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ajouter une inscription</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* User search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Utilisateur
            </label>

            {selectedUser ? (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {userDisplayName(selectedUser)}
                    </p>
                    {selectedUser.email && (
                      <p className="text-xs text-gray-500 truncate">{selectedUser.email}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleChangeUser}
                  className="text-sm text-primary hover:underline ml-3 flex-shrink-0"
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Email, prénom ou nom (min 2 caractères)"
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                />

                {showDropdown && query.trim().length >= 2 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searching ? (
                      <div className="px-3 py-3 text-sm text-gray-500 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Recherche...
                      </div>
                    ) : results.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-500">
                        Aucun résultat
                      </div>
                    ) : (
                      results.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectUser(u)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {userDisplayName(u)}
                          </p>
                          {u.email && (
                            <p className="text-xs text-gray-500 truncate">{u.email}</p>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formation select */}
          <div>
            <label htmlFor="formation-select" className="block text-sm font-medium text-gray-700 mb-2">
              Formation
            </label>
            <select
              id="formation-select"
              value={selectedFormationId}
              onChange={(e) => setSelectedFormationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm bg-white text-gray-900"
            >
              <option value="">— Sélectionner une formation —</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Inscrire
          </button>
        </div>
      </div>
    </div>
  );
}
