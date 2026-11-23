"use client";

// =============================================================================
// 一問一答(○×)。2026-11-23 追加。1回10問、1問ずつその場で答え合わせをして解説を出す。
// 正誤は学習履歴に残さない(履歴は4択の問題単位で数えているため)。
// GA4 へは開始と終了だけ送る。
// =============================================================================

import Link from "next/link";
import { useMemo, useState } from "react";
import type { OxItem } from "@/data/ichimon";

const SIZE = 10;

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Result = { correct: boolean; given: boolean };

export default function IchimonDrill({
  certId,
  certName,
  ox,
  sharedExplains,
}: {
  certId: string;
  certName: string;
  ox: OxItem[];
  sharedExplains: Record<string, string>;
}) {
  const [field, setField] = useState("");
  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [pool, setPool] = useState<OxItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<(Result | null)[]>([]);

  const fields = useMemo(() => [...new Set(ox.map((q) => q.field))], [ox]);
  const filtered = field ? ox.filter((q) => q.field === field) : ox;

  function start() {
    const picked = shuffle(filtered).slice(0, SIZE);
    setPool(picked);
    setResults(picked.map(() => null));
    setIdx(0);
    setPhase("running");
    track("ichimon_start", { cert: certId, mode: "ox", size: picked.length, filtered: field ? 1 : 0 });
  }

  function next() {
    if (idx + 1 >= pool.length) {
      track("ichimon_complete", {
        cert: certId,
        mode: "ox",
        size: pool.length,
        correct: results.filter((r) => r?.correct).length,
      });
      setPhase("done");
      return;
    }
    setIdx((v) => v + 1);
  }

  if (phase === "intro") {
    return (
      <div className="bg-surface border border-line rounded-[10px] p-5">
        <p className="text-[14px] text-ink-soft leading-relaxed mb-4">
          {certName}の4択問題の選択肢を、1つずつ<strong className="text-ink">「正しい(○)か誤り(×)か」</strong>で答えます。
          答えるとすぐに正誤と解説が出ます。
        </p>
        <label className="block text-[12px] text-ink-faint mb-4">
          分野
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="ml-2 border border-line rounded-[6px] px-2 py-1 text-[13px] bg-paper text-ink"
          >
            <option value="">すべて（{ox.length}問）</option>
            {fields.map((f) => (
              <option key={f} value={f}>
                {f}（{ox.filter((q) => q.field === f).length}問）
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={start}
          className="bg-ink text-paper rounded-[8px] px-4 py-2 text-[13px] hover:bg-accent transition-colors"
        >
          {Math.min(SIZE, filtered.length)}問に挑戦する →
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const correct = results.filter((r) => r?.correct).length;
    return (
      <div>
        <div className="bg-surface border border-line rounded-[10px] p-6 text-center mb-5">
          <p className="text-[12px] text-ink-faint mb-1">○×の結果</p>
          <p className="text-4xl font-bold font-serif text-ink tabular">
            {correct} <span className="text-2xl text-ink-faint">/ {pool.length}</span>
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={start}
              className="bg-ink text-paper rounded-[8px] px-4 py-2 text-[13px] hover:bg-accent transition-colors"
            >
              もう{Math.min(SIZE, filtered.length)}問 →
            </button>
            <button
              type="button"
              onClick={() => setPhase("intro")}
              className="border border-line rounded-[8px] px-4 py-2 text-[13px] text-ink"
            >
              分野を選び直す
            </button>
          </div>
        </div>
        <ol className="space-y-2">
          {pool.map((q, i) => {
            const r = results[i];
            return (
              <li key={q.id} className="bg-surface border border-line rounded-[10px] p-4 text-[13px]">
                <span className={`font-bold mr-2 ${r?.correct ? "text-correct" : "text-wrong"}`}>
                  {r?.correct ? "正解" : "不正解"}
                </span>
                <span className="text-ink">{q.statement}</span>
                <p className="text-[12px] text-ink-faint mt-1">
                  正解: {q.answer ? "○ 正しい" : "× 誤り"}
                  {"　"}
                  <Link href={q.sourcePath} className="underline">
                    元の4択問題
                  </Link>
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  const q = pool[idx];
  const r = results[idx];
  const explain = sharedExplains[q.sourceId] ?? "";
  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-[12px] text-ink-faint">
        <span className="tabular">
          ○× {idx + 1} / {pool.length}
        </span>
        <span>{q.field}</span>
      </div>
      <div className="h-1.5 rounded-full bg-line mb-5 overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(((idx + 1) / pool.length) * 100)}%` }} />
      </div>

      <div className="bg-surface border border-line rounded-[10px] p-5 mb-4">
        <p className="text-[12px] text-ink-faint mb-2">
          {q.topic ? `${q.topic}に関する次の記述は、正しいか誤りか。` : "次の記述は、正しいか誤りか。"}
        </p>
        <p className="text-[16px] text-ink leading-relaxed">{q.statement}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[true, false].map((v) => {
          const chosen = r && r.given === v;
          const isAns = q.answer === v;
          const bg = !r ? "bg-paper" : isAns ? "bg-correct-wash" : chosen ? "bg-wrong-wash" : "bg-paper";
          return (
            <button
              key={String(v)}
              type="button"
              disabled={!!r}
              onClick={() => setResults((prev) => prev.map((x, i) => (i === idx ? { correct: q.answer === v, given: v } : x)))}
              className={`rounded-[10px] border-2 py-4 text-center transition-colors disabled:cursor-default ${bg}`}
              style={{ borderColor: v ? "#2563eb" : "#dc2626" }}
              aria-label={v ? "正しい" : "誤り"}
            >
              <span className="block text-4xl font-bold leading-none" style={{ color: v ? "#2563eb" : "#dc2626" }}>
                {v ? "○" : "×"}
              </span>
              <span className="block text-[12px] mt-1 text-ink-soft">{v ? "正しい" : "誤り"}</span>
            </button>
          );
        })}
      </div>

      {r && (
        <div className="bg-surface border border-line rounded-[10px] p-5 mb-4">
          <p className={`text-[17px] font-bold mb-2 ${r.correct ? "text-correct" : "text-wrong"}`}>{r.correct ? "正解！" : "不正解"}</p>
          <p className="text-[14px] text-ink mb-3">
            この記述は<strong>{q.answer ? "正しい（○）" : "誤り（×）"}</strong>です。
          </p>
          {explain && (
            <div className="border-t border-line pt-3 text-[14px] text-ink-soft leading-relaxed whitespace-pre-wrap">
              <p className="text-[12px] text-ink-faint mb-1">元の4択問題の解説です（ほかの選択肢の説明も含みます）。</p>
              {explain}
            </div>
          )}
          <p className="text-[12px] mt-3">
            <Link href={q.sourcePath} className="underline text-accent">
              元の4択問題を見る →
            </Link>
          </p>
        </div>
      )}

      {r && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={next}
            className="bg-ink text-paper rounded-[8px] px-4 py-2 text-[13px] hover:bg-accent transition-colors"
          >
            {idx + 1 >= pool.length ? "結果を見る" : "次へ →"}
          </button>
        </div>
      )}
    </div>
  );
}
