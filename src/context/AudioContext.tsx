'use client'

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react'
import { createClient } from '@/lib/supabase/client'

// ============================================
// TYPES
// ============================================

interface PlaybackEvent {
  time: number
  action: 'play' | 'pause' | 'complete'
  timestamp: string
}

interface AudioState {
  isPlaying: boolean
  currentTime: number
  duration: number
  sequenceTitle: string
  formationTitle: string
  audioUrl: string
  accentColor: string
  sequenceId: string
  userId: string
  coverImageUrl: string
}

interface PlayAudioParams {
  audioUrl: string
  sequenceTitle: string
  formationTitle: string
  accentColor: string
  sequenceId: string
  userId: string
  duration?: number
  coverImageUrl?: string
  onComplete?: () => void
  onProgress?: (percent: number) => void
}

interface AudioContextValue {
  state: AudioState
  playAudio: (params: PlayAudioParams) => void
  pauseAudio: () => void
  resumeAudio: () => void
  seekTo: (seconds: number) => void
  closePlayer: () => void
}

const defaultState: AudioState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  sequenceTitle: '',
  formationTitle: '',
  audioUrl: '',
  accentColor: '#2D1B96',
  sequenceId: '',
  userId: '',
  coverImageUrl: '',
}

const AudioContext = createContext<AudioContextValue | null>(null)

