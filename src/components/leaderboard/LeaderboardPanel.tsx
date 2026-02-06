'use client';

import { useState, useEffect } from 'react';
import { Trophy, Clock, ChevronRight, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { getAnonymousUsername } from '@/lib/gamification/leaderboard/leaderboardUtils';

interface LeaderboardEntry {
  user_id: string;
  first_name: string | null;
  points_earned: number;
  rank: number;
  is_user?: boolean;
}

interface Podium {
  first: number | null;
  second: number | null;
  third: number | null;
}

interface UserPosition {
  rank: number;
  points: number;
  evolution: string | null;
  neighbors: LeaderboardEntry[];
  is_new: boolean;
}

interface NextMilestone {
  rank: number;
  points_needed: number;
}

interface RankedParticipant {
  user_id: string;
  name: string;
  points: number;
  rank: number;
}

interface LeaderboardData {
  week_start: string;
  week_end: string;
  time_remaining: string;
  total_participants: number;
  podium: Podium;
  first_place: RankedParticipant | null;
  last_place: RankedParticipant | null;
  user_position: UserPosition;
  next_milestones: {
    next_position: NextMilestone | null;
    top_10: NextMilestone | null;
  };
}

interface LeaderboardPanelProps {
  onViewHistory?: () => void;
  compact?: boolean;
}

export default function LeaderboardPanel({ onViewHistory, compact = false }: LeaderboardPanelProps) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (data) {
      setTimeout(() => setIsVisible(true), 100);
    }
  }, [data]);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard/current');
      if (!response.ok) throw new Error('Erreur de chargement');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Impossible de charger le classement');
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateRange = (weekStart: string, weekEnd: string): string => {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    const months = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
                    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    return `${start.getDate()} - ${end.getDate()} ${months[end.getMonth()]}`;
  };

  const getEvolutionDisplay = (evolution: string | null) => {
    if (!evolution || evolution === 'NEW') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 animate-pulse">
          NEW
        </span>
      );
    }
    if (evolution === '=') {
      return null;
    }
    if (evolution.startsWith('+')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <ArrowUp className="w-3 h-3 animate-bounce" />
          {evolution}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <ArrowDown className="w-3 h-3 animate-bounce" />
        {evolution}
      </span>
    );
  };

  const getRankBadge = (rank: number): { emoji: string; bg: string } => {
    switch (rank) {
      case 1: return { emoji: '🥇', bg: 'bg-gradient-to-br from-yellow-400 to-amber-500' };
      case 2: return { emoji: '🥈', bg: 'bg-gradient-to-br from-gray-300 to-gray-400' };
      case 3: return { emoji: '🥉', bg: 'bg-gradient-to-br from-orange-400 to-amber-600' };
      default: return { emoji: '', bg: 'bg-gray-100' };
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg ${compact ? 'p-4' : 'p-6'}`}>
        <div className={`flex items-center justify-center ${compact ? 'h-24' : 'h-48'}`}>
          <Loader2 className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-primary animate-spin`} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg ${compact ? 'p-4' : 'p-6'}`}>
        <div className={`flex flex-col items-center justify-center ${compact ? 'h-24' : 'h-48'} text-gray-500`}>
          <Trophy className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} text-gray-300 ${compact ? 'mb-2' : 'mb-3'}`} />
          <p className="text-sm">{error || 'Pas de données disponibles'}</p>
          <button
            onClick={fetchLeaderboard}
            className="mt-2 text-primary text-xs font-medium hover:underline"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const otherNeighbors = data.user_position.neighbors.filter(n => !n.is_user);

  // Compact mode for dashboard integration
  if (compact) {
    const isUserFirst = data.first_place?.user_id === data.user_position.neighbors.find(n => n.is_user)?.user_id;
    const isUserLast = data.last_place?.user_id === data.user_position.neighbors.find(n => n.is_user)?.user_id;
    const secondPlaceUser = data.user_position.neighbors.find(n => !n.is_user && n.rank === 2);

    return (
      <div className="bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 rounded-[20px] shadow-lg p-4 md:p-5 text-white h-full flex flex-col">
        <style jsx>{`
          @keyframes bounce-slow {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes wiggle {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-8deg); }
            75% { transform: rotate(8deg); }
          }
          @keyframes trophy-glow {
            0%, 100% { filter: drop-shadow(0 0 2px rgba(255,255,255,0.5)); }
            50% { filter: drop-shadow(0 0 8px rgba(255,255,255,0.8)); }
          }
          .animate-bounce-slow {
            animation: bounce-slow 1.5s ease-in-out infinite;
          }
          .animate-wiggle {
            animation: wiggle 0.8s ease-in-out infinite;
          }
          .animate-trophy-glow {
            animation: trophy-glow 2s ease-in-out infinite;
          }
        `}</style>

        <div className="flex flex-col items-center">
          <div className="p-2.5 md:p-3 bg-white/20 rounded-xl">
            <Trophy className="w-7 h-7 md:w-8 md:h-8 text-white animate-trophy-glow" />
          </div>
          <p className="text-xs md:text-sm font-medium text-white/90 mt-2 md:mt-3">Classement hebdo</p>
        </div>

        <div className="flex-1 flex flex-col justify-center mt-2 space-y-1">
          {data.first_place && (
            <div className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg ${isUserFirst ? 'bg-white/30' : 'bg-white/10'}`}>
              <div className="flex items-center gap-2">
                <span className="text-base animate-bounce-slow">🥇</span>
                <span className={`text-xs font-medium ${isUserFirst ? 'text-white font-bold' : 'text-white/90'}`}>
                  {isUserFirst ? 'Toi' : getAnonymousUsername(data.first_place.user_id)}
                </span>
              </div>
              <span className={`text-xs font-bold ${isUserFirst ? 'text-white' : 'text-white/80'}`}>
                {data.first_place.points} pts
              </span>
            </div>
          )}

          {!isUserFirst && !isUserLast && (
            <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/30">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center bg-white text-teal-600 text-[10px] font-bold rounded-full">
                  {data.user_position.rank}
                </span>
                <span className="text-xs font-bold text-white">Toi</span>
                {getEvolutionDisplay(data.user_position.evolution)}
              </div>
              <span className="text-xs font-bold text-white">
                {data.user_position.points} pts
              </span>
            </div>
          )}
          {isUserFirst && secondPlaceUser && (
            <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/10">
              <div className="flex items-center gap-2">
                <span className="text-base">🥈</span>
                <span className="text-xs font-medium text-white/90">
                  {getAnonymousUsername(secondPlaceUser.user_id)}
                </span>
              </div>
              <span className="text-xs font-bold text-white/80">
                {secondPlaceUser.points_earned} pts
              </span>
            </div>
          )}

          {data.last_place && data.total_participants > 1 && (
            <div className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg ${isUserLast ? 'bg-white/30' : 'bg-white/10'}`}>
              <div className="flex items-center gap-2">
                <span className="text-base animate-wiggle">🎓</span>
                <span className={`text-xs font-medium ${isUserLast ? 'text-white font-bold' : 'text-white/70'}`}>
                  {isUserLast ? 'Toi' : getAnonymousUsername(data.last_place.user_id)}
                </span>
              </div>
              <span className={`text-xs font-bold ${isUserLast ? 'text-white' : 'text-white/60'}`}>
                {data.last_place.points} pts
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <style jsx>{`
        @keyframes shine {
          0% { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes crownBounce {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-4px) rotate(5deg); }
        }
        .medal-shine {
          position: relative;
          overflow: hidden;
        }
        .medal-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.4) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: shine 2s ease-in-out infinite;
        }
        .medal-float {
          animation: float 2s ease-in-out infinite;
        }
        .crown-bounce {
          animation: crownBounce 1.5s ease-in-out infinite;
        }
        .podium-bounce {
          animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
          opacity: 0;
          transform: scale(0.3);
        }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        .podium-1 { animation-delay: 0.2s; }
        .podium-2 { animation-delay: 0.4s; }
        .podium-3 { animation-delay: 0.6s; }
      `}</style>

      <div className="bg-gradient-to-r from-primary via-indigo-600 to-purple-600 p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            <h2 className="text-base font-bold">Classement Hebdo</h2>
          </div>
          <span className="text-xs text-white/80">
            {formatDateRange(data.week_start, data.week_end)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/90">
          <Clock className="w-3.5 h-3.5" />
          <span>Reset dans {data.time_remaining}</span>
        </div>
      </div>

      <div className="px-4 py-5 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
        <div className="flex items-end justify-center gap-4">
          <div className={`flex flex-col items-center ${isVisible ? 'podium-bounce podium-2' : 'opacity-0'}`}>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-xl shadow-lg medal-shine medal-float">
              🥈
            </div>
            <p className="text-sm font-bold text-gray-700 mt-2">{data.podium.second || '-'}</p>
            <p className="text-[10px] text-gray-400">pts</p>
          </div>

          <div className={`flex flex-col items-center -mt-4 ${isVisible ? 'podium-bounce podium-1' : 'opacity-0'}`}>
            <div className="crown-bounce text-2xl mb-1">👑</div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-3xl shadow-xl ring-4 ring-yellow-300/50 medal-shine medal-float">
              🥇
            </div>
            <p className="text-lg font-bold text-gray-800 mt-2">{data.podium.first || '-'}</p>
            <p className="text-[10px] text-gray-400">pts</p>
          </div>

          <div className={`flex flex-col items-center ${isVisible ? 'podium-bounce podium-3' : 'opacity-0'}`}>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center text-xl shadow-lg medal-shine medal-float">
              🥉
            </div>
            <p className="text-sm font-bold text-gray-700 mt-2">{data.podium.third || '-'}</p>
            <p className="text-[10px] text-gray-400">pts</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className={`
          relative rounded-xl p-4
          ${data.user_position.rank <= 3
            ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 shadow-amber-100 shadow-md'
            : data.user_position.rank <= 10
              ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-indigo-100 shadow-md'
              : 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200'
          }
        `}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`
                w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-lg
                ${data.user_position.rank <= 3
                  ? getRankBadge(data.user_position.rank).bg + ' text-white medal-shine'
                  : 'bg-gradient-to-br from-primary to-indigo-600 text-white'
                }
              `}>
                {data.user_position.rank <= 3
                  ? <span className="text-2xl">{getRankBadge(data.user_position.rank).emoji}</span>
                  : `#${data.user_position.rank}`
                }
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-800 text-lg">Ta position</p>
                  {getEvolutionDisplay(data.user_position.evolution)}
                </div>
              </div>
            </div>

            <div className="text-right bg-white/50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Rang</p>
              <p className="text-xl font-bold text-gray-700">
                {data.user_position.rank}<span className="text-sm font-normal text-gray-400">/{data.total_participants}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {otherNeighbors.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 mb-2 font-medium">Autour de vous</p>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            {otherNeighbors.map((neighbor) => (
              <div
                key={neighbor.user_id}
                className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium
                    ${neighbor.rank <= 3 ? getRankBadge(neighbor.rank).bg + ' text-white' : 'bg-gray-200 text-gray-600'}
                  `}>
                    {neighbor.rank <= 3 ? getRankBadge(neighbor.rank).emoji : neighbor.rank}
                  </span>
                  <span className="text-sm text-gray-700">
                    {getAnonymousUsername(neighbor.user_id)}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-600">
                  {neighbor.points_earned} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.next_milestones.next_position || data.next_milestones.top_10) && (
        <div className="px-4 pb-4">
          <div className="space-y-2">
            {data.next_milestones.next_position && data.user_position.rank > 1 && (
              <div className="flex items-center justify-between text-xs bg-blue-50 rounded-lg px-3 py-2">
                <span className="text-blue-700">
                  Pour passer #{data.next_milestones.next_position.rank}
                </span>
                <span className="font-semibold text-blue-800">
                  +{data.next_milestones.next_position.points_needed} pts
                </span>
              </div>
            )}

            {data.next_milestones.top_10 && data.user_position.rank > 10 && (
              <div className="flex items-center justify-between text-xs bg-amber-50 rounded-lg px-3 py-2">
                <span className="text-amber-700">
                  Pour le Top 10
                </span>
                <span className="font-semibold text-amber-800">
                  +{data.next_milestones.top_10.points_needed} pts
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {onViewHistory && (
        <button
          onClick={onViewHistory}
          className="w-full flex items-center justify-center gap-1 py-3 text-sm font-medium text-primary hover:bg-gray-50 border-t border-gray-100 transition-colors"
        >
          Voir l&apos;historique
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
