'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ============================================
// TYPES
// ============================================

interface AudioPlayerProps {
  src: string
  duration: number // en secondes (depuis course_duration_seconds)
  sequenceId: string
  onComplete: () => void // appelé quand 100% écouté
  onProgress: (percent: number) => void // pour logs DPC
  accentColor?: string // couleur principale (défaut #2D1B96)
  accentColorSecondary?: string // couleur secondaire (défaut #00D1C1)
}

interface PlaybackEvent {
  time: number
  action: 'play' | 'pause' | 'complete'
  timestamp: string
}

const PLAYBACK_SPEEDS = [1, 1.25, 1.5]

// ============================================
// HELPERS
// ============================================

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ============================================
// COMPOSANT AUDIOPLAYER
// ============================================

export default function AudioPlayer({
  src,
  duration,
  sequenceId,
  onComplete,
  onProgress,
  accentColor = '#2D1B96',
  accentColorSecondary = '#00D1C1',
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(duration || 0)
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)

  // DPC tracking state
  const [maxReachedTime, setMaxReachedTime] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [pauseCount, setPauseCount] = useState(0)
  const [playbackEvents, setPlaybackEvents] = useState<PlaybackEvent[]>([])
  const [realListenSeconds, setRealListenSeconds] = useState(0)
  const lastTickRef = useRef<number>(0)

  const watchedPercent = audioDuration > 0 ? Math.floor((maxReachedTime / audioDuration) * 100) : 0

  // ─── Suivi du temps réel d'écoute ───
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    if (isPlaying) {
      lastTickRef.current = Date.now()
      interval = setInterval(() => {
        const now = Date.now()
        const delta = (now - lastTickRef.current) / 1000
        lastTickRef.current = now
        setRealListenSeconds(prev => prev + delta)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isPlaying])

  // ─── Synchronisation du temps de lecture ───
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    const time = audio.currentTime
    setCurrentTime(time)

    // DPC compliance: on ne peut pas skipper en avant
    // Seul le temps continu max est enregistré
    if (time <= maxReachedTime + 2) {
      // Tolérance de 2s pour éviter les faux positifs (buffering)
      setMaxReachedTime(prev => Math.max(prev, time))
    } else {
      // L'utilisateur a tenté de skip en avant → on revient au max
      audio.currentTime = maxReachedTime
      return
    }

    const percent = audioDuration > 0 ? Math.floor((Math.max(maxReachedTime, time) / audioDuration) * 100) : 0
    onProgress(Math.min(percent, 100))
  }, [audioDuration, maxReachedTime, onProgress])

  // ─── Quand l'audio est chargé ───
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.duration && isFinite(audio.duration)) {
      setAudioDuration(audio.duration)
    }
  }, [])

  // ─── Fin de lecture ───
  const handleEnded = useCallback(async () => {
    if (isCompleted) return

    setIsPlaying(false)
    setIsCompleted(true)
    setMaxReachedTime(audioDuration)
    onProgress(100)

    const endedAt = new Date().toISOString()
    const events: PlaybackEvent[] = [...playbackEvents, { time: audioDuration, action: 'complete', timestamp: endedAt }]
    setPlaybackEvents(events)

    // Log DPC dans course_watch_logs
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('course_watch_logs').insert({
          user_id: user.id,
          sequence_id: sequenceId,
          started_at: startedAt,
          ended_at: endedAt,
          total_duration_seconds: Math.round(realListenSeconds),
          watched_percent: 100,
          pause_count: pauseCount,
          playback_events: events,
          completed: true,
        })
      }
    } catch (err) {
      console.error('Erreur log DPC:', err)
    }

    onComplete()
  }, [isCompleted, audioDuration, playbackEvents, startedAt, realListenSeconds, pauseCount, sequenceId, onComplete, onProgress])

  // ─── Play / Pause ───
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      setPauseCount(prev => prev + 1)
      setPlaybackEvents(prev => [...prev, { time: audio.currentTime, action: 'pause', timestamp: new Date().toISOString() }])
    } else {
      if (!startedAt) {
        setStartedAt(new Date().toISOString())
      }
      setPlaybackEvents(prev => [...prev, { time: audio.currentTime, action: 'play', timestamp: new Date().toISOString() }])
      audio.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [isPlaying, startedAt])

  // ─── Vitesse de lecture ───
  const cycleSpeed = useCallback(() => {
    const currentIdx = PLAYBACK_SPEEDS.indexOf(speed)
    const nextIdx = (currentIdx + 1) % PLAYBACK_SPEEDS.length
    const newSpeed = PLAYBACK_SPEEDS[nextIdx]
    setSpeed(newSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed
    }
  }, [speed])

  // ─── Volume ───
  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isMuted) {
      audio.volume = volume
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    setIsMuted(val === 0)
    if (audioRef.current) {
      audioRef.current.volume = val
    }
  }, [])

  // ─── Clic sur la barre de progression ───
  // DPC compliance: ne peut aller qu'en arrière (ou jusqu'au maxReachedTime)
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current
    const audio = audioRef.current
    if (!bar || !audio || audioDuration === 0) return

    const rect = bar.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    const targetTime = percent * audioDuration

    // Ne peut pas aller au-delà du maxReachedTime
    const clampedTime = Math.min(targetTime, maxReachedTime)
    audio.currentTime = clampedTime
    setCurrentTime(clampedTime)
  }, [audioDuration, maxReachedTime])

  // Pourcentage de la barre de progression (basé sur le temps actuel)
  const progressPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0
  // Pourcentage écouté max (zone accessible)
  const reachablePercent = audioDuration > 0 ? (maxReachedTime / audioDuration) * 100 : 0

  return (
    <div className="w-full">
      {/* Audio element (caché) */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Container principal */}
      <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden">
        {/* Visuel audio */}
        <div
          className="relative px-6 py-8 flex flex-col items-center"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColorSecondary})` }}
        >
          {/* Icône */}
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
            <span className="text-4xl">🎧</span>
          </div>

          {/* Titre */}
          <p className="text-white/80 text-xs font-medium mb-1">COURS AUDIO</p>

          {/* Statut */}
          {isCompleted ? (
            <div className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
              <span className="text-white text-sm font-bold">✓ Terminé</span>
            </div>
          ) : (
            <div className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
              <span className="text-white text-sm font-semibold">{watchedPercent}% écouté</span>
            </div>
          )}
        </div>

        {/* Contrôles */}
        <div className="px-5 py-4">
          {/* Barre de progression */}
          <div
            ref={progressBarRef}
            onClick={handleProgressClick}
            className="relative h-2 bg-gray-200 rounded-full cursor-pointer mb-3 group"
          >
            {/* Zone accessible (maxReached) */}
            <div
              className="absolute top-0 left-0 h-full rounded-full opacity-30"
              style={{ width: `${reachablePercent}%`, background: accentColor }}
            />
            {/* Progression actuelle */}
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${progressPercent}%`,
                background: `linear-gradient(90deg, ${accentColor}, ${accentColorSecondary})`,
              }}
            />
            {/* Curseur */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-md border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                left: `calc(${progressPercent}% - 8px)`,
                background: accentColor,
              }}
            />
          </div>

          {/* Temps */}
          <div className="flex justify-between text-[11px] text-gray-400 font-medium mb-4">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(audioDuration)}</span>
          </div>

          {/* Boutons de contrôle */}
          <div className="flex items-center justify-between">
            {/* Volume */}
            <div className="relative flex items-center">
              <button
                onClick={toggleMute}
                onMouseEnter={() => setShowVolume(true)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={20} className="text-gray-400" />
                ) : (
                  <Volume2 size={20} className="text-gray-500" />
                )}
              </button>
              {showVolume && (
                <div
                  className="absolute left-10 top-1/2 -translate-y-1/2 bg-white rounded-xl shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-2 z-10"
                  onMouseLeave={() => setShowVolume(false)}
                >
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 accent-[#2D1B96]"
                  />
                </div>
              )}
            </div>

            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              disabled={isCompleted}
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColorSecondary})` }}
            >
              {isPlaying ? (
                <Pause size={24} className="text-white" fill="white" />
              ) : (
                <Play size={24} className="text-white ml-1" fill="white" />
              )}
            </button>

            {/* Vitesse */}
            <button
              onClick={cycleSpeed}
              className="px-3 py-1.5 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors"
              style={{ color: speed !== 1 ? accentColor : '#6B7280' }}
            >
              {speed}x
            </button>
          </div>

          {/* Message DPC */}
          {!isCompleted && watchedPercent > 0 && watchedPercent < 100 && (
            <p className="text-center text-[11px] text-gray-400 mt-3">
              Écoutez 100% du cours pour débloquer le quiz
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
