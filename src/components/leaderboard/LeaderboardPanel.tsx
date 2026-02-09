'use client';

import { useEffect } from 'react';
import { Trophy, Loader2, RefreshCw } from 'lucide-react';
import { useWeeklyLeaderboard, type LeaderboardEntry } from '@/lib/hooks/useWeeklyLeaderboard';
import { getAnonymousName, getAnonymousAvatar, getAnonymousEmoji } from '@/lib/utils/anonymousNames';

interface LeaderboardPanelProps {
  userId?: string;
  onViewHistory?: () => void;
  compact?: boolean;
  refreshTrigger?: number;
}

const getRankEmoji = (rank: number): string => {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '';
  }
};

export default function LeaderboardPanel({ userId, onViewHistory, compact = false, refreshTrigger }: LeaderboardPanelProps) {
  const { leaderboard, userRank, loading, error, refetch } = useWeeklyLeaderboard(userId);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  // ─── Loading ───
  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 rounded-[20px] shadow-lg ${compact ? 'p-4' : 'p-6'} text-white h-full flex flex-col`}>
        <div className={`flex items-center justify-center flex-1 ${compact ? 'min-h-[100px]' : 'min-h-[200px]'}`}>
          <Loader2 className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-white animate-spin`} />
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className={`bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 rounded-[20px] shadow-lg ${compact ? 'p-4' : 'p-6'} text-white h-full flex flex-col`}>
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <Trophy className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} text-white/60`} />
          <p className="text-xs text-white/80">{error}</p>
          <button
            onClick={refetch}
            className="flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ─── Empty state ───
  if (leaderboard.length === 0) {
    return (
      <div className={`bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 rounded-[20px] shadow-lg ${compact ? 'p-4' : 'p-6'} text-white h-full flex flex-col`}>
        <div className="flex flex-col items-center">
          <div className="p-2.5 md:p-3 bg-white/20 rounded-xl">
            <Trophy className="w-7 h-7 md:w-8 md:h-8 text-white" />
          </div>
          <p className="text-xs md:text-sm font-medium text-white/90 mt-2 md:mt-3">Classement hebdo</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center mt-2 text-center px-2">
          <span className="text-2xl mb-2">🏆</span>
          <p className="text-xs text-white/90 font-medium leading-relaxed">
            Soyez le premier à jouer au Quiz du jour !
          </p>
        </div>
      </div>
    );
  }

  // ─── Compact mode (home page stats card) ───
  if (compact) {
    const top3 = leaderboard.filter(e => e.rank <= 3);
    const currentUser = userRank;
    const isUserInTop3 = currentUser ? currentUser.rank <= 3 : false;

    return (
      <div className="bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 rounded-[20px] shadow-lg p-4 md:p-5 text-white h-full flex flex-col">
        <style jsx>{`
          @keyframes bounce-slow {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes trophy-glow {
            0%, 100% { filter: drop-shadow(0 0 2px rgba(255,255,255,0.5)); }
            50% { filter: drop-shadow(0 0 8px rgba(255,255,255,0.8)); }
          }
          .animate-bounce-slow {
            animation: bounce-slow 1.5s ease-in-out infinite;
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
          {/* Top entries (up to 3) */}
          {top3.map((entry) => {
            const isCurrent = entry.is_current_user;
            const displayName = isCurrent ? 'Toi' : getAnonymousName(entry.user_id);
            const emoji = getAnonymousEmoji(entry.user_id);
            return (
              <div
                key={entry.user_id}
                className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg ${isCurrent ? 'bg-white/30' : 'bg-white/10'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base animate-bounce-slow flex-shrink-0">{getRankEmoji(entry.rank)}</span>
                  {isCurrent && entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt=""
                      className="w-5 h-5 rounded-full flex-shrink-0 object-cover"
                    />
                  ) : !isCurrent ? (
                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-sm">
                      {emoji}
                    </span>
                  ) : null}
                  <span className={`text-xs truncate ${isCurrent ? 'font-bold text-white' : 'font-medium text-white/90'}`}>
                    {displayName}
                  </span>
                </div>
                <span className={`text-xs font-bold flex-shrink-0 ml-2 ${isCurrent ? 'text-white' : 'text-white/80'}`}>
                  {entry.weekly_points} pts
                </span>
              </div>
            );
          })}

          {/* Current user if not in top 3 */}
          {currentUser && !isUserInTop3 && (
            <>
              <div className="flex items-center justify-center py-0.5">
                <span className="text-white/40 text-[10px]">···</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 flex items-center justify-center bg-white text-teal-600 text-[10px] font-bold rounded-full flex-shrink-0">
                    {currentUser.rank}
                  </span>
                  {currentUser.avatar_url && (
                    <img
                      src={currentUser.avatar_url}
                      alt=""
                      className="w-5 h-5 rounded-full flex-shrink-0 object-cover"
                    />
                  )}
                  <span className="text-xs font-bold text-white truncate">Toi</span>
                </div>
                <span className="text-xs font-bold text-white flex-shrink-0 ml-2">
                  {currentUser.weekly_points} pts
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Full mode ───
  const currentUser = userRank;
  const isUserInTop10 = currentUser ? currentUser.rank <= 10 : false;

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
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-indigo-600 to-purple-600 p-4 text-white">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          <h2 className="text-base font-bold">Classement Hebdo</h2>
        </div>
      </div>

      {/* Podium (top 3) */}
      {leaderboard.some(e => e.rank <= 3) && (
        <div className="px-4 py-5 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-end justify-center gap-4">
            {/* 2nd place */}
            {(() => {
              const second = leaderboard.find(e => e.rank === 2);
              return second ? (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-xl shadow-lg medal-shine medal-float">
                    🥈
                  </div>
                  <p className="text-xs font-medium text-gray-600 mt-1.5 truncate max-w-[70px] text-center">
                    {second.is_current_user ? 'Toi' : getAnonymousName(second.user_id)}
                  </p>
                  <p className="text-sm font-bold text-gray-700">{second.weekly_points}</p>
                  <p className="text-[10px] text-gray-400">pts</p>
                </div>
              ) : <div className="w-12" />;
            })()}

            {/* 1st place */}
            {(() => {
              const first = leaderboard.find(e => e.rank === 1);
              return first ? (
                <div className="flex flex-col items-center -mt-4">
                  <div className="crown-bounce text-2xl mb-1">👑</div>
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-3xl shadow-xl ring-4 ring-yellow-300/50 medal-shine medal-float">
                    🥇
                  </div>
                  <p className="text-xs font-medium text-gray-600 mt-1.5 truncate max-w-[80px] text-center">
                    {first.is_current_user ? 'Toi' : getAnonymousName(first.user_id)}
                  </p>
                  <p className="text-lg font-bold text-gray-800">{first.weekly_points}</p>
                  <p className="text-[10px] text-gray-400">pts</p>
                </div>
              ) : null;
            })()}

            {/* 3rd place */}
            {(() => {
              const third = leaderboard.find(e => e.rank === 3);
              return third ? (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center text-xl shadow-lg medal-shine medal-float">
                    🥉
                  </div>
                  <p className="text-xs font-medium text-gray-600 mt-1.5 truncate max-w-[70px] text-center">
                    {third.is_current_user ? 'Toi' : getAnonymousName(third.user_id)}
                  </p>
                  <p className="text-sm font-bold text-gray-700">{third.weekly_points}</p>
                  <p className="text-[10px] text-gray-400">pts</p>
                </div>
              ) : <div className="w-12" />;
            })()}
          </div>
        </div>
      )}

      {/* User position card */}
      {currentUser && (
        <div className="px-4 py-3">
          <div className={`
            relative rounded-xl p-4
            ${currentUser.rank <= 3
              ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 shadow-amber-100 shadow-md'
              : currentUser.rank <= 10
                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-indigo-100 shadow-md'
                : 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200'
            }
          `}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg
                  ${currentUser.rank <= 3
                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white medal-shine'
                    : 'bg-gradient-to-br from-primary to-indigo-600 text-white'
                  }
                `}>
                  {currentUser.rank <= 3
                    ? <span className="text-xl">{getRankEmoji(currentUser.rank)}</span>
                    : `#${currentUser.rank}`
                  }
                </div>
                <div>
                  <p className="font-bold text-gray-800">Ta position</p>
                  <p className="text-xs text-gray-500">{currentUser.weekly_points} pts cette semaine</p>
                </div>
              </div>
              <div className="text-right bg-white/50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Rang</p>
                <p className="text-xl font-bold text-gray-700">
                  {currentUser.rank}<span className="text-xs font-normal text-gray-400">e</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rest of leaderboard (ranks 4-10) */}
      {leaderboard.filter(e => e.rank > 3).length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 mb-2 font-medium">Classement</p>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            {leaderboard.filter(e => e.rank > 3).map((entry) => {
              const isCurrent = entry.is_current_user;
              const displayName = isCurrent ? 'Toi' : getAnonymousName(entry.user_id);
              const emoji = getAnonymousEmoji(entry.user_id);
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-b-0 transition-colors ${
                    isCurrent ? 'bg-indigo-50' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-gray-200 text-gray-600">
                      {entry.rank}
                    </span>
                    {isCurrent && entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : !isCurrent ? (
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${getAnonymousAvatar(entry.user_id)} text-white`}>
                        {emoji}
                      </span>
                    ) : null}
                    <span className={`text-sm ${isCurrent ? 'font-bold text-indigo-700' : 'text-gray-700'}`}>
                      {displayName}
                    </span>
                  </div>
                  <span className={`text-sm font-semibold ${isCurrent ? 'text-indigo-600' : 'text-gray-600'}`}>
                    {entry.weekly_points} pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User rank outside top 10 */}
      {currentUser && !isUserInTop10 && (
        <div className="px-4 pb-3">
          <div className="text-center text-xs text-gray-400 py-1">···</div>
          <div className="bg-indigo-50 rounded-lg px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-indigo-200 text-indigo-700">
                {currentUser.rank}
              </span>
              <span className="text-sm font-bold text-indigo-700">Toi</span>
            </div>
            <span className="text-sm font-semibold text-indigo-600">{currentUser.weekly_points} pts</span>
          </div>
        </div>
      )}

      {onViewHistory && (
        <button
          onClick={onViewHistory}
          className="w-full flex items-center justify-center gap-1 py-3 text-sm font-medium text-primary hover:bg-gray-50 border-t border-gray-100 transition-colors"
        >
          Voir l&apos;historique
        </button>
      )}
    </div>
  );
}
