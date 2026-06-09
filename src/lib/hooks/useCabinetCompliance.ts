'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  CabinetComplianceCategory,
  CabinetComplianceItem,
  ComplianceStatus,
  UserCabinetCompliance,
} from '@/lib/supabase/types'

/** Statut effectif affiché à l'écran : statut stocké + 'expired' dérivé des dates. */
export type EffectiveComplianceStatus = ComplianceStatus | 'expired'

/** Un item 'done' dont l'échéance est dépassée est considéré 'expired' (dérivé). */
export function deriveEffectiveStatus(
  row: UserCabinetCompliance | undefined,
  todayISO: string,
): EffectiveComplianceStatus {
  if (!row) return 'todo'
  if (row.status === 'done' && row.expiry_date && row.expiry_date < todayISO) {
    return 'expired'
  }
  return row.status
}

/**
 * Source de progression du module Conformité cabinet.
 * Lit les 3 tables `cabinet_compliance_*` et expose une fonction d'écriture
 * (upsert sur `user_cabinet_compliance`, contrainte unique user_id+item_id).
 * N'écrit que les statuts valides : 'todo' | 'done' | 'not_applicable'.
 */
export function useCabinetCompliance() {
  const [categories, setCategories] = useState<CabinetComplianceCategory[]>([])
  const [items, setItems] = useState<CabinetComplianceItem[]>([])
  const [progressByItem, setProgressByItem] = useState<
    Record<string, UserCabinetCompliance>
  >({})
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const [catRes, itemRes, progRes] = await Promise.all([
          supabase
            .from('cabinet_compliance_categories')
            .select('*')
            .order('display_order', { ascending: true }),
          supabase
            .from('cabinet_compliance_items')
            .select('*')
            .order('display_order', { ascending: true }),
          user
            ? supabase
                .from('user_cabinet_compliance')
                .select('*')
                .eq('user_id', user.id)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (catRes.error) throw catRes.error
        if (itemRes.error) throw itemRes.error
        if (progRes.error) throw progRes.error

        if (cancelled) return

        setUserId(user?.id ?? null)
        setCategories((catRes.data as CabinetComplianceCategory[]) ?? [])
        setItems((itemRes.data as CabinetComplianceItem[]) ?? [])
        setProgressByItem(
          Object.fromEntries(
            ((progRes.data as UserCabinetCompliance[]) ?? []).map((row) => [
              row.item_id,
              row,
            ]),
          ),
        )
      } catch (err) {
        if (!cancelled) setError(err as Error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const setItemStatus = useCallback(
    async (itemId: string, status: ComplianceStatus): Promise<boolean> => {
      if (!userId) return false

      // Mise à jour optimiste.
      const previous = progressByItem[itemId]
      const nowISO = new Date().toISOString()
      const optimistic: UserCabinetCompliance = {
        id: previous?.id ?? `optimistic-${itemId}`,
        user_id: userId,
        item_id: itemId,
        status,
        last_check_date: previous?.last_check_date ?? null,
        next_check_date: previous?.next_check_date ?? null,
        expiry_date: previous?.expiry_date ?? null,
        proof_url: previous?.proof_url ?? null,
        notes: previous?.notes ?? null,
        created_at: previous?.created_at ?? nowISO,
        updated_at: nowISO,
      }
      setProgressByItem((prev) => ({ ...prev, [itemId]: optimistic }))

      const supabase = createClient()
      const { data, error: upsertError } = await supabase
        .from('user_cabinet_compliance')
        .upsert(
          { user_id: userId, item_id: itemId, status, updated_at: nowISO },
          { onConflict: 'user_id,item_id' },
        )
        .select()
        .single()

      if (upsertError) {
        // Rollback.
        setProgressByItem((prev) => {
          const next = { ...prev }
          if (previous) next[itemId] = previous
          else delete next[itemId]
          return next
        })
        setError(upsertError as unknown as Error)
        return false
      }

      setProgressByItem((prev) => ({
        ...prev,
        [itemId]: data as UserCabinetCompliance,
      }))
      return true
    },
    [userId, progressByItem],
  )

  return { categories, items, progressByItem, loading, error, setItemStatus }
}
