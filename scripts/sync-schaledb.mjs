import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const REMOTE_BASE = 'https://schaledb.com';
const REMOTE_STUDENTS = `${REMOTE_BASE}/data/zh/students.min.json`;
const REMOTE_LOCALIZATION = `${REMOTE_BASE}/data/zh/localization.min.json`;
const FALLBACK_STUDENTS = path.resolve(ROOT, '..', 'SchaleDB', 'data', 'zh', 'students.json');
const FALLBACK_LOCALIZATION = path.resolve(ROOT, '..', 'SchaleDB', 'data', 'zh', 'localization.json');
const OUTPUT = path.resolve(ROOT, 'src', 'data', 'students.json');

async function readJsonFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function readJsonWithFallback(url, fallbackPath) {
  try {
    return { value: await readJsonFromUrl(url), source: url };
  } catch (error) {
    const text = await readFile(fallbackPath, 'utf8');
    return {
      value: JSON.parse(text),
      source: `${fallbackPath} (${error instanceof Error ? error.message : 'remote failed'})`,
    };
  }
}

function firstExCost(student) {
  const ex = Array.isArray(student.Skills)
    ? student.Skills.find((skill) => skill?.SkillType === 'ex')
    : student.Skills?.Ex;
  const cost = Array.isArray(ex?.Cost) ? Number(ex.Cost[0]) : NaN;
  return Number.isFinite(cost) ? cost : null;
}

function cleanName(student) {
  const familyName = String(student.FamilyName ?? '').trim();
  const personalName = String(student.PersonalName ?? '').trim();
  return (familyName + personalName) || String(student.Name ?? student.PathName ?? student.Id);
}

function cleanAge(student) {
  const raw = String(student.CharacterAge ?? '').trim();
  const match = raw.match(/^(\d+)\D*$/);
  return match ? Number(match[1]) : null;
}

function localized(localization, group, key) {
  return String(localization?.[group]?.[key] ?? key ?? '');
}

function toStudent(student, localization) {
  const id = Number(student.Id);
  const school = String(student.School ?? '');
  const bulletType = String(student.BulletType ?? '');
  const armorType = String(student.ArmorType ?? '');
  const tacticRole = String(student.TacticRole ?? '');
  const recruitTypes = Array.isArray(student.IsLimited)
    ? student.IsLimited.map((value) => String(value)).slice(0, 3)
    : [String(student.IsLimited ?? 0), String(student.IsLimited ?? 0), String(student.IsLimited ?? 0)];
  return {
    id,
    pathName: String(student.PathName ?? ''),
    name: cleanName(student),
    shortName: String(student.Name ?? cleanName(student)),
    school,
    schoolLabel: localized(localization, 'School', school),
    bulletType,
    bulletTypeLabel: localized(localization, 'BulletType', bulletType),
    armorType,
    armorTypeLabel: localized(localization, 'ArmorType', armorType),
    characterAge: cleanAge(student),
    tacticRole,
    tacticRoleLabel: localized(localization, 'TacticRole', tacticRole),
    recruitTypes,
    recruitTypeLabels: recruitTypes.map((value) => localized(localization, 'IsLimitedFilter', value)),
    exCost: firstExCost(student),
    isReleased: Array.isArray(student.IsReleased)
      ? student.IsReleased.map(Boolean).slice(0, 3)
      : [true, true, true],
    iconUrl: `${REMOTE_BASE}/images/student/icon/${id}.webp`,
    portraitUrl: `${REMOTE_BASE}/images/student/portrait/${id}.webp`,
  };
}

const [{ value: students, source: studentSource }, { value: localization, source: localizationSource }] =
  await Promise.all([
    readJsonWithFallback(REMOTE_STUDENTS, FALLBACK_STUDENTS),
    readJsonWithFallback(REMOTE_LOCALIZATION, FALLBACK_LOCALIZATION),
  ]);

const studentList = Array.isArray(students) ? students : Object.values(students ?? {});
if (!Array.isArray(studentList) || !studentList.length) {
  throw new Error('SchaleDB students payload does not contain students');
}

const normalized = studentList
  .map((student) => toStudent(student, localization))
  .filter((student) => student.id && student.name && student.exCost !== null)
  .sort((left, right) => left.id - right.id);

const payload = {
  generatedAt: new Date().toISOString(),
  sources: {
    students: studentSource,
    localization: localizationSource,
  },
  releasePools: {
    cn: normalized.filter((student) => student.isReleased[2]).length,
    global: normalized.filter((student) => student.isReleased[1]).length,
    jp: normalized.filter((student) => student.isReleased[0]).length,
  },
  students: normalized,
};

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`Wrote ${normalized.length} students to ${path.relative(ROOT, OUTPUT)}`);
console.log(`Pools: CN ${payload.releasePools.cn}, Global ${payload.releasePools.global}, JP ${payload.releasePools.jp}`);
