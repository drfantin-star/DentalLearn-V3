'use client'

import { useMemo } from 'react'

import { findCurrentWord, type FlatWord } from '@/lib/timeline/findCurrentWord'

/**
 * Hook qui retourne le mot actif (ou null) à partir d'un tableau plat de mots
 * et du timestamp courant de l'audio.
 *
 * Throttle effectif à 4 Hz : on ne ré-évalue `findCurrentWord` qu'une fois par
 * tranche de 250 ms (`Math.floor(currentTime * 4)`). C'est suffisant pour un
 * surlignage de karaoké et ça empêche un re-render React à chaque
 * `timeupdate` natif (~250 ms déjà sur Chrome, mais peut être plus dense sur
 * Safari/Firefox).
 */
export function useCurrentWord(
  flatWords: FlatWord[],
  currentTime: number
): FlatWord | null {
  const bucket = Math.floor(currentTime * 4)
  return useMemo(
    () => findCurrentWord(flatWords, currentTime),
    // `bucket` capture la valeur throttée de currentTime ; on doit aussi
    // dépendre de la référence du tableau pour rafraîchir si le transcript
    // change. eslint-disable car `currentTime` n'est volontairement PAS dans
    // les deps (on veut le throttling).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flatWords, bucket]
  )
}
