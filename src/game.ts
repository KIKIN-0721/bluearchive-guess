import dataset from './data/students.json';

export type ModeKey = 'cn' | 'global' | 'jp';
export type FeedbackLevel = 'correct' | 'close' | 'wrong';
export type BoardColumnKey = 'name' | 'school' | 'bulletType' | 'armorType' | 'characterAge' | 'tacticRole' | 'recruitType' | 'exCost';

// Student is the normalized shape generated from SchaleDB JSON and consumed by the game UI.
export interface Student {
  id: number;
  pathName: string;
  name: string;
  shortName: string;
  school: string;
  schoolLabel: string;
  bulletType: string;
  bulletTypeLabel: string;
  armorType: string;
  armorTypeLabel: string;
  characterAge: number | null;
  tacticRole: string;
  tacticRoleLabel: string;
  recruitTypes: string[];
  recruitTypeLabels: string[];
  exCost: number | null;
  isReleased: boolean[];
  iconUrl: string;
  portraitUrl: string;
}

export interface AttributeFeedback {
  value: string | number;
  level: FeedbackLevel;
  hint?: 'higher' | 'lower';
}

export interface GuessFeedback {
  student: Student;
  correct: boolean;
  attributes: {
    school: AttributeFeedback;
    bulletType: AttributeFeedback;
    armorType: AttributeFeedback;
    characterAge: AttributeFeedback;
    tacticRole: AttributeFeedback;
    recruitType: AttributeFeedback;
    exCost: AttributeFeedback;
  };
}

export const MAX_GUESSES = 8;

export const BOARD_COLUMNS: Array<{ key: BoardColumnKey; label: string }> = [
  { key: 'name', label: '姓名' },
  { key: 'school', label: '学院' },
  { key: 'bulletType', label: '攻击' },
  { key: 'armorType', label: '防御' },
  { key: 'characterAge', label: '年龄' },
  { key: 'tacticRole', label: '职责' },
  { key: 'recruitType', label: '招募' },
  { key: 'exCost', label: 'EX Cost' },
];

export const MODES: Array<{ key: ModeKey; label: string; description: string; releaseIndex: number }> = [
  { key: 'cn', label: '国服', description: '只包含国服已实装学生', releaseIndex: 2 },
  { key: 'global', label: '国际服', description: '包含国际服已实装学生', releaseIndex: 1 },
  { key: 'jp', label: '日服', description: '包含日服/全部最新学生池', releaseIndex: 0 },
];

export const students = (dataset.students as Student[]).filter((student) => student.exCost !== null);
export const metadata = {
  generatedAt: dataset.generatedAt as string,
  sources: dataset.sources as { students: string; localization: string },
  releasePools: dataset.releasePools as Record<ModeKey, number>,
};

// Each mode maps to one release flag in SchaleDB: JP/global/CN use different indices.
export function studentsForMode(mode: ModeKey): Student[] {
  const releaseIndex = MODES.find((item) => item.key === mode)?.releaseIndex ?? 0;
  return students.filter((student) => student.isReleased[releaseIndex]);
}

