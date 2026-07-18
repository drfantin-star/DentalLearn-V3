import { z } from 'zod'

export const LiveSessionReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().max(2000).optional().nullable(),
})

export type LiveSessionReviewPayload = z.infer<typeof LiveSessionReviewSchema>
