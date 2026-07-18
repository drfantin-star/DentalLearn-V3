import { z } from 'zod'

const optionalUrl = z
  .string()
  .url('URL invalide')
  .optional()
  .nullable()
  .or(z.literal(''))

export const FormateurProfilSchema = z.object({
  first_name: z.string().max(80, 'Prénom trop long (max 80 caractères)').optional().nullable(),
  last_name: z.string().max(80, 'Nom trop long (max 80 caractères)').optional().nullable(),
  bio_long: z.string().max(5000, 'Bio trop longue (max 5000 caractères)').optional().nullable(),
  expertise_tags: z
    .array(z.string().min(1).max(50))
    .max(20, 'Maximum 20 spécialités')
    .optional()
    .nullable(),
  annees_experience: z
    .number()
    .int()
    .min(0)
    .max(60, "Valeur irréaliste (max 60 ans d'expérience)")
    .optional()
    .nullable(),
  ville: z.string().max(120).optional().nullable(),
  cabinet_nom: z.string().max(200).optional().nullable(),
  linkedin_url: optionalUrl,
  instagram_url: optionalUrl,
  is_published: z.boolean().optional(),
})

export type FormateurProfilInput = z.infer<typeof FormateurProfilSchema>