// Avoid immediately repeating the previous answer when starting a new round.
export function pickTarget(mode: ModeKey, previousId?: number | null): Student {
  const pool = studentsForMode(mode);
  const candidates = previousId && pool.length > 1
    ? pool.filter((student) => student.id !== previousId)
    : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function modeIndex(mode: ModeKey): number {
  return MODES.find((item) => item.key === mode)?.releaseIndex ?? 0;
}

function exact(value: string, target: string, label = value): AttributeFeedback {
  return { value: label, level: value === target ? 'correct' : 'wrong' };
}

// Numeric fields show arrows only when both sides are known numbers.
function numeric(value: number | null, target: number | null): AttributeFeedback {
  if (value === null || target === null) return { value: value ?? 'N/A', level: 'wrong' };
  if (value === target) return { value, level: 'correct' };
  return {
    value,
    level: 'close',
    hint: target > value ? 'higher' : 'lower',
  };
}

function estimateTextWidth(value: string | number | null): number {
  const text = String(value ?? 'N/A');
  return Array.from(text).reduce((total, char) => {
    if (/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/u.test(char)) return total + 2;
    if (/[A-Z]/u.test(char)) return total + 1.15;
    if (/[a-z0-9]/u.test(char)) return total + 0.95;
    return total + 0.7;
  }, 0);
}

function maxWidth(values: Array<string | number | null>, minWidth: number): number {
  return Math.max(minWidth, ...values.map(estimateTextWidth));
}

// Column weights approximate each column's theoretical widest content in the current mode.
// The UI converts these weights to percentages through CSS variables on the table element.
export function boardColumnWeights(mode: ModeKey): Record<BoardColumnKey, number> {
  const pool = studentsForMode(mode);
  const recruitIndex = modeIndex(mode);
  const values = {
    name: pool.flatMap((student) => [student.name, student.shortName]),
    school: pool.map((student) => student.schoolLabel),
    bulletType: pool.map((student) => student.bulletTypeLabel),
    armorType: pool.map((student) => student.armorTypeLabel),
    characterAge: pool.map((student) => student.characterAge ?? 'N/A'),
    tacticRole: pool.map((student) => student.tacticRoleLabel),
    recruitType: pool.map((student) => student.recruitTypeLabels[recruitIndex] ?? ''),
    exCost: pool.map((student) => student.exCost ?? 'N/A'),
  };
  return {
    name: maxWidth([BOARD_COLUMNS[0].label, ...values.name], 10) + 7,
    school: maxWidth([BOARD_COLUMNS[1].label, ...values.school], 8),
    bulletType: maxWidth([BOARD_COLUMNS[2].label, ...values.bulletType], 5),
    armorType: maxWidth([BOARD_COLUMNS[3].label, ...values.armorType], 6),
    characterAge: maxWidth([BOARD_COLUMNS[4].label, ...values.characterAge], 5),
    tacticRole: maxWidth([BOARD_COLUMNS[5].label, ...values.tacticRole], 5),
    recruitType: maxWidth([BOARD_COLUMNS[6].label, ...values.recruitType], 8),
    exCost: maxWidth([BOARD_COLUMNS[7].label, ...values.exCost], 6),
  };
}

export function compareGuess(guess: Student, target: Student, mode: ModeKey): GuessFeedback {
  const recruitIndex = modeIndex(mode);
  return {
    student: guess,
    correct: guess.id === target.id,
    attributes: {
      school: exact(guess.school, target.school, guess.schoolLabel),
      bulletType: exact(guess.bulletType, target.bulletType, guess.bulletTypeLabel),
      armorType: exact(guess.armorType, target.armorType, guess.armorTypeLabel),
      characterAge: numeric(guess.characterAge, target.characterAge),
      tacticRole: exact(guess.tacticRole, target.tacticRole, guess.tacticRoleLabel),
      recruitType: exact(
        guess.recruitTypes[recruitIndex] ?? '',
        target.recruitTypes[recruitIndex] ?? '',
        guess.recruitTypeLabels[recruitIndex] ?? ''
      ),
      exCost: numeric(guess.exCost, target.exCost),
    },
  };
}

// Search is intentionally forgiving: exact, prefix, then includes matches are ranked in that order.
export function searchStudents(pool: Student[], query: string, usedIds: Set<number>): Student[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return pool
    .filter((student) => !usedIds.has(student.id))
    .map((student) => {
      const names = `${student.name}\0${student.shortName}\0${student.pathName}`.toLocaleLowerCase();
      const exactScore = names.split('\0').includes(normalized) ? 0 : Number.POSITIVE_INFINITY;
      const prefixScore = names.split('\0').some((name) => name.startsWith(normalized)) ? 1 : Number.POSITIVE_INFINITY;
      const includesScore = names.includes(normalized) ? 2 : Number.POSITIVE_INFINITY;
      return { student, score: Math.min(exactScore, prefixScore, includesScore) };
    })
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score || left.student.id - right.student.id)
    .slice(0, 10)
    .map((entry) => entry.student);
}
