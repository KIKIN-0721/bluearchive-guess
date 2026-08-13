import dataset from './data/students.json';

export type ModeKey = 'cn' | 'global' | 'jp';
export type FeedbackLevel = 'correct' | 'close' | 'wrong';
export type BoardColumnKey = 'name' | 'school' | 'bulletType' | 'armorType' | 'characterAge' | 'tacticRole' | 'recruitType' | 'exCost';

// 学生数据是同步脚本从 SchaleDB JSON 清洗后的形态。
// UI 不再直接理解 SchaleDB 原字段，而是统一读取这里定义的标准字段。
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

// 三个题库共用同一份学生数据，通过 SchaleDB 的 IsReleased 三段布尔值区分服务器。
// releaseIndex 的顺序来自 SchaleDB：0=日服，1=国际服，2=国服。
export function studentsForMode(mode: ModeKey): Student[] {
  const releaseIndex = MODES.find((item) => item.key === mode)?.releaseIndex ?? 0;
  return students.filter((student) => student.isReleased[releaseIndex]);
}

// 开新局时尽量避免连续抽到同一个答案，让“重新开始”的体感更自然。
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

// 数值字段只有在“猜测值”和“目标值”都是有效数字时才显示大小箭头。
// 如果任意一边是 N/A，就只能判定为不匹配，不能推导更高或更低。
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeColumnPercentages(
  raw: Record<BoardColumnKey, number>,
  limits: Record<BoardColumnKey, { min: number; max: number }>
): Record<BoardColumnKey, number> {
  const keys = BOARD_COLUMNS.map((column) => column.key);
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
  const initial = Object.fromEntries(
    keys.map((key) => [key, clamp((raw[key] / total) * 100, limits[key].min, limits[key].max)])
  ) as Record<BoardColumnKey, number>;
  const fixed = new Set<BoardColumnKey>();

  for (let pass = 0; pass < keys.length; pass += 1) {
    const currentTotal = keys.reduce((sum, key) => sum + initial[key], 0);
    const delta = 100 - currentTotal;
    if (Math.abs(delta) < 0.001) break;

    const adjustable = keys.filter((key) => {
      if (fixed.has(key)) return false;
      return delta > 0 ? initial[key] < limits[key].max : initial[key] > limits[key].min;
    });
    if (!adjustable.length) break;

    const adjustableTotal = adjustable.reduce((sum, key) => sum + initial[key], 0);
    for (const key of adjustable) {
      const share = adjustableTotal > 0 ? initial[key] / adjustableTotal : 1 / adjustable.length;
      const next = clamp(initial[key] + delta * share, limits[key].min, limits[key].max);
      if (next === limits[key].min || next === limits[key].max) fixed.add(key);
      initial[key] = next;
    }
  }

  return initial;
}

// 棋盘列宽先按当前题库“理论最长内容”估算，再套一层视觉上下限。
// 这样既能响应不同题库的数据差异，也不会让姓名、招募这种长文本列把表格撑得失衡。
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
  const raw = {
    name: maxWidth([BOARD_COLUMNS[0].label, ...values.name], 10) + 4,
    school: maxWidth([BOARD_COLUMNS[1].label, ...values.school], 8),
    bulletType: maxWidth([BOARD_COLUMNS[2].label, ...values.bulletType], 5),
    armorType: maxWidth([BOARD_COLUMNS[3].label, ...values.armorType], 6),
    characterAge: maxWidth([BOARD_COLUMNS[4].label, ...values.characterAge], 5),
    tacticRole: maxWidth([BOARD_COLUMNS[5].label, ...values.tacticRole], 5),
    recruitType: maxWidth([BOARD_COLUMNS[6].label, ...values.recruitType], 8),
    exCost: maxWidth([BOARD_COLUMNS[7].label, ...values.exCost], 6),
  };
  return normalizeColumnPercentages(raw, {
    name: { min: 20, max: 24 },
    school: { min: 11, max: 15 },
    bulletType: { min: 7, max: 10 },
    armorType: { min: 10, max: 13 },
    characterAge: { min: 7, max: 9 },
    tacticRole: { min: 9, max: 12 },
    recruitType: { min: 11, max: 14 },
    exCost: { min: 8, max: 10 },
  });
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

// 搜索候选时按“完全匹配、前缀匹配、包含匹配”排序。
// 这样输入短名、全名或 PathName 片段都能较快找到学生，同时排除已经猜过的学生。
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