// ============================================
// PROVIDER
// ============================================

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<AudioState>(defaultState)

  // DPC tracking refs (survive across navigations)
  const startedAtRef = useRef<string | null>(null)
  const pauseCountRef = useRef(0)
  const playbackEventsRef = useRef<PlaybackEvent[]>([])
  const realListenSecondsRef = useRef(0)
  const lastTickRef = useRef(0)
  const maxReachedTimeRef = useRef(0)
  const logIdRef = useRef<string | null>(null)
  const isCompletedRef = useRef(false)

  // Callbacks stored as refs so they persist across renders
  const onCompleteRef = useRef<(() => void) | undefined>()
  const onProgressRef = useRef<((percent: number) => void) | undefined>()

  // Real listening time tracker
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    if (state.isPlaying) {
      lastTickRef.current = Date.now()
      interval = setInterval(() => {
        const now = Date.now()
        const delta = (now - lastTickRef.current) / 1000
        lastTickRef.current = now
        realListenSecondsRef.current += delta
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [state.isPlaying])

  // Ensure audio element exists
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'metadata'

      audioRef.current.addEventListener('timeupdate', () => {
        const audio = audioRef.current
        if (!audio) return
        const time = audio.currentTime
        const dur = audio.duration && isFinite(audio.duration) ? audio.duration : 0

        // DPC: prevent skipping forward
        if (time <= maxReachedTimeRef.current + 2) {
          maxReachedTimeRef.current = Math.max(maxReachedTimeRef.current, time)
        } else {
          audio.currentTime = maxReachedTimeRef.current
          return
        }

        const percent = dur > 0 ? Math.floor((Math.max(maxReachedTimeRef.current, time) / dur) * 100) : 0
        onProgressRef.current?.(Math.min(percent, 100))

        setState(prev => ({ ...prev, currentTime: time, duration: dur || prev.duration }))
      })

      audioRef.current.addEventListener('loadedmetadata', () => {
        const audio = audioRef.current
        if (audio && audio.duration && isFinite(audio.duration)) {
          setState(prev => ({ ...prev, duration: audio.duration }))
        }
      })

      audioRef.current.addEventListener('ended', () => {
        handleAudioEnded()
      })
    }
    return audioRef.current
  }, [])

  // ─── DPC Log: INSERT on play start ───
  const insertWatchLog = useCallback(async (sequenceId: string, userId: string) => {
    try {
      const supabase = createClient()
      const now = new Date().toISOString()
      startedAtRef.current = now

      // Resolve userId from auth if not provided
      let resolvedUserId = userId
      if (!resolvedUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        resolvedUserId = user.id
        setState(prev => ({ ...prev, userId: resolvedUserId }))
      }

      const { data } = await supabase.from('course_watch_logs').insert({
        user_id: resolvedUserId,
        sequence_id: sequenceId,
        started_at: now,
        ended_at: null,
        total_duration_seconds: 0,
        watched_percent: 0,
        pause_count: 0,
        playback_events: [{ time: 0, action: 'play' as const, timestamp: now }],
        completed: false,
      }).select('id').single()

      if (data) {
        logIdRef.current = data.id
      }
    } catch (err) {
      console.error('Erreur insertion log DPC:', err)
    }
  }, [])

  // ─── DPC Log: UPDATE on pause ───
  const updateWatchLogOnPause = useCallback(async () => {
    if (!logIdRef.current) return
    try {
      const supabase = createClient()
      const dur = audioRef.current?.duration || 0
      const watchedPercent = dur > 0 ? Math.floor((maxReachedTimeRef.current / dur) * 100) : 0

      await supabase.from('course_watch_logs').update({
        ended_at: new Date().toISOString(),
        total_duration_seconds: Math.round(realListenSecondsRef.current),
        watched_percent: Math.min(watchedPercent, 100),
        pause_count: pauseCountRef.current,
        playback_events: playbackEventsRef.current,
      }).eq('id', logIdRef.current)
    } catch (err) {
      console.error('Erreur update log DPC (pause):', err)
    }
  }, [])

  // ─── DPC Log: UPDATE on ended ───
  const handleAudioEnded = useCallback(async () => {
    if (isCompletedRef.current) return
    isCompletedRef.current = true

    setState(prev => ({ ...prev, isPlaying: false }))

    const endedAt = new Date().toISOString()
    playbackEventsRef.current.push({
      time: audioRef.current?.duration || 0,
      action: 'complete',
      timestamp: endedAt,
    })

    const dur = audioRef.current?.duration || 0
    const listenedRatio = dur > 0 ? realListenSecondsRef.current / dur : 0
    const completed = listenedRatio >= 0.8

    onProgressRef.current?.(100)

    try {
      const supabase = createClient()
      if (logIdRef.current) {
        await supabase.from('course_watch_logs').update({
          ended_at: endedAt,
          total_duration_seconds: Math.round(realListenSecondsRef.current),
          watched_percent: 100,
          pause_count: pauseCountRef.current,
          playback_events: playbackEventsRef.current,
          completed,
        }).eq('id', logIdRef.current)
      } else {
        // Fallback: insert if no log yet
        await supabase.from('course_watch_logs').insert({
          user_id: state.userId,
          sequence_id: state.sequenceId,
          started_at: startedAtRef.current || endedAt,
          ended_at: endedAt,
          total_duration_seconds: Math.round(realListenSecondsRef.current),
          watched_percent: 100,
          pause_count: pauseCountRef.current,
          playback_events: playbackEventsRef.current,
          completed,
        })
      }
    } catch (err) {
      console.error('Erreur log DPC (ended):', err)
    }

    onCompleteRef.current?.()
  }, [state.userId, state.sequenceId])

  // ─── playAudio ───
  const playAudio = useCallback((params: PlayAudioParams) => {
    const audio = getAudio()

    // If switching to a different audio, reset tracking
    const isSameTrack = audio.src === params.audioUrl

    if (!isSameTrack) {
      // Save current log before switching if playing
      if (state.audioUrl && logIdRef.current) {
        updateWatchLogOnPause()
      }

      // Reset DPC tracking
      startedAtRef.current = null
      pauseCountRef.current = 0
      playbackEventsRef.current = []
      realListenSecondsRef.current = 0
      maxReachedTimeRef.current = 0
      logIdRef.current = null
      isCompletedRef.current = false

      audio.src = params.audioUrl
      audio.currentTime = 0
    }

    onCompleteRef.current = params.onComplete
    onProgressRef.current = params.onProgress

    setState({
      isPlaying: true,
      currentTime: isSameTrack ? audio.currentTime : 0,
      duration: params.duration || 0,
      sequenceTitle: params.sequenceTitle,
      formationTitle: params.formationTitle,
      audioUrl: params.audioUrl,
      accentColor: params.accentColor,
      sequenceId: params.sequenceId,
      userId: params.userId,
      coverImageUrl: params.coverImageUrl || '',
    })

    // Start playback
    const now = new Date().toISOString()
    playbackEventsRef.current.push({ time: audio.currentTime, action: 'play', timestamp: now })

    if (!startedAtRef.current) {
      insertWatchLog(params.sequenceId, params.userId)
    }

    audio.play().catch(() => {})
  }, [getAudio, state.audioUrl, insertWatchLog, updateWatchLogOnPause])

  // ─── pauseAudio ───
  const pauseAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.pause()
    pauseCountRef.current += 1
    playbackEventsRef.current.push({
      time: audio.currentTime,
      action: 'pause',
      timestamp: new Date().toISOString(),
    })

    setState(prev => ({ ...prev, isPlaying: false }))
    updateWatchLogOnPause()
  }, [updateWatchLogOnPause])

  // ─── resumeAudio ───
  const resumeAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !state.audioUrl) return

    playbackEventsRef.current.push({
      time: audio.currentTime,
      action: 'play',
      timestamp: new Date().toISOString(),
    })

    audio.play().catch(() => {})
    setState(prev => ({ ...prev, isPlaying: true }))
  }, [state.audioUrl])

  // ─── seekTo ───
  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return

    // DPC: can only seek backward or to maxReachedTime
    const clampedTime = Math.min(seconds, maxReachedTimeRef.current)
    audio.currentTime = Math.max(0, clampedTime)
    setState(prev => ({ ...prev, currentTime: Math.max(0, clampedTime) }))
  }, [])

  // ─── closePlayer ───
  const closePlayer = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }

    // Save final log
    if (logIdRef.current) {
      updateWatchLogOnPause()
    }

    // Reset all tracking
    startedAtRef.current = null
    pauseCountRef.current = 0
    playbackEventsRef.current = []
    realListenSecondsRef.current = 0
    maxReachedTimeRef.current = 0
    logIdRef.current = null
    isCompletedRef.current = false
    onCompleteRef.current = undefined
    onProgressRef.current = undefined

    setState(defaultState)
  }, [updateWatchLogOnPause])

  return (
    <AudioContext.Provider value={{ state, playAudio, pauseAudio, resumeAudio, seekTo, closePlayer }}>
      {children}
    </AudioContext.Provider>
  )
}

// ============================================
// HOOK
// ============================================

export function useAudio() {
  const ctx = useContext(AudioContext)
  if (!ctx) throw new Error('useAudio must be used within AudioProvider')
  return ctx
}
