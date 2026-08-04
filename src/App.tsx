import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Database,
  RefreshCcw,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import './App.css';
import {
  MAX_GUESSES,
  MODES,
  compareGuess,
  metadata,
  pickTarget,
  searchStudents,
  studentsForMode,
} from './game';
import type { AttributeFeedback, GuessFeedback, ModeKey, Student } from './game';

type Page = 'home' | 'single' | 'multi';

const columns = [
  '姓名',
  '学院',
  '攻击',
  '防御',
  '年龄',
  '职责',
  '招募',
  'EX Cost',
];

function Cell({ feedback }: { feedback: AttributeFeedback }) {
  return (
    <td className={feedback.level}>
      <span>{feedback.value}</span>
      {feedback.hint && (
        <span className="hint" aria-label={feedback.hint === 'higher' ? '更高' : '更低'}>
          {feedback.hint === 'higher' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </span>
      )}
    </td>
  );
}

function GuessRow({ guess }: { guess: GuessFeedback }) {
  const variant = guess.student.shortName !== guess.student.name ? guess.student.shortName : '';
  return (
    <tr className={guess.correct ? 'solved' : ''}>
      <td className={`name ${guess.correct ? 'correct' : 'wrong'}`}>
        <img src={guess.student.iconUrl} alt="" />
        <span>
          {guess.student.name}
          {variant && <small>{variant}</small>}
        </span>
      </td>
      <Cell feedback={guess.attributes.school} />
      <Cell feedback={guess.attributes.bulletType} />
      <Cell feedback={guess.attributes.armorType} />
      <Cell feedback={guess.attributes.characterAge} />
      <Cell feedback={guess.attributes.tacticRole} />
      <Cell feedback={guess.attributes.recruitType} />
      <Cell feedback={guess.attributes.exCost} />
    </tr>
  );
}

function DataNote({ fixed = false }: { fixed?: boolean }) {
  return (
    <footer className={`data-note${fixed ? ' static' : ''}`}>
      <Database size={14} />
      <span>数据生成于 {new Date(metadata.generatedAt).toLocaleString()} · SchaleDB 当前 JSON</span>
    </footer>
  );
}

function HomePage({ onSingle, onMulti }: { onSingle: () => void; onMulti: () => void }) {
  return (
    <main className="home-shell">
      <section className="home-hero">
        <p className="eyebrow">B1MORE</p>
        <h1>白一把</h1>
        <p className="home-copy">模仿“弗一把”的《蔚蓝档案》学生猜测游戏</p>
        <div className="home-actions">
          <button type="button" className="menu-button primary" onClick={onSingle}>
            <Sparkles size={20} />
            单人模式
          </button>
          <button type="button" className="menu-button" onClick={onMulti}>
            <Users size={20} />
            多人联机
          </button>
        </div>
      </section>
      <DataNote fixed />
    </main>
  );
}

function MultiPlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <main className="home-shell">
      <section className="home-hero placeholder">
        <p className="eyebrow">Multiplayer</p>
        <h1>多人联机</h1>
        <button type="button" className="menu-button" onClick={onBack}>
          <ArrowLeft size={20} />
          返回首页
        </button>
      </section>
    </main>
  );
}

function SingleGame({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<ModeKey>('cn');
  const [target, setTarget] = useState<Student>(() => pickTarget('cn'));
  const [guesses, setGuesses] = useState<GuessFeedback[]>([]);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const pool = useMemo(() => studentsForMode(mode), [mode]);
  const usedIds = useMemo(() => new Set(guesses.map((guess) => guess.student.id)), [guesses]);
  const suggestions = useMemo(
    () => searchStudents(pool, query, usedIds),
    [pool, query, usedIds],
  );
  const status = guesses.at(-1)?.correct
    ? 'won'
    : guesses.length >= MAX_GUESSES
      ? 'lost'
      : 'playing';

  function start(nextMode = mode) {
    setMode(nextMode);
    setTarget((current) => pickTarget(nextMode, current.id));
    setGuesses([]);
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function submitStudent(student: Student) {
    if (status !== 'playing' || usedIds.has(student.id)) return;
    const feedback = compareGuess(student, target, mode);
    setGuesses((current) => [...current, feedback]);
    setQuery('');
    setActiveIndex(0);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const picked = suggestions[activeIndex];
    if (picked) submitStudent(picked);
  }

  const answerVisible = status !== 'playing';

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">白一把 · Single Player</p>
          <h1>猜学生</h1>
        </div>
        <div className="top-actions">
          <button className="icon-button" type="button" onClick={onBack} aria-label="返回首页">
            <ArrowLeft size={18} />
          </button>
          <button className="icon-button" type="button" onClick={() => start()} aria-label="重新开始">
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      <section className="control-band">
        <div className="mode-tabs" aria-label="题库">
          {MODES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={mode === item.key ? 'active' : ''}
              onClick={() => start(item.key)}
              title={item.description}
            >
              {item.label}
              <small>{metadata.releasePools[item.key]}</small>
            </button>
          ))}
        </div>
        <div className="meter" aria-label={`已猜 ${guesses.length} / ${MAX_GUESSES}`}>
          {Array.from({ length: MAX_GUESSES }, (_, index) => (
            <i key={index} className={index < guesses.length ? 'used' : ''} />
          ))}
        </div>
      </section>

      <section className="game-area">
        <div className="board-wrap">
          <table className="guess-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guesses.map((guess) => (
                <GuessRow key={guess.student.id} guess={guess} />
              ))}
            </tbody>
          </table>
          {!guesses.length && (
            <div className="empty-state">
              <Sparkles size={34} />
              <span>输入学生姓名开始</span>
            </div>
          )}
        </div>

        {answerVisible && (
          <aside className={`answer ${status}`}>
            <img src={target.portraitUrl} alt="" />
            <div>
              <p>{status === 'won' ? '猜中了' : '答案'}</p>
              <strong>{target.name}</strong>
              {target.shortName !== target.name && <em>{target.shortName}</em>}
              <span>{target.schoolLabel} · {target.tacticRoleLabel} · EX {target.exCost}</span>
            </div>
          </aside>
        )}
      </section>

      <form className="guess-bar" onSubmit={submit}>
        <div className="input-wrap">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            disabled={status !== 'playing'}
            placeholder={status === 'playing' ? '学生姓名' : '本局已结束'}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (!suggestions.length) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % suggestions.length);
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
              }
            }}
          />
        </div>
        <button className="submit-button" type="submit" disabled={status !== 'playing' || !suggestions.length}>
          <Sparkles size={17} />
          猜
        </button>
        {suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((student, index) => (
              <li key={student.id}>
                <button
                  type="button"
                  className={index === activeIndex ? 'active' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => submitStudent(student)}
                >
                  <img src={student.iconUrl} alt="" />
                  <span>
                    {student.name}
                    {student.shortName !== student.name && <small>{student.shortName}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <DataNote />
    </main>
  );
}

function App() {
  const [page, setPage] = useState<Page>('home');

  if (page === 'single') return <SingleGame onBack={() => setPage('home')} />;
  if (page === 'multi') return <MultiPlaceholder onBack={() => setPage('home')} />;
  return <HomePage onSingle={() => setPage('single')} onMulti={() => setPage('multi')} />;
}

export default App;
