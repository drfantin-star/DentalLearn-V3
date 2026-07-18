import { z } from 'zod'
import { EVENT_CATEGORY_VALUES } from '@/lib/constants/eventCategories'

export const LiveSessionSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(200),
  description: z.string().optional().nullable(),
  starts_at: z.string().min(1, 'La date de début est requise'),
  duration_min: z.number().int().positive().default(60),
  zoom_url: z.string().url('URL Zoom invalide').optional().nullable().or(z.literal('')),
  zoom_password: z.string().max(100).optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  formation_id: z.string().uuid().optional().nullable(),
  category: z.enum(EVENT_CATEGORY_VALUES).optional().nullable(),
  is_published: z.boolean().default(false),
})

export type LiveSessionPayload = z.infer<typeof LiveSessionSchema>

// Superadmin crée une masterclass et la propose directement à un formateur
// (workflow de validation croisée, sens 2). Pas de is_published : la session
// naît en pending_review, la publication vient après acceptation.
export const AdminProposeLiveSessionSchema = z.object({
  formateur_user_id: z.string().uuid('Formateur cible requis'),
  title: z.string().min(1, 'Le titre est requis').max(200),
  description: z.string().optional().nullable(),
  starts_at: z.string().min(1, 'La date de début est requise'),
  duration_min: z.number().int().positive().default(60),
  zoom_url: z.string().url('URL Zoom invalide').optional().nullable().or(z.literal('')),
  zoom_password: z.string().max(100).optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  formation_id: z.string().uuid().optional().nullable(),
  category: z.enum(EVENT_CATEGORY_VALUES).optional().nullable(),
})

export type AdminProposeLiveSessionPayload = z.infer<typeof AdminProposeLiveSessionSchema>
