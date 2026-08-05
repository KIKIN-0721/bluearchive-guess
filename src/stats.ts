import type { ModeKey } from './game';

const STORAGE_KEY = 'b1more-device-stats-v1';

export interface DeviceStats {
  games: number;
  wins: number;
  losses: number;
  reveals: number;
  currentStreak: number;
  bestStreak: number;
  totalWinningGuesses: number;
  bestGuess: number | null;
  byMode: Record<ModeKey, { games: number; wins: number; losses: number }>;
}

export interface Settlement {
  mode: ModeKey;
  status: 'won' | 'lost';
  guessCount: number;
  revealed?: boolean;
}

export function emptyStats(): DeviceStats {
  return {
    games: 0,
    wins: 0,
    losses: 0,
    reveals: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalWinningGuesses: 0,
    bestGuess: null,
    byMode: {
      cn: { games: 0, wins: 0, losses: 0 },
      global: { games: 0, wins: 0, losses: 0 },
      jp: { games: 0, wins: 0, losses: 0 },
    },
  };
}

function hydrate(value: Partial<DeviceStats> | null): DeviceStats {
  const base = emptyStats();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    byMode: {
      cn: { ...base.byMode.cn, ...value.byMode?.cn },
      global: { ...base.byMode.global, ...value.byMode?.global },
      jp: { ...base.byMode.jp, ...value.byMode?.jp },
    },
  };
}

export function loadStats(): DeviceStats {
  try {
    return hydrate(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<DeviceStats> | null);
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: DeviceStats): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function settleStats(current: DeviceStats, settlement: Settlement): DeviceStats {
  const won = settlement.status === 'won';
  const modeStats = current.byMode[settlement.mode];
  const next: DeviceStats = {
    ...current,
    games: current.games + 1,
    wins: current.wins + (won ? 1 : 0),
    losses: current.losses + (won ? 0 : 1),
    reveals: current.reveals + (settlement.revealed ? 1 : 0),
    currentStreak: won ? current.currentStreak + 1 : 0,
    bestStreak: current.bestStreak,
    totalWinningGuesses: current.totalWinningGuesses + (won ? settlement.guessCount : 0),
    bestGuess: won
      ? Math.min(current.bestGuess ?? settlement.guessCount, settlement.guessCount)
      : current.bestGuess,
    byMode: {
      ...current.byMode,
      [settlement.mode]: {
        games: modeStats.games + 1,
        wins: modeStats.wins + (won ? 1 : 0),
        losses: modeStats.losses + (won ? 0 : 1),
      },
    },
  };
  next.bestStreak = Math.max(next.bestStreak, next.currentStreak);
  return next;
}

export function resetStats(): DeviceStats {
  const next = emptyStats();
  saveStats(next);
  return next;
}
