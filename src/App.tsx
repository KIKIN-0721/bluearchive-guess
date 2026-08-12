import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Database,
  Eye,
  ExternalLink,
  RefreshCcw,
  Search,
  Sparkles,
  Trophy,
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
import { loadStats, resetStats, saveStats, settleStats } from './stats';
import type { DeviceStats } from './stats';

type Page = 'home' | 'single' | 'multi';
type GameStatus = 'playing' | 'won' | 'lost';

const columns = ['姓名', '学院', '攻击', '防御', '年龄', '职责', '招募', 'EX Cost'];

function confirmAbandonActiveRound(): boolean {
  return window.confirm('游戏尚未结束，退出或切换题库不会计入统计。确认继续？');
}

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

function StatGrid({ stats }: { stats: DeviceStats }) {
  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  const average = stats.wins ? (stats.totalWinningGuesses / stats.wins).toFixed(1) : '-';
  return (
    <div className="stat-grid" aria-label="当前设备统计">
      <div><strong>{stats.games}</strong><span>局数</span></div>
      <div><strong>{winRate}%</strong><span>胜率</span></div>
      <div><strong>{stats.currentStreak}</strong><span>当前连胜</span></div>
      <div><strong>{stats.bestStreak}</strong><span>最佳连胜</span></div>
      <div><strong>{stats.bestGuess ?? '-'}</strong><span>最佳猜数</span></div>
      <div><strong>{average}</strong><span>平均猜数</span></div>
      <div><strong>{stats.reveals}</strong><span>查看答案</span></div>
      <div><strong>{stats.losses}</strong><span>失败</span></div>
    </div>
  );
}

