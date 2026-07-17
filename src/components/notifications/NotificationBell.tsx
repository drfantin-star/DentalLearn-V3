'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface AppNotification {
  id: string
  title: string | null
  message: string
  created_at: string
  read_at: string | null
  metadata: { href?: string } | null
}

// Le panneau n'affiche que les 10 dernières notifications ; le badge, lui,
// compte le TOTAL de non-lues (requête séparée, non plafonnée).
const PANEL_LIMIT = 10

export default function NotificationBell() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setLoading(true)
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, title, message, created_at, read_at, metadata')
        .eq('user_id', session.user.id)
        .eq('type', 'in_app')
        .order('created_at', { ascending: false })
        .limit(PANEL_LIMIT),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('type', 'in_app')
        .is('read_at', null),
    ])
    setNotifications((data ?? []) as AppNotification[])
    setUnreadCount(count ?? 0)
    setLoading(false)
  }, [supabase])

  // Chargement au montage + refresh au focus (pas de temps réel — V1 assumée).
  useEffect(() => {
    load()
    function onFocus() { load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [load])

  // Non-lues d'abord (plus récentes en premier), puis lues. Tri stable :
  // la requête est déjà triée par created_at desc, donc l'ordre relatif à
  // l'intérieur de chaque groupe (non-lues / lues) est préservé.
  const sorted = [...notifications].sort((a, b) => (a.read_at ? 1 : 0) - (b.read_at ? 1 : 0))

  async function markRead(id: string) {
    const wasUnread = notifications.find(n => n.id === id)?.read_at == null
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })))
    setUnreadCount(0)
    await supabase.from('notifications').update({ read_at: now }).eq('user_id', session.user.id).is('read_at', null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
      >
        <Bell size={18} className="text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Scrim : ferme au clic extérieur + fait ressortir le panneau du fond */}
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden z-50 shadow-2xl"
            style={{ background: '#1A1A2E', border: '1px solid rgba(255,255,255,0.16)' }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-sm font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-semibold text-white bg-primary/25 border border-primary/50 rounded-lg px-2.5 py-1 hover:bg-primary/35 transition-colors"
                >
                  Tout marquer lu
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-white/70 text-center py-6">Chargement…</p>
              ) : sorted.length === 0 ? (
                <p className="text-sm text-white/70 text-center py-6">Vous êtes à jour</p>
              ) : (
                sorted.map(n => {
                  const href = n.metadata?.href
                  const content = (
                    <div
                      className="px-4 py-3 flex items-start gap-2"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {!n.read_at && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        {n.title && (
                          <p className={`text-sm font-semibold ${n.read_at ? 'text-white/75' : 'text-white'}`}>
                            {n.title}
                          </p>
                        )}
                        <p className={`text-sm mt-0.5 whitespace-pre-line ${n.read_at ? 'text-white/70' : 'text-white/85'}`}>
                          {n.message}
                        </p>
                        <p className="text-[11px] text-white/60 mt-1">{formatDate(n.created_at)}</p>
                      </div>
                    </div>
                  )
                  return href ? (
                    <Link
                      key={n.id}
                      href={href}
                      onClick={() => { markRead(n.id); setOpen(false) }}
                      className="block hover:bg-white/5 transition-colors"
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="block w-full text-left hover:bg-white/5 transition-colors"
                    >
                      {content}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
