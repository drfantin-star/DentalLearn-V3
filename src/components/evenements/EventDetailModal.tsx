'use client'

import Link from 'next/link'
import { X, MapPin, Video, Calendar, Clock, Users, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import Badge from '@/components/ui/Badge'
import { eventCategoryGradientStyle } from '@/lib/utils/eventCategoryGradient'
import { getCategoryConfig } from '@/lib/supabase/types'
import type { EvenementItemData } from '@/types/evenements'

interface EventDetailModalProps {
  item: EvenementItemData
  onClose: () => void
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

// Fiche détail partagée masterclass (virtuel) / date présentielle — même
// logique de clic sur toutes les cartes événement (home, /evenements) :
// la carte ouvre le détail, l'inscription/le "Rejoindre" est un CTA DANS
// la fiche, jamais une action directe sur la carte.
export default function EventDetailModal({ item, onClose }: EventDetailModalProps) {
  const dateStr = format(parseISO(item.starts_at), "EEEE d MMMM yyyy '·' HH'h'mm", { locale: fr })
  const endStr = item.ends_at ? format(parseISO(item.ends_at), "HH'h'mm", { locale: fr }) : null
  const gradientStyle = eventCategoryGradientStyle(item.category)
  const categoryConfig = item.category ? getCategoryConfig(item.category) : null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl max-h-[85vh] overflow-y-auto"
        style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bandeau thématique */}
        <div
          className="relative p-5 rounded-t-2xl md:rounded-t-2xl"
          style={gradientStyle ?? { background: '#242424' }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/20 hover:bg-black/30 transition-colors"
            aria-label="Fermer"
          >
            <X size={18} className="text-white" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={item.type === 'presentiel' ? 'info' : 'success'} size="sm">
              {item.type === 'presentiel' ? 'Présentiel' : 'Classe virtuelle'}
            </Badge>
            {categoryConfig && (
              <span className="text-xs font-semibold text-white/90">{categoryConfig.emoji} {categoryConfig.name}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white leading-snug pr-8">{item.title}</h2>
        </div>

        <div className="p-5 space-y-4">
          {item.description && (
            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{item.description}</p>
          )}

          <div className="flex items-start gap-2 text-sm text-neutral-300">
            <Calendar size={16} className="mt-0.5 shrink-0 text-neutral-400" />
            <span className="capitalize">
              {dateStr}
              {endStr && ` – ${endStr}`}
            </span>
          </div>

          {item.type === 'presentiel' ? (
            (item.location_city || item.location_venue) && (
              <div className="flex items-start gap-2 text-sm text-neutral-300">
                <MapPin size={16} className="mt-0.5 shrink-0 text-neutral-400" />
                <span>{[item.location_venue, item.location_city].filter(Boolean).join(', ')}</span>
              </div>
            )
          ) : (
            item.duration_min != null && (
              <div className="flex items-start gap-2 text-sm text-neutral-300">
                <Clock size={16} className="mt-0.5 shrink-0 text-neutral-400" />
                <span>{item.duration_min} minutes</span>
              </div>
            )
          )}

          {item.capacity != null && (
            <div className="flex items-start gap-2 text-sm text-neutral-300">
              <Users size={16} className="mt-0.5 shrink-0 text-neutral-400" />
              <span>{item.capacity} places</span>
            </div>
          )}

          {item.formateur_display_name && (
            <div className="flex items-center gap-2.5 pt-1">
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-neutral-700">
                {item.formateur_photo_url ? (
                  <img src={item.formateur_photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-neutral-300">{getInitials(item.formateur_display_name)}</span>
                )}
              </div>
              {item.formateur_slug ? (
                <Link href={`/formateurs/${item.formateur_slug}`} className="text-sm font-semibold text-neutral-100 hover:underline">
                  {item.formateur_display_name}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-neutral-100">{item.formateur_display_name}</span>
              )}
            </div>
          )}

          {item.type === 'presentiel' ? (
            item.external_registration_url && (
              <a
                href={item.external_registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 w-full rounded-xl flex items-center justify-center gap-1.5 font-bold py-3 text-sm bg-primary text-white hover:bg-primary-hover transition-colors"
              >
                S'inscrire
                <ExternalLink size={14} />
              </a>
            )
          ) : (
            <Link
              href={`/sessions/${item.id}`}
              className="mt-2 w-full rounded-xl flex items-center justify-center gap-1.5 font-bold py-3 text-sm bg-primary text-white hover:bg-primary-hover transition-colors"
            >
              <Video size={14} />
              Rejoindre
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