function HomePage({
  onSingle,
  onMulti,
  stats,
  onResetStats,
}: {
  onSingle: () => void;
  onMulti: () => void;
  stats: DeviceStats;
  onResetStats: () => void;
}) {
  return (
    <main className="home-shell">
      <section className="home-layout">
        <div className="home-hero">
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
            <a
              className="menu-button link"
              href="https://github.com/KIKIN-0721/bluearchive-guess"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={20} />
              GitHub 仓库
            </a>
          </div>
        </div>

        <aside className="home-panel">
          <section>
            <h2><BookOpen size={18} /> 玩法说明</h2>
            <p>选择国服、国际服或日服题库，在 8 次机会内猜出目标学生。</p>
            <p>绿色代表完全正确，红色代表不匹配；年龄和 EX Cost 会用黄色背景与白色箭头提示答案更高或更低。</p>
            <p>点击“查看答案”会直接揭晓答案，并将本局记录为失败。</p>
          </section>
          <section>
            <div className="panel-heading">
              <h2><Trophy size={18} /> 当前设备记录</h2>
              <button type="button" className="text-button" onClick={onResetStats}>清空</button>
            </div>
            <StatGrid stats={stats} />
          </section>
        </aside>
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

function SingleGame({
  onBack,
  stats,
  onSettle,
}: {
  onBack: () => void;
  stats: DeviceStats;
  onSettle: (input: { mode: ModeKey; status: 'won' | 'lost'; guessCount: number; revealed?: boolean }) => void;
}) {
  const [mode, setMode] = useState<ModeKey>('cn');
  const [target, setTarget] = useState<Student>(() => pickTarget('cn'));
  const [guesses, setGuesses] = useState<GuessFeedback[]>([]);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [finishReason, setFinishReason] = useState<'guessed' | 'failed' | 'revealed' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pool = useMemo(() => studentsForMode(mode), [mode]);
  const usedIds = useMemo(() => new Set(guesses.map((guess) => guess.student.id)), [guesses]);
  const suggestions = useMemo(() => searchStudents(pool, query, usedIds), [pool, query, usedIds]);
  const hasActiveRound = status === 'playing' && guesses.length > 0;

  useEffect(() => {
    if (!hasActiveRound) return undefined;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasActiveRound]);

  function guardActiveRound(action: () => void) {
    if (!hasActiveRound || confirmAbandonActiveRound()) {
      action();
    }
  }

  function start(nextMode = mode) {
    setMode(nextMode);
    setTarget((current) => pickTarget(nextMode, current.id));
    setGuesses([]);
    setQuery('');
    setActiveIndex(0);
    setStatus('playing');
    setFinishReason(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function finish(nextStatus: 'won' | 'lost', guessCount: number, reason: 'guessed' | 'failed' | 'revealed') {
    setStatus(nextStatus);
    setFinishReason(reason);
    onSettle({ mode, status: nextStatus, guessCount, revealed: reason === 'revealed' });
  }

  function submitStudent(student: Student) {
    if (status !== 'playing' || usedIds.has(student.id)) return;
    const feedback = compareGuess(student, target, mode);
    const nextGuesses = [...guesses, feedback];
    setGuesses(nextGuesses);
    setQuery('');
    setActiveIndex(0);
    if (feedback.correct) {
      finish('won', nextGuesses.length, 'guessed');
    } else if (nextGuesses.length >= MAX_GUESSES) {
      finish('lost', nextGuesses.length, 'failed');
    }
  }

  function revealAnswer() {
    if (status !== 'playing') return;
    finish('lost', guesses.length, 'revealed');
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
          <button
            className="icon-button"
            type="button"
            onClick={() => guardActiveRound(onBack)}
            aria-label="返回首页"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => guardActiveRound(() => start())}
            aria-label="重新开始"
          >
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
              onClick={() => {
                if (item.key !== mode) {
                  guardActiveRound(() => start(item.key));
                }
              }}
              title={item.description}
            >
              {item.label}
              <small>{metadata.releasePools[item.key]}</small>
            </button>
          ))}
        </div>
        <div className="round-tools">
          <div className="meter" aria-label={`已猜 ${guesses.length} / ${MAX_GUESSES}`}>
            {Array.from({ length: MAX_GUESSES }, (_, index) => (
              <i key={index} className={index < guesses.length ? 'used' : ''} />
            ))}
          </div>
          <button className="reveal-button" type="button" onClick={revealAnswer} disabled={status !== 'playing'}>
            <Eye size={15} />
            查看答案
          </button>
        </div>
      </section>

      <section className="game-area">
        <div className="board-wrap">
          <table className="guess-table">
            <colgroup>
              <col className="col-name" />
              <col className="col-school" />
              <col className="col-compact" />
              <col className="col-compact" />
              <col className="col-number" />
              <col className="col-role" />
              <col className="col-recruit" />
              <col className="col-cost" />
            </colgroup>
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

        <aside className="side-stack">
          <section className="mini-stats">
            <strong>{stats.games}</strong>
            <span>当前设备局数</span>
            <strong>{stats.wins}</strong>
            <span>胜场</span>
          </section>
          {answerVisible && (
            <section className={`answer ${status}`}>
              <img src={target.portraitUrl} alt="" />
              <div>
                <p>
                  {finishReason === 'revealed'
                    ? '已查看答案，本局判负'
                    : status === 'won'
                      ? '猜中了'
                      : '答案'}
                </p>
                <strong>{target.name}</strong>
                {target.shortName !== target.name && <em>{target.shortName}</em>}
                <span>{target.schoolLabel} · {target.tacticRoleLabel} · EX {target.exCost}</span>
              </div>
            </section>
          )}
        </aside>
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
  const [stats, setStats] = useState<DeviceStats>(() => loadStats());

  function settle(input: { mode: ModeKey; status: 'won' | 'lost'; guessCount: number; revealed?: boolean }) {
    setStats((current) => {
      const next = settleStats(current, input);
      saveStats(next);
      return next;
    });
  }

  function clearStats() {
    setStats(resetStats());
  }

  if (page === 'single') {
    return <SingleGame onBack={() => setPage('home')} stats={stats} onSettle={settle} />;
  }
  if (page === 'multi') return <MultiPlaceholder onBack={() => setPage('home')} />;
  return (
    <HomePage
      onSingle={() => setPage('single')}
      onMulti={() => setPage('multi')}
      stats={stats}
      onResetStats={clearStats}
    />
  );
}

export default App;
