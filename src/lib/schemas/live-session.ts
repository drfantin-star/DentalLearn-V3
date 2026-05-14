import { z } from 'zod'

export const LiveSessionSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(200),
  description: z.string().optional().nullable(),
  starts_at: z.string().min(1, 'La date de début est requise'),
  duration_min: z.number().int().positive().default(60),
  zoom_url: z.string().url('URL Zoom invalide').optional().nullable().or(z.literal('')),
  zoom_password: z.string().max(100).optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  formation_id: z.string().uuid().optional().nullable(),
  is_published: z.boolean().default(false),
})

export type LiveSessionPayload = z.infer<typeof LiveSessionSchema>
