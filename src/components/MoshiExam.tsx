"use client";

/**
 * 模擬試験(第1回)の受験画面。
 *
 * QuizApp の本番形式モード(ランダム出題・時間無制限)と違い、こちらは
 * 固定問題+カウントダウン+本試験基準の合否判定。有料展開前の需要検証面のため、
 * 開始/完了/時間切れを GA イベント(moshi_start/moshi_complete)で計測する。
 *
 * 途中リロード対策として解答状況を localStorage に保存する。制限時間は
 * startedAt 起点の実時間で進む(リロードしても止まらない=本番と同じ)。
 * 固定ペーパーのため選択肢の並び替えは行わない(全員が同一の紙面)。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  CERTS,
  homeCertOfCategory,
  type CategoryId,
  type CertId,
  type Question,
} from "@/data/certs";
import { loadCertQuestions } from "@/data/question-loader";
import { moshi2ProductOf } from "@/data/products";
import Moshi2Offer from "@/components/Moshi2Offer";
import type { MoshiDef } from "@/data/moshi";
import { moshiDefFor } from "@/data/moshi";
import { EXTRA5 } from "@/data/moshi-extra5";
import { MOSHI_EXTRA_QUESTIONS } from "@/data/moshi-extra-questions";
import MoshiFormatFeedback from "@/components/MoshiFormatFeedback";
import CourseAffiliateCTA from "@/components/CourseAffiliateCTA";
import { SITE } from "@/data/site";

// 5本目の選択肢の挿入位置(全員同一の紙面になるよう問題IDから決定的に算出)
function insertPos(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h % 5;
}

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

interface SavedSession {
  startedAt: number;
  answers: (number | null)[];
}

function formatRemaining(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

/**
 * シカクモンスタジオへの送客リンク。資格名と弱点分野を引き継ぐ。
 *
 * 着地先(Studio)は ?exam= をお試し生成の初期値に、?theme= を作成画面の
 * 分野の初期値に使う。ここで渡さないと、せっかく模試で特定した弱点の文脈が
 * 着地先で切れてしまう(本体シカクモンの模試結果 CTA と同じ流儀)。
 *
 * utm_medium は GA4 のチャネル判定キーなので referral 固定。配置は utm_content。
 */
function studioHref(examName: string, weakField: string | null): string {
  const params = new URLSearchParams({
    utm_source: "eisei",
    utm_medium: "referral",
    utm_content: "moshi_result",
    exam: examName,
  });
  // 分野名はそのまま検索語として使われるので長すぎるものは切る
  if (weakField) params.set("theme", weakField.slice(0, 40));
  return `${SITE.studioUrl}?${params.toString()}`;
}

