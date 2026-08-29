"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SITE } from "@/data/site";
// 注意: "@/data/questions" を import しない(全問データがクライアントバンドルに入る)。
// マスター定義は certs.ts、問題データは question-loader.ts の動的 import で取得する。
import {
  CERTS,
  categoryName,
  categoriesOfCert,
  certById,
  type Cert,
  type CertId,
  type CategoryId,
  type Question,
  type QuizCounts,
} from "@/data/certs";
import { loadCertQuestions } from "@/data/question-loader";
import CourseAffiliateCTA, { CompactCourseCTA } from "@/components/CourseAffiliateCTA";

// 出題用に加工した問題（選択肢をシャッフルし、正解の位置を付け替える）
type Prepared = {
  base: Question;
  choices: string[];
  answer: number; // シャッフル後の正解インデックス
};

// Fisher–Yates シャッフル（元配列は壊さない）
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function prepare(questions: Question[]): Prepared[] {
  return shuffle(questions).map((base) => {
    const correctText = base.choices[base.answer];
    const choices = shuffle(base.choices);
    return { base, choices, answer: choices.indexOf(correctText) };
  });
}

// GA4 イベント計測。gtag は layout で lazyOnload 読込のため、未ロード時は何もしない。
// 演習開始/完了/外部CTAクリックを資格別に測り、流入→演習→換金の転換率を見る。
function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

// ---- 受験履歴（この端末の localStorage に保存）-------------------------------
export type Attempt = {
  date: string;
  name: string;
  label: string;
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
};

const HISTORY_KEY = "eiseiQuizHistory_v1";

function loadHistory(): Attempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as Attempt[]) : [];
  } catch {
    return [];
  }
}

function persistHistory(list: Attempt[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* 保存できない環境では履歴を諦める */
  }
}

