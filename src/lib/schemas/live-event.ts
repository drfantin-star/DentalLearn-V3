import { z } from 'zod'
import { EVENT_CATEGORY_VALUES } from '@/lib/constants/eventCategories'

export const LiveEventSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(200),
  description: z.string().optional().nullable(),
  location_city: z.string().min(1, 'La ville est requise').max(120),
  location_venue: z.string().max(200).optional().nullable(),
  starts_at: z.string().min(1, 'La date de début est requise'),
  ends_at: z.string().optional().nullable(),
  external_registration_url: z
    .string()
    .url('URL invalide')
    .optional()
    .nullable()
    .or(z.literal('')),
  capacity: z.number().int().positive().optional().nullable(),
  formation_id: z.string().uuid().optional().nullable(),
  category: z.enum(EVENT_CATEGORY_VALUES).optional().nullable(),
  is_published: z.boolean().default(false),
})

export type LiveEventPayload = z.infer<typeof LiveEventSchema>

// Subset pour la validation côté client (champs toujours présents dans le form)
export const LiveEventClientSchema = LiveEventSchema.extend({
  starts_at: z.string().min(1, 'La date de début est requise'),
})