export default function MoshiExam({
  certId,
  paper,
}: {
  certId: CertId;
  /**
   * 外部から渡す固定ペーパー(有料の第2回など)。省略時は第1回(無料)を
   * MOSHI 定義とローカルの問題データから組み立てる従来の挙動。
   * 渡す場合、questions は選択肢の整形まで済ませたものを渡すこと。
   */
  paper?: { def: MoshiDef; questions: Question[] };
}) {
  const cert = CERTS.find((c) => c.id === certId);
  const def = paper?.def ?? moshiDefFor(certId);

  const sessionKey = `moshiSession_${certId}_r${def?.round ?? 1}_v1`;
  const limitMs = (def?.timeLimitMin ?? 0) * 60 * 1000;

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [idx, setIdx] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState((def?.timeLimitMin ?? 0) * 60);
  const [resumable, setResumable] = useState<SavedSession | null>(null);
  const [expiredNote, setExpiredNote] = useState(false);
  const [result, setResult] = useState<{ timeout: boolean; elapsedMin: number } | null>(null);
  const submittedRef = useRef(false);

  // 固定ペーパー順に問題を並べる(選択肢はシャッフルしない)
  useEffect(() => {
    let alive = true;
    if (!def) return;
    // 有料の第2回は整形済みのペーパーが渡ってくる。無料バンクは読まない。
    if (paper) {
      setQuestions(paper.questions);
      return;
    }
    loadCertQuestions(certId).then((all) => {
      if (!alive) return;
      const byId = new Map(all.map((q) => [q.id, q]));
      // 模試専用問題(組合せ形式・鑑別等)をマージ
      for (const q of MOSHI_EXTRA_QUESTIONS[certId] ?? []) byId.set(q.id, q);
      const paper = def.questionIds.flatMap((id) => {
        const q = byId.get(id);
        return q ? [q] : [];
      });
      // 五肢択一の本試験に合わせた5本目の誤答挿入(EXTRA5に定義がある資格のみ)
      const extra = EXTRA5[certId];
      const shaped = extra
        ? paper.map((q) => {
            const fifth = extra[q.id];
            if (!fifth) return q;
            const pos = insertPos(q.id);
            const choices = [...q.choices];
            choices.splice(pos, 0, fifth);
            return { ...q, choices, answer: q.answer >= pos ? q.answer + 1 : q.answer };
          })
        : paper;
      setQuestions(shaped);
    });
    return () => {
      alive = false;
    };
  }, [certId, def, paper]);

  // 中断セッションの検出。期限切れは破棄して注記だけ出す
  useEffect(() => {
    if (!def) return;
    try {
      const raw = localStorage.getItem(sessionKey);
      if (!raw) return;
      const s = JSON.parse(raw) as SavedSession;
      if (typeof s.startedAt !== "number" || !Array.isArray(s.answers)) return;
      if (Date.now() - s.startedAt < limitMs) {
        setResumable(s);
      } else {
        localStorage.removeItem(sessionKey);
        setExpiredNote(true);
      }
    } catch {
      /* ignore */
    }
  }, [sessionKey, limitMs, def]);

  const saveSession = useCallback(
    (s: SavedSession) => {
      try {
        localStorage.setItem(sessionKey, JSON.stringify(s));
      } catch {
        /* ignore */
      }
    },
    [sessionKey],
  );

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(sessionKey);
    } catch {
      /* ignore */
    }
  }, [sessionKey]);

  const isPassed = useCallback(
    (ans: (number | null)[]) => {
      if (!def || !questions) return false;
      const score = questions.reduce((s, q, i) => s + (ans[i] === q.answer ? 1 : 0), 0);
      if (score < def.passCount) return false;
      return (def.sections ?? []).every((sec) => {
        let c = 0;
        for (let i = sec.start; i < sec.start + sec.count; i++) {
          if (ans[i] === questions[i].answer) c++;
        }
        return c >= sec.passCount;
      });
    },
    [def, questions],
  );

  const submit = useCallback(
    (timeout: boolean) => {
      if (submittedRef.current || !def || !questions) return;
      submittedRef.current = true;
      const score = questions.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);
      const elapsedMin = startedAt
        ? Math.min(def.timeLimitMin, Math.round((Date.now() - startedAt) / 60000))
        : def.timeLimitMin;
      track("moshi_complete", {
        cert: certId,
        round: def.round,
        score,
        passed: isPassed(answers) ? "yes" : "no",
        timeout: timeout ? "yes" : "no",
        minutes: elapsedMin,
      });
      setResult({ timeout, elapsedMin });
      clearSession();
      setPhase("done");
      window.scrollTo({ top: 0 });
    },
    [def, questions, answers, startedAt, certId, isPassed, clearSession],
  );

  // カウントダウン。実時間(startedAt 起点)なのでリロードしても縮み続ける
  useEffect(() => {
    if (phase !== "running" || startedAt == null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((startedAt + limitMs - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) submit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, startedAt, limitMs, submit]);

  if (!cert || !def) return null;

  function start(mode: "new" | "resume") {
    if (!questions || !def) return;
    const now = Date.now();
    if (mode === "resume" && resumable) {
      const restored = questions.map((_, i) => resumable.answers[i] ?? null);
      setAnswers(restored);
      setStartedAt(resumable.startedAt);
      const firstBlank = restored.findIndex((a) => a == null);
      setIdx(firstBlank >= 0 ? firstBlank : 0);
    } else {
      const blank = new Array(questions.length).fill(null) as (number | null)[];
      setAnswers(blank);
      setStartedAt(now);
      setIdx(0);
      saveSession({ startedAt: now, answers: blank });
    }
    submittedRef.current = false;
    setResult(null);
    setPhase("running");
    track("moshi_start", { cert: certId, round: def.round, mode });
    window.scrollTo({ top: 0 });
  }

  function select(choiceIdx: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = choiceIdx;
      if (startedAt != null) saveSession({ startedAt, answers: next });
      return next;
    });
  }

  function confirmSubmit() {
    const unanswered = answers.filter((a) => a == null).length;
    if (
      unanswered > 0 &&
      !window.confirm(`未解答が${unanswered}問あります。未解答は不正解として採点されます。このまま採点しますか?`)
    ) {
      return;
    }
    submit(false);
  }

  /* ===================== Intro ===================== */
  if (phase === "intro") {
    const ready = questions !== null;
    return (
      <section className="bg-surface border border-line rounded-[10px] p-5 sm:p-6">
        <h2 className="font-serif text-[17px] font-medium text-ink mb-3">受験上の注意</h2>
        <ul className="text-[13px] text-ink-soft leading-relaxed space-y-1.5 list-disc pl-5 mb-4">
          <li>{def.questionIds.length}問・{def.timeLimitMin}分。開始と同時にタイマーが動き出します。</li>
          <li>合格基準は{def.passLabel}{def.sections ? "。科目ごとの基準もすべて満たす必要があります" : ""}。終了後に合否判定と全問の解説が出ます。</li>
          <li>解答中は正解・解説を確認できません。問題番号の一覧からいつでも前の問題に戻れます。</li>
          <li>途中でページを閉じても解答は保存され再開できます。ただし制限時間は止まりません(本番と同じ条件です)。</li>
          <li>時間切れになった時点で自動的に採点されます。未解答は不正解扱いです。</li>
        </ul>
        {expiredNote && (
          <p className="text-[12px] text-wrong mb-4">
            前回の途中データは制限時間を過ぎていたため無効になりました。最初からの受験になります。
          </p>
        )}
        {resumable ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => start("resume")}
              disabled={!ready}
              className="bg-ink text-paper rounded-[8px] px-4 py-2.5 text-[13px] hover:bg-accent transition-colors disabled:opacity-50"
            >
              続きから再開する(残り {formatRemaining(Math.max(0, Math.ceil((resumable.startedAt + limitMs - Date.now()) / 1000)))}) →
            </button>
            <button
              onClick={() => {
                clearSession();
                setResumable(null);
                start("new");
              }}
              disabled={!ready}
              className="text-[13px] text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-50"
            >
              破棄して最初から
            </button>
          </div>
        ) : (
          <button
            onClick={() => start("new")}
            disabled={!ready}
            className="bg-ink text-paper rounded-[8px] px-4 py-2.5 text-[13px] hover:bg-accent transition-colors disabled:opacity-50"
          >
            {ready ? `試験を開始する(${def.timeLimitMin}分) →` : "問題を読み込み中…"}
          </button>
        )}
      </section>
    );
  }

  if (!questions) return null;

  /* ===================== Running ===================== */
  if (phase === "running") {
    const q = questions[idx];
    const selected = answers[idx];
    const answeredCount = answers.filter((a) => a != null).length;
    const isLast = idx === questions.length - 1;
    const timeWarning = remainingSec <= 5 * 60;

    return (
      <div>
        {/* タイマー(スクロールしても見えるよう sticky) */}
        <div className="sticky top-0 z-10 bg-paper border-b border-line py-2 mb-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[12px] text-ink-faint">
              問 {idx + 1} / {questions.length}　解答済 {answeredCount}
            </span>
            <span className={`tabular font-medium ${timeWarning ? "text-wrong" : "text-ink"}`}>
              残り {formatRemaining(remainingSec)}
            </span>
          </div>
        </div>

        {/* 問題番号ナビ(マークシート風) */}
        <div className={`grid gap-1 mb-5 ${questions.length > 60 ? "grid-cols-10 sm:grid-cols-20" : "grid-cols-10"}`}>
          {questions.map((_, i) => {
            const isCurrent = i === idx;
            const isAnswered = answers[i] != null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={`h-7 rounded-[6px] text-[11px] tabular border transition-colors ${
                  isAnswered ? "bg-accent text-white border-accent" : "bg-surface text-ink-faint border-line"
                } ${isCurrent ? "outline outline-1 outline-ink" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <section className="bg-surface border border-line border-l-2 border-l-accent rounded-[10px] p-5 mb-5">
          <p className="text-[11px] text-ink-faint tracked mb-2">{catName(q.category)}</p>
          <p className="font-serif text-[15px] text-ink leading-relaxed whitespace-pre-wrap">{q.q}</p>
        </section>

        <div className="space-y-2 mb-6">
          {q.choices.map((choice, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => select(i)}
                className={`w-full text-left text-[13.5px] px-3.5 py-2.5 rounded-[8px] border transition-colors flex items-start gap-2 ${
                  isSelected
                    ? "border-accent bg-accent-wash text-accent-ink"
                    : "border-line bg-surface text-ink-soft hover:border-line-strong"
                }`}
              >
                <span className="tabular shrink-0">{i + 1}.</span>
                <span className="flex-1">{choice}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIdx((v) => Math.max(0, v - 1))}
            disabled={idx === 0}
            className="text-[13px] text-ink-soft disabled:opacity-40 hover:text-ink"
          >
            ← 前へ
          </button>
          <div className="flex items-center gap-3">
            {!isLast && (
              <button
                type="button"
                onClick={() => setIdx((v) => v + 1)}
                className="bg-accent text-white rounded-[8px] px-4 py-2 text-[13px] hover:bg-accent-ink transition-colors"
              >
                次へ →
              </button>
            )}
            <button
              type="button"
              onClick={confirmSubmit}
              className={
                isLast
                  ? "bg-accent text-white rounded-[8px] px-4 py-2 text-[13px] hover:bg-accent-ink transition-colors"
                  : "text-[13px] px-3 py-2 rounded-[8px] border border-line text-ink-soft hover:border-line-strong"
              }
            >
              採点する({answeredCount}/{questions.length})
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ===================== Done (合否判定・詳解) ===================== */
  const score = questions.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);
  const pct = Math.round((score / questions.length) * 100);
  const passed = isPassed(answers);
  const passPct = Math.round((def.passCount / questions.length) * 100);

  const sectionStats = (def.sections ?? []).map((sec) => {
    let c = 0;
    for (let i = sec.start; i < sec.start + sec.count; i++) {
      if (answers[i] === questions[i].answer) c++;
    }
    return { ...sec, correct: c, ok: c >= sec.passCount };
  });

  const catStats: Record<string, { correct: number; total: number }> = {};
  questions.forEach((q, i) => {
    const cs = catStats[q.category] ?? (catStats[q.category] = { correct: 0, total: 0 });
    cs.total++;
    if (answers[i] === q.answer) cs.correct++;
  });
  const catsSorted = Object.entries(catStats).sort(
    (a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total,
  );
  const weakest = catsSorted.find(([, s]) => s.correct < s.total);

  return (
    <div>
      <section className="bg-surface border border-line rounded-[10px] p-6 text-center mb-5">
        {result?.timeout && (
          <p className="text-[12px] text-wrong mb-2">時間切れのため自動採点しました</p>
        )}
        <p className="text-[11px] text-ink-faint tracked mb-1">あなたの得点</p>
        <p className="font-serif text-[36px] font-medium text-accent-ink leading-tight mb-1">
          {score} <span className="text-[20px] text-ink-faint">/ {questions.length}</span>
        </p>
        <p className={`text-[13px] font-medium mb-3 ${passed ? "text-correct" : "text-wrong"}`}>
          正答率 {pct}%
        </p>
        <p
          className={`inline-block text-[13px] font-medium px-4 py-1.5 rounded-full border ${
            passed ? "text-correct bg-correct-wash border-correct/30" : "text-wrong bg-wrong-wash border-wrong/30"
          }`}
        >
          {passed ? "判定: 合格圏" : "判定: あと一歩"}
        </p>
        <p className="text-[12px] text-ink-faint mt-3">
          合格基準は{def.passLabel}。所要時間 約{result?.elapsedMin ?? def.timeLimitMin}分。
          ※この判定はオリジナル問題による目安です。
        </p>
        {/* 結果のシェア(テキストのみ) */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <a
            href={`https://x.com/intent/post?text=${encodeURIComponent(
              `${cert.name}の模擬試験(第${def.round}回)で${score}/${questions.length}問正解(${pct}%)${passed ? "・合格圏" : ""}でした。${SITE.name}で無料受験中`
            )}&url=${encodeURIComponent(`${SITE.url}/${certId}/moshi/`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("share_click", { cert: certId, channel: "x", place: "moshi" })}
            className="text-[12px] text-accent-ink border border-accent/40 rounded-[6px] px-3 py-1.5 no-underline transition hover:bg-accent-wash"
          >
            この結果をXに投稿する
          </a>
        </div>
      </section>

      {/* 本試験経験者への形式アンケート(出題形式の一次情報収集) */}
      <MoshiFormatFeedback certId={certId} round={def.round} />

      {/* 科目別の判定 */}
      {sectionStats.length > 0 && (
        <section className="bg-surface border border-line rounded-[10px] p-5 mb-5">
          <h3 className="text-[13px] font-medium text-ink mb-3">科目別の判定</h3>
          <div className="space-y-2">
            {sectionStats.map((sec) => (
              <div key={sec.label} className="flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">{sec.label}</span>
                <span className={`tabular ${sec.ok ? "text-correct" : "text-wrong"}`}>
                  {sec.correct}/{sec.count}(基準 {sec.passCount}) {sec.ok ? "クリア" : "未達"}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-ink-faint mt-3">
            本試験は総合得点に加えて、すべての科目で基準を満たす必要があります。
          </p>
        </section>
      )}

      {/* 分野別の正答率 */}
      <section className="bg-surface border border-line rounded-[10px] p-5 mb-5">
        <h3 className="text-[13px] font-medium text-ink mb-3">分野別の正答率</h3>
        <div className="space-y-3">
          {catsSorted.map(([cat, s]) => {
            const p = Math.round((s.correct / s.total) * 100);
            return (
              <div key={cat}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="text-ink-soft">{catName(cat)}</span>
                  <span className="text-ink-faint tabular">{s.correct}/{s.total}・{p}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-accent-wash overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${p}%`,
                      backgroundColor: p >= passPct ? "var(--color-correct)" : "var(--color-wrong)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {weakest && (
          <p className="text-[13px] text-ink-soft leading-relaxed mt-4 pt-3 border-t border-line">
            いちばんの弱点は「{catName(weakest[0])}」({weakest[1].correct}/{weakest[1].total}正解)。
            {/* 共通科目の分野ページは所有者(第二種)側のURLにしか存在しないため解決してからリンクする */}
            <Link
              href={`/${homeCertOfCategory(weakest[0] as CategoryId)}/${weakest[0]}/`}
              className="underline underline-offset-2 hover:text-ink"
            >
              この分野の一問一答で復習する →
            </Link>
          </p>
        )}
      </section>

      {/* 講座アフィリ(合否判定と弱点を見た直後 = 本サイトで最も意欲が高い瞬間)。
          affiliate.ts のリンクが未設定の間は何も描画されない */}
      <CourseAffiliateCTA certId={certId} placement="moshi_result" className="mb-5" />

      {/* シカクモンスタジオ(弱点が分野名で見えた直後。講座アフィリが主役なのでこちらは
          塗らずに bg-surface で静かに置く)。弱点分野を ?theme= で引き継ぐので、
          着地先で入力し直さずにその分野の問題を作れる。 */}
      <a
        href={studioHref(cert.name, weakest ? catName(weakest[0]) : null)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("studio_cta_click", { placement: "moshi_result" })}
        className="block rounded-[10px] border border-line-strong bg-surface p-5 mb-5 transition hover:border-accent"
      >
        <div className="text-[11px] tracked text-ink-faint">関連サービス</div>
        <div className="font-serif text-[16px] font-medium text-ink mt-1">
          {weakest
            ? `「${catName(weakest[0])}」を、自分の教材で潰す`
            : "自分の教材から、弱点だけの問題集を作る"}
        </div>
        <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
          手元の教科書やノートの写真・PDFから、AIが4択問題と解説を生成。間違えた問題は忘却曲線で自動復習できます。このドリルに無い資格も学べる姉妹サービスです。
        </p>
        <span className="inline-block mt-3 text-[13px] text-accent">
          シカクモン Studio を無料で試す →
        </span>
      </a>

      {/* 全問詳解 */}
      <section className="mb-5">
        <h3 className="font-serif text-[17px] font-medium text-ink mb-3">全問詳解</h3>
        <div className="space-y-2">
          {questions.map((q, i) => {
            const sel = answers[i];
            const correct = sel === q.answer;
            return (
              <details key={q.id} className="bg-surface border border-line rounded-[10px] p-4">
                <summary className="cursor-pointer text-[13px] leading-relaxed list-none">
                  <span className={`tabular mr-2 ${correct ? "text-correct" : "text-wrong"}`}>
                    {correct ? "✓" : "✕"} 問{i + 1}
                  </span>
                  <span className="text-[11px] text-ink-faint mr-2">{catName(q.category)}</span>
                  <span className="text-ink-soft">{q.q.slice(0, 55)}{q.q.length > 55 ? "…" : ""}</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-line text-[13px] leading-relaxed">
                  <p className="text-ink-faint text-[12px] mb-2">
                    あなたの解答: {sel != null ? `${sel + 1}. ${q.choices[sel]}` : "未解答"}
                    {!correct && (
                      <>
                        <br />
                        正解: {q.answer + 1}. {q.choices[q.answer]}
                      </>
                    )}
                  </p>
                  <p className="text-ink-soft whitespace-pre-wrap">{q.explain}</p>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {/* 販売中なら購入導線、まだ無ければ「制作中」。両方出すと矛盾するため排他にする。 */}
      {moshi2ProductOf(certId) ? (
        <Moshi2Offer certId={certId} place="moshi_result" className="mb-5" />
      ) : (
        <p className="text-[12px] text-ink-faint mb-5">第2回の模擬試験は現在制作中です。</p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => start("new")}
          className="bg-ink text-paper rounded-[8px] px-4 py-2.5 text-[13px] hover:bg-accent transition-colors"
        >
          もう一度受験する →
        </button>
        <Link href={`/${certId}/`} className="text-[13px] text-ink-soft underline underline-offset-2 hover:text-ink">
          {cert.name}の一問一答へ →
        </Link>
      </div>
    </div>
  );
}