// 履歴を Excel で開ける CSV として書き出す（BOM 付きで文字化け防止）
function exportHistoryCsv(list: Attempt[]) {
  const header = ["日時", "受験者", "範囲", "得点", "正答数", "問題数", "合否"];
  const rows = list.map((a) => [
    a.date,
    a.name,
    a.label,
    `${a.percent}点`,
    a.correct,
    a.total,
    a.passed ? "合格" : "不合格",
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eisei-shikaku-results.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Screen = "start" | "quiz" | "result";

export default function QuizApp({
  initialCert,
  counts,
  hasPageH1 = false,
}: {
  initialCert?: CertId;
  counts: QuizCounts;
  /** ページ側が可視の h1 を持つ場合に true。QuizApp 内の h1 を出さず重複を防ぐ */
  hasPageH1?: boolean;
}) {
  const [screen, setScreen] = useState<Screen>("start");
  const initialCertId = initialCert ?? "eisei2";
  const [certId, setCertId] = useState<CertId>(initialCertId);
  const cert = certById(certId)!;
  const [name, setName] = useState("");
  const [history, setHistory] = useState<Attempt[]>([]);
  useEffect(() => {
    setHistory(loadHistory());
    // /?cert=xxx の旧リンク互換。資格別ページ(/[certId]/)経由では props が優先。
    if (!initialCert && typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("cert");
      if (p && CERTS.some((c) => c.id === p)) setCertId(p as CertId);
    }
  }, [initialCert]);

  // 選択中の資格の問題データ(資格別チャンクを動的ロード)
  const [questions, setQuestions] = useState<Question[] | null>(null);
  useEffect(() => {
    let alive = true;
    setQuestions(null);
    loadCertQuestions(certId).then((qs) => {
      if (alive) setQuestions(qs);
    });
    return () => {
      alive = false;
    };
  }, [certId]);

  // 現在の出題セット
  const [pool, setPool] = useState<Question[]>([]); // 「もう一度」で再シャッフルする元
  const [label, setLabel] = useState("");
  const [passLine, setPassLine] = useState(cert.passLine);
  const [set, setSet] = useState<Prepared[]>([]);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  const [revealed, setRevealed] = useState(false);

  function startWith(questions: Question[], lbl: string, pl: number) {
    const prepared = prepare(questions);
    setPool(questions);
    setLabel(lbl);
    setPassLine(pl);
    setSet(prepared);
    setPicks(new Array(prepared.length).fill(null));
    setIdx(0);
    setRevealed(false);
    setScreen("quiz");
    track("quiz_start", { cert: cert.id, quiz: lbl, questions: prepared.length });
  }

  // 問題データのロード完了前は開始しない(ロードは数百msで完了する)
  function startCategory(categoryId: Question["category"]) {
    if (!questions) return;
    startWith(
      questions.filter((q) => q.category === categoryId),
      `${cert.name}・${categoryName(categoryId)}`,
      cert.passLine
    );
  }

  function startMix() {
    if (!questions) return;
    const picked = shuffle(questions).slice(0, Math.min(SITE.mixCount, questions.length));
    startWith(picked, `${cert.name}・全分野ミックス（${picked.length}問）`, cert.passLine);
  }

  function startAll() {
    if (!questions) return;
    startWith(questions, `${cert.name}・全問通し（${questions.length}問）`, cert.passLine);
  }

  function startExam() {
    if (!questions) return;
    const n = Math.min(cert.examCount, questions.length);
    const picked = shuffle(questions).slice(0, n);
    startWith(picked, `${cert.name}・本番形式（${picked.length}問）`, cert.passLine);
  }

  function recordResult(correct: number, total: number) {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const date = `${now.getFullYear()}/${p(now.getMonth() + 1)}/${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`;
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
    const attempt: Attempt = {
      date,
      name: name.trim() || "（名前なし）",
      label,
      correct,
      total,
      percent,
      passed: percent >= passLine,
    };
    const next = [attempt, ...history].slice(0, 200);
    setHistory(next);
    persistHistory(next);
  }

  function clearHistory() {
    setHistory([]);
    persistHistory([]);
  }

  function choose(choiceIdx: number) {
    if (revealed) return;
    setPicks((prev) => {
      const next = [...prev];
      next[idx] = choiceIdx;
      return next;
    });
  }

  // 選んでから「解答する」で確定・採点（誤タップ防止＋考えて答える体験）
  function submit() {
    if (revealed || picks[idx] === null) return;
    setRevealed(true);
    // q_index別の残存率(何問目で離脱するか)を見るための計測
    track("quiz_q_answered", {
      cert: cert.id,
      q_index: idx + 1,
      correct: picks[idx] === set[idx].answer,
    });
  }

  function advance() {
    if (idx + 1 >= set.length) {
      const correct = set.filter((q, i) => picks[i] === q.answer).length;
      recordResult(correct, set.length);
      track("quiz_complete", {
        cert: cert.id,
        quiz: label,
        percent: set.length === 0 ? 0 : Math.round((correct / set.length) * 100),
      });
      setScreen("result");
    } else {
      setIdx(idx + 1);
      setRevealed(false);
    }
  }

  // ---- 画面ごとの描画 -------------------------------------------------------
  if (screen === "start") {
    return (
      <StartScreen
        certId={certId}
        cert={cert}
        lockCert={!!initialCert}
        hasPageH1={hasPageH1}
        questions={questions}
        counts={counts}
        initialCertId={initialCertId}
        name={name}
        setName={setName}
        onCategory={startCategory}
        onExam={startExam}
        onMix={startMix}
        onAll={startAll}
        history={history}
        onClearHistory={clearHistory}
        onExportHistory={() => exportHistoryCsv(history)}
      />
    );
  }

  if (screen === "quiz") {
    const cur = set[idx];
    return (
      <QuizScreen
        cur={cur}
        idx={idx}
        total={set.length}
        label={label}
        picked={picks[idx]}
        revealed={revealed}
        onChoose={choose}
        onSubmit={submit}
        onNext={advance}
        onQuit={() => setScreen("start")}
      />
    );
  }

  return (
    <ResultScreen
      certId={certId}
      name={name}
      label={label}
      passLine={passLine}
      set={set}
      picks={picks}
      onRetryAll={() => startWith(pool, label, passLine)}
      onRetryWrong={(wrong) => startWith(wrong, "間違えた問題の復習", passLine)}
      onHome={() => setScreen("start")}
    />
  );
}

// ============================================================ スタート画面
function StartScreen({
  certId,
  cert,
  lockCert,
  hasPageH1,
  questions,
  counts,
  initialCertId,
  name,
  setName,
  onCategory,
  onExam,
  onMix,
  onAll,
  history,
  onClearHistory,
  onExportHistory,
}: {
  certId: CertId;
  cert: Cert;
  lockCert: boolean;
  hasPageH1: boolean;
  questions: Question[] | null;
  counts: QuizCounts;
  initialCertId: CertId;
  name: string;
  setName: (v: string) => void;
  onCategory: (id: Question["category"]) => void;
  onExam: () => void;
  onMix: () => void;
  onAll: () => void;
  history: Attempt[];
  onClearHistory: () => void;
  onExportHistory: () => void;
}) {
  const cats = categoriesOfCert(cert);
  // 件数はロード済みデータ優先。未ロード時はサーバーから渡された件数(SSRと一致)を使う
  const certTotal = questions?.length ?? counts.totals[certId] ?? 0;
  const catCount = (catId: CategoryId): number =>
    questions
      ? questions.filter((q) => q.category === catId).length
      : certId === initialCertId
        ? (counts.activeCat[catId] ?? 0)
        : 0;
  const examN = Math.min(cert.examCount, certTotal);

  return (
    <div className="fade-up">
      {/* 資格別ページ(/[certId]/)ではページ側が h1 を持つため出さない */}
      {!lockCert && !hasPageH1 && (
        <h1 className="sr-only">
          第一種・第二種衛生管理者の無料練習問題(関係法令・労働衛生・労働生理・有害業務) — 解説つき4択・本番形式モード・模擬試験対応
        </h1>
      )}
      {/* 試験を選ぶ(資格別ページへの crawlable なリンク。SEO入口に内部リンクを集める) */}
      {lockCert ? (
        <div className="mb-6">
          <Link
            href="/"
            className="text-[12px] text-ink-faint hover:text-ink-soft underline underline-offset-2"
          >
            ← 他の試験を選ぶ
          </Link>
        </div>
      ) : (
        <>
          <div className="text-[11px] tracked text-ink-faint mb-2.5">試験を選ぶ</div>
          <div className="grid sm:grid-cols-3 gap-2.5 mb-8">
            {CERTS.map((c) => {
              const count = counts.totals[c.id] ?? 0;
              const selected = c.id === certId;
              const disabled = count === 0;
              const cardClass = `rounded-[10px] p-3.5 text-left transition block no-underline ${
                selected
                  ? "border-2 border-accent bg-accent-wash"
                  : "border border-line bg-surface hover:border-accent"
              } ${disabled ? "opacity-45 cursor-not-allowed" : ""}`;
              const inner = (
                <>
                  <div className="font-serif text-[16px] font-medium text-ink leading-none">{c.name}</div>
                  <div className="text-[11px] text-ink-soft mt-1.5 leading-snug">{c.fullName}</div>
                  <div className="text-[11px] text-ink-faint tabular mt-2">
                    {disabled ? "準備中" : `全${count}問`}
                  </div>
                </>
              );
              return disabled ? (
                <div key={c.id} className={cardClass}>
                  {inner}
                </div>
              ) : (
                <Link key={c.id} href={`/${c.id}/`} className={cardClass}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* 選択中の試験 */}
      <div className="mb-7 border-l-2 border-accent pl-3.5">
        <h2 className="font-serif text-[22px] sm:text-[25px] font-medium text-ink leading-snug tracking-tight">
          {cert.fullName}
        </h2>
        <p className="mt-2 text-[13px] text-ink-soft leading-relaxed max-w-xl">
          {cert.desc} 1問ごとに正誤と解説が出て、最後に合格ライン（{cert.passLine}%）で判定します。
        </p>
      </div>

      {/* 受験者名（任意） */}
      <label className="block mb-7">
        <span className="text-[11px] text-ink-soft">受験者名（任意・結果と履歴に表示）</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例）山田 太郎"
          className="mt-1.5 w-full rounded-[8px] border border-line-strong bg-surface px-4 py-2.5 text-sm text-ink outline-none transition focus:border-accent"
        />
      </label>

      {/* 本番形式(主役) */}
      <button
        onClick={onExam}
        className="group w-full mb-2.5 rounded-[10px] bg-ink text-paper px-5 py-4 text-left transition hover:bg-accent flex items-center gap-3"
      >
        <span className="flex-1">
          <span className="block text-[15px] font-medium">本番形式で挑戦</span>
          <span className="block text-[11px] text-paper/60 mt-0.5">
            本試験に近い{examN}問をランダム出題・合格ライン{cert.passLine}%で判定
          </span>
        </span>
        <span className="text-paper/70 group-hover:translate-x-0.5 transition">→</span>
      </button>

      {/* 腕試し(ミックス) / 全問通し */}
      <div className="grid sm:grid-cols-2 gap-2.5 mb-8">
        <button
          onClick={onMix}
          className="group rounded-[10px] border border-line-strong bg-surface px-5 py-4 text-left transition hover:border-accent flex items-center gap-3"
        >
          <span className="flex-1">
            <span className="block text-[15px] font-medium text-ink">腕試し(ミックス)</span>
            <span className="block text-[11px] text-ink-soft mt-0.5">
              全分野からランダム{Math.min(SITE.mixCount, certTotal)}問でサクッと
            </span>
          </span>
          <span className="text-accent group-hover:translate-x-0.5 transition">→</span>
        </button>
        <button
          onClick={onAll}
          className="group rounded-[10px] border border-line-strong bg-surface px-5 py-4 text-left transition hover:border-accent flex items-center gap-3"
        >
          <span className="flex-1">
            <span className="block text-[15px] font-medium text-ink">全問通し</span>
            <span className="block text-[11px] text-ink-soft mt-0.5">
              この試験の全{certTotal}問をまとめて
            </span>
          </span>
          <span className="text-accent group-hover:translate-x-0.5 transition">→</span>
        </button>
      </div>

      {/* 分野一覧 */}
      <div className="flex items-baseline gap-2.5 mb-3 pb-2 border-b border-line">
        <span className="font-serif text-[15px] font-medium text-ink">分野で選ぶ</span>
        <span className="text-[10px] tracked uppercase text-ink-faint">{cert.name}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {cats.map((c, i) => {
          const count = catCount(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onCategory(c.id)}
              disabled={count === 0}
              className="group rounded-[10px] border border-line bg-surface p-4 text-left transition hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <span className="font-serif text-[15px] text-accent tabular leading-none mt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-ink">{c.name}</div>
                  <div className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">{c.desc}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-ink-faint tabular">全{count}問</span>
                <span className="text-[12px] text-accent group-hover:translate-x-0.5 transition">
                  開始 →
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 受験履歴（この端末に保存） */}
      {history.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[11px] text-ink-soft">
              受験履歴
              <span className="text-ink-faint">（この端末に保存・{history.length}件）</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onExportHistory}
                className="text-[11px] text-accent-ink border border-accent/40 rounded-[6px] px-2.5 py-1 transition hover:bg-accent-wash"
              >
                CSVで保存
              </button>
              <button
                onClick={onClearHistory}
                className="text-[11px] text-ink-soft border border-line-strong rounded-[6px] px-2.5 py-1 transition hover:bg-line/40"
              >
                履歴を消去
              </button>
            </div>
          </div>
          <div className="rounded-[10px] border border-line bg-surface divide-y divide-line overflow-hidden">
            {history.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`shrink-0 grid place-items-center w-12 text-[10px] rounded-[5px] py-1 ${
                    a.passed ? "bg-correct-wash text-correct" : "bg-wrong-wash text-wrong"
                  }`}
                >
                  {a.passed ? "合格" : "再挑戦"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-ink truncate">
                    {a.name}
                    <span className="ml-2 text-[11px] text-ink-soft">{a.label}</span>
                  </div>
                  <div className="text-[11px] text-ink-faint tabular">{a.date}</div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-serif text-[17px] tabular text-ink">{a.percent}</span>
                  <span className="text-[11px] text-ink-soft">点</span>
                </div>
              </div>
            ))}
          </div>
          {history.length > 8 && (
            <div className="mt-1.5 text-[11px] text-ink-faint text-center">
              直近8件を表示中（CSVには全{history.length}件を書き出します）
            </div>
          )}
        </div>
      )}

      {/* 関連サービス: シカクモンスタジオ(静かな二次導線。主役の本番形式ボタンより下・琥珀は使わず bg-surface) */}
      <a
        href={`${SITE.studioUrl}?utm_source=eisei&utm_medium=referral&utm_content=home_card&exam=${encodeURIComponent(cert.name)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("studio_cta_click", { placement: "home" })}
        className="block mt-10 rounded-[12px] border border-line-strong bg-surface p-5 transition hover:border-accent"
      >
        <div className="text-[11px] tracked text-ink-faint">関連サービス</div>
        <div className="font-serif text-[16px] font-medium text-ink mt-1">
          自分専用の問題集も作れます
        </div>
        <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
          資格名を入れるだけ、または手元の教材PDF・写真からAIが4択問題と解説を生成。間違えた問題は忘却曲線で自動復習。このドリルに無い資格も学べます。
        </p>
        <span className="inline-block mt-3 text-[13px] text-accent">
          シカクモン Studio を無料で試す →
        </span>
      </a>
    </div>
  );
}

// ============================================================ 出題画面
function QuizScreen({
  cur,
  idx,
  total,
  label,
  picked,
  revealed,
  onChoose,
  onSubmit,
  onNext,
  onQuit,
}: {
  cur: Prepared;
  idx: number;
  total: number;
  label: string;
  picked: number | null;
  revealed: boolean;
  onChoose: (i: number) => void;
  onSubmit: () => void;
  onNext: () => void;
  onQuit: () => void;
}) {
  const isCorrect = picked !== null && picked === cur.answer;
  const progress = Math.round(((idx + (revealed ? 1 : 0)) / total) * 100);
  const letters = ["a", "b", "c", "d"];

  // 解説を読み進めて下スクロールした位置のまま次問へ進む(または開始時にヒーローの
  // 下に設問が隠れる)と設問が画面外になるため、問題の切り替わりごとに設問先頭へ戻す。
  // key={idx} で問題ごとに再マウントされるので、マウント時に一度だけ実行される。
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    // 設問の先頭がすでに画面内(上端〜1/3)にあるときは動かさない(無駄な揺れ防止)
    if (top >= 0 && top < window.innerHeight / 3) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="fade-up scroll-mt-16" key={idx} ref={rootRef}>
      {/* 上部バー */}
      <div className="flex items-center justify-between mb-2 text-[11px] text-ink-soft">
        <span className="truncate pr-2">{label}</span>
        <span className="tabular shrink-0">
          問 {idx + 1} / {total}
        </span>
      </div>
      <div className="h-[3px] w-full bg-line overflow-hidden mb-7">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 設問 */}
      <div className="mb-5">
        <div className="text-[11px] tracked text-ink-faint mb-2.5">
          {categoryName(cur.base.category)}
        </div>
        <p className="font-serif text-[19px] sm:text-[21px] font-medium text-ink leading-relaxed">
          {cur.base.q}
        </p>
      </div>

      {/* 選択肢 */}
      <div className="space-y-2">
        {cur.choices.map((choice, i) => {
          let box = "border-line bg-surface hover:border-accent";
          let chip = "border border-line-strong text-ink-soft";
          let chipText = letters[i];
          if (!revealed && picked === i) {
            box = "border-accent bg-accent-wash";
            chip = "bg-accent text-white border-transparent";
          }
          if (revealed) {
            if (i === cur.answer) {
              box = "border-correct bg-correct-wash";
              chip = "bg-correct text-white border-transparent";
              chipText = "✓";
            } else if (i === picked) {
              box = "border-wrong bg-wrong-wash";
              chip = "bg-wrong text-white border-transparent";
              chipText = "✕";
            } else {
              box = "border-line bg-surface opacity-55";
            }
          }
          return (
            <button
              key={i}
              onClick={() => onChoose(i)}
              disabled={revealed}
              className={`w-full text-left rounded-[10px] border px-4 py-3 transition flex items-center gap-3 ${box} ${
                revealed ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <span
                className={`grid place-items-center w-6 h-6 rounded-full text-[12px] shrink-0 ${chip}`}
              >
                {chipText}
              </span>
              <span className="text-[14px] text-ink leading-relaxed">{choice}</span>
            </button>
          );
        })}
      </div>

      {/* 解答する（選んでから確定して採点） */}
      {!revealed && (
        <button
          onClick={onSubmit}
          disabled={picked === null}
          className="mt-5 w-full rounded-[8px] bg-accent text-white text-[15px] font-medium py-3.5 transition hover:bg-accent-ink disabled:opacity-45 disabled:cursor-not-allowed"
        >
          解答する
        </button>
      )}

      {/* 解説＋次へ */}
      {revealed && (
        <div className="fade-up mt-5">
          <div
            className={`rounded-[10px] border p-4 ${
              isCorrect ? "border-correct/40 bg-correct-wash" : "border-wrong/40 bg-wrong-wash"
            }`}
          >
            <div
              className={`text-[12px] tracked mb-1.5 ${
                isCorrect ? "text-correct" : "text-wrong"
              }`}
            >
              {isCorrect ? "正解" : "不正解"}
            </div>
            <p className="text-[13px] text-ink leading-relaxed">{cur.base.explain}</p>
          </div>
          <button
            onClick={onNext}
            className="mt-4 w-full rounded-[8px] bg-accent text-white text-[15px] font-medium py-3.5 transition hover:bg-accent-ink"
          >
            {idx + 1 >= total ? "結果を見る →" : "次の問題へ →"}
          </button>
        </div>
      )}

      <button
        onClick={onQuit}
        className="mt-6 mx-auto block text-[11px] text-ink-faint hover:text-ink-soft underline underline-offset-2"
      >
        中断して試験・分野選択に戻る
      </button>
    </div>
  );
}

// ============================================================ 結果画面
function ResultScreen({
  certId,
  name,
  label,
  passLine,
  set,
  picks,
  onRetryAll,
  onRetryWrong,
  onHome,
}: {
  /** 講座アフィリを資格別に出し分けるために受け取る */
  certId: CertId;
  name: string;
  label: string;
  passLine: number;
  set: Prepared[];
  picks: (number | null)[];
  onRetryAll: () => void;
  onRetryWrong: (wrong: Question[]) => void;
  onHome: () => void;
}) {
  const total = set.length;
  const correct = set.filter((q, i) => picks[i] === q.answer).length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  const passed = percent >= passLine;

  const wrong = set.filter((q, i) => picks[i] !== q.answer);
  const wrongBases = wrong.map((w) => w.base);

  // カテゴリ別内訳
  const byCat = useMemo(() => {
    const map = new Map<Question["category"], { correct: number; total: number }>();
    set.forEach((q, i) => {
      const cat = q.base.category;
      const cur = map.get(cat) ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (picks[i] === q.answer) cur.correct += 1;
      map.set(cat, cur);
    });
    return [...map.entries()];
  }, [set, picks]);

  // 圧縮版CTA用: 合格ラインまでの不足問数と、正答率が最も低い分野
  const needMore = Math.max(0, Math.ceil((passLine / 100) * total) - correct);
  const weakestCat =
    byCat.length > 1
      ? [...byCat].sort(
          (a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total
        )[0][0]
      : null;

  return (
    <div className="fade-up">
      {/* スコア */}
      <div className="rounded-[12px] border border-line-strong bg-surface p-7 sm:p-8">
        {name && <div className="text-[12px] text-ink-soft mb-0.5">{name} さんの結果</div>}
        <div className="text-[11px] tracked text-ink-faint">{label}</div>

        <div className="mt-5 flex items-end gap-5">
          <div className="leading-none">
            <span className="font-serif text-[56px] font-medium tabular text-ink">{percent}</span>
            <span className="text-[14px] text-ink-soft ml-1">点</span>
          </div>
          <div className="pb-2">
            <span
              className={`inline-block text-[12px] tracked px-3 py-1 rounded-[6px] ${
                passed ? "bg-correct-wash text-correct" : "bg-accent-wash text-accent-ink"
              }`}
            >
              {passed ? "合格" : "もう少し"}
            </span>
            <div className="mt-2 text-[12px] text-ink-soft tabular">
              {total}問中 <span className="text-ink font-medium">{correct}</span>問正解
              <span className="text-ink-faint">（合格ライン {passLine}%）</span>
            </div>
          </div>
        </div>

        {/* スコアバー */}
        <div className="mt-5 h-[3px] w-full bg-line overflow-hidden">
          <div
            className={`h-full ${passed ? "bg-correct" : "bg-accent"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 圧縮版の講座CTA(点数直下=結果画面の最初の視界)。
          下の詳細版(quiz_result)とplacementを分けてCTRを比較する。
          不合格のときだけ出す(合格者には売り込まない) */}
      {!passed && wrong.length > 0 && (
        <CompactCourseCTA
          certId={certId}
          placement="quiz_result_top"
          lead={
            weakestCat
              ? `合格ライン${passLine}%まであと${needMore}問。まず「${categoryName(weakestCat)}」の失点から。`
              : `合格ライン${passLine}%まであと${needMore}問。取りこぼした論点を講義で埋めるなら。`
          }
          className="mt-5"
        />
      )}

      {/* カテゴリ別内訳（2分野以上のときだけ表示） */}
      {byCat.length > 1 && (
        <div className="mt-5 rounded-[10px] border border-line bg-surface p-4">
          <div className="text-[11px] tracked text-ink-faint mb-3">分野別の正答</div>
          <div className="space-y-2.5">
            {byCat.map(([cat, v]) => {
              const p = Math.round((v.correct / v.total) * 100);
              return (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 text-[12px] text-ink truncate">
                    {categoryName(cat)}
                  </div>
                  <div className="flex-1 h-[3px] bg-line overflow-hidden">
                    <div
                      className={`h-full ${p >= passLine ? "bg-correct" : "bg-accent"}`}
                      style={{ width: `${p}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-[12px] tabular text-ink-soft">
                    {p}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 間違えた問題の振り返り */}
      {wrong.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] tracked text-ink-faint mb-2.5">
            間違えた問題（{wrong.length}問）の振り返り
          </div>
          <div className="space-y-2.5">
            {wrong.map((q, i) => (
              <div key={i} className="rounded-[10px] border border-line bg-surface p-4">
                <p className="font-serif text-[15px] text-ink leading-relaxed">{q.base.q}</p>
                <div className="mt-2 text-[13px]">
                  <span className="text-correct">正解：</span>
                  <span className="text-ink">{q.choices[q.answer]}</span>
                </div>
                <p className="mt-1.5 text-[12px] text-ink-soft leading-relaxed">{q.base.explain}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 講座アフィリ(資格別。A8提携後に affiliate.ts へリンクを設定すると点灯) */}
      <CourseAffiliateCTA certId={certId} placement="quiz_result" className="mt-6" />

      {/* シカクモンスタジオへの導線(弱点が見えた直後)。
          注意: この画面の `name` は受験者が入力した氏名なので資格名には使えない。
          資格名は certId から引く(着地先で ?exam= がお試し生成の初期値になる)。 */}
      <a
        href={`${SITE.studioUrl}?utm_source=eisei&utm_medium=referral&utm_content=result_cta&exam=${encodeURIComponent(certById(certId)!.name)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("studio_cta_click", { placement: "result" })}
        className="block mt-6 rounded-[12px] border border-accent/40 bg-accent-wash p-5 transition hover:border-accent"
      >
        <div className="text-[11px] tracked text-accent-ink">今回の取りこぼしを忘れる前に</div>
        <div className="font-serif text-[16px] font-medium text-ink mt-1">
          間違えた分野を、自分の教材で潰す
        </div>
        <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
          手元の教科書やノートの写真・PDFから、AIが4択問題と解説を生成。間違えた問題は忘却曲線で自動復習できます。このドリルに無い資格も学べる姉妹サービスです。
        </p>
        <span className="inline-block mt-3 text-[13px] text-accent">
          シカクモン Studio を無料で試す →
        </span>
      </a>

      {/* 操作ボタン */}
      <div className="mt-5 space-y-2.5">
        {wrong.length > 0 && (
          <button
            onClick={() => onRetryWrong(wrongBases)}
            className="w-full rounded-[8px] bg-accent text-white text-[15px] font-medium py-3.5 transition hover:bg-accent-ink"
          >
            間違えた {wrong.length} 問だけ復習する
          </button>
        )}
        <button
          onClick={onRetryAll}
          className="w-full rounded-[8px] border border-ink/25 bg-surface text-ink text-[15px] font-medium py-3 transition hover:border-ink"
        >
          同じ範囲をもう一度
        </button>
        <button
          onClick={onHome}
          className="w-full rounded-[8px] border border-line-strong bg-surface text-ink-soft text-[14px] py-3 transition hover:bg-line/40"
        >
          試験・分野を選び直す
        </button>
      </div>
    </div>
  );
}
