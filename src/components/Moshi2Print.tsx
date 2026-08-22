"use client";

/**
 * 第2回模試(有料)の印刷用ページ。
 *
 * 「解くのは画面、復習は紙」という使い方に応えるための出力。問題編・解答用紙・
 * 解答解説を A4 に組み、ブラウザの印刷機能から紙にも PDF にも出せる。
 * 追加ライブラリは入れていない(サーバーで日本語PDFを組むとフォント埋め込みで
 * 数MBを抱えることになり、得られるものに対して代償が大きいため)。
 *
 * 問題データは画面版とまったく同じ経路 — /api/moshi2/[certId] が購入者判定を
 * 通したときだけ配信する — で取得する。このバンドルに有料の問題は入っていない。
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORIES, type CertId, type Question } from "@/data/certs";
import type { MoshiDef } from "@/data/moshi";
import { AUTHOR, SITE } from "@/data/site";
import { moshi2ProductOf } from "@/data/products";

type Paper = { def: MoshiDef; questions: Question[]; dev?: boolean };
type Status = "loading" | "locked" | "ready" | "notReady" | "error";

const MARK = ["ア", "イ", "ウ", "エ", "オ"];
const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

export default function Moshi2Print({ certId }: { certId: CertId }) {
  const product = moshi2ProductOf(certId);
  const [status, setStatus] = useState<Status>("loading");
  const [paper, setPaper] = useState<Paper | null>(null);

  // 印刷する範囲。3つとも切れるようにしてあるのは、解説だけ刷り直したい・
  // 解答用紙だけ複数枚欲しい、という実際の使い方に対応するため。
  const [withQuestions, setWithQuestions] = useState(true);
  const [withAnswerSheet, setWithAnswerSheet] = useState(true);
  const [withExplanations, setWithExplanations] = useState(true);
  const [twoColumn, setTwoColumn] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/moshi2/${certId}/`, { cache: "no-store" })
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 402) return setStatus("locked");
        if (res.status === 503) return setStatus("notReady");
        if (!res.ok) return setStatus("error");
        setPaper((await res.json()) as Paper);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [certId]);

  if (!product) return null;

  if (status === "loading") {
    return (
      <section className="bg-surface border border-line rounded-[10px] p-5 text-[13px] text-ink-soft">
        読み込み中…
      </section>
    );
  }

  if (status === "locked") {
    return (
      <section className="bg-surface border border-line rounded-[10px] p-5">
        <p className="text-[13px] text-ink-soft leading-relaxed">
          印刷用の紙面は、第2回模試を購入された方がご利用いただけます。
          <Link href={`/${certId}/moshi2/`} className="underline underline-offset-2 hover:text-ink">
            第2回模擬試験のご案内
          </Link>
          へ。
        </p>
      </section>
    );
  }

  if (status === "notReady" || status === "error" || !paper) {
    return (
      <section className="bg-surface border border-line rounded-[10px] p-5">
        <p className="text-[13px] text-ink-soft leading-relaxed">
          紙面を読み込めませんでした。時間をおいて開き直してください。
        </p>
      </section>
    );
  }

  const { def, questions } = paper;
  const nothingSelected = !withQuestions && !withAnswerSheet && !withExplanations;

  // 分野ごとの出題数(表紙の内訳に出す)
  const catCounts = questions.reduce<Record<string, number>>((m, q) => {
    m[q.category] = (m[q.category] ?? 0) + 1;
    return m;
  }, {});

  return (
    <>
      {/* ------------------------------------------------------------------
          操作パネル(画面のみ)
         ------------------------------------------------------------------ */}
      {paper.dev && (
        <p className="print-hide mb-4 rounded-[8px] border border-wrong/40 bg-wrong-wash px-4 py-2.5 text-[12px] text-wrong">
          開発モードで解除中です(DEV_UNLOCK_MOSHI2)。決済を通さずに表示しています。
          この表示は本番では出ません。
        </p>
      )}

      <section className="print-hide bg-surface border border-line rounded-[10px] p-5 mb-6">
        <h2 className="font-serif text-[17px] font-medium text-ink mb-2">印刷・PDF保存</h2>
        <p className="text-[12px] text-ink-faint leading-relaxed mb-3">
          サイトのヘッダー・フッターやこの操作パネルは紙には出ません。
          印刷ダイアログの「ヘッダーとフッター」は既定のオフのままで構いません
          (オンにするとページ番号が入りますが、URL と日付も一緒に印字されます)。
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed mb-4">
          下のボタンから印刷できます。印刷ダイアログで送信先を「PDFに保存」にすると、
          そのまま PDF ファイルとして手元に残せます。A4・モノクロ想定で組んでいます。
        </p>

        <div className="space-y-2 mb-4 text-[13px] text-ink-soft">
          {[
            { on: withQuestions, set: setWithQuestions, label: `問題編(全${questions.length}問)` },
            { on: withAnswerSheet, set: setWithAnswerSheet, label: "解答用紙(マークシート形式)" },
            { on: withExplanations, set: setWithExplanations, label: "解答・解説編" },
          ].map((row) => (
            <label key={row.label} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={row.on}
                onChange={(e) => row.set(e.target.checked)}
                className="accent-accent"
              />
              <span>{row.label}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-line mt-2">
            <input
              type="checkbox"
              checked={twoColumn}
              onChange={(e) => setTwoColumn(e.target.checked)}
              className="accent-accent"
            />
            <span>2段組で印刷する(紙の枚数がおよそ半分になります)</span>
          </label>
        </div>

        <button
          onClick={() => {
            track("moshi2_print", {
              cert: certId,
              questions: withQuestions ? 1 : 0,
              sheet: withAnswerSheet ? 1 : 0,
              explanations: withExplanations ? 1 : 0,
              two_column: twoColumn ? 1 : 0,
            });
            window.print();
          }}
          disabled={nothingSelected}
          className="bg-ink text-paper rounded-[8px] px-5 py-2.5 text-[13px] hover:bg-accent transition-colors disabled:opacity-50"
        >
          印刷 / PDFとして保存 →
        </button>
        {nothingSelected && (
          <p className="text-[12px] text-wrong mt-3">印刷する範囲を1つ以上選んでください。</p>
        )}

        <p className="text-[12px] text-ink-faint mt-4 leading-relaxed border-t border-line pt-3">
          画面で解いて自動採点を受けたい場合は
          <Link href={`/${certId}/moshi2/`} className="underline underline-offset-2 hover:text-ink">
            第2回模擬試験のページ
          </Link>
          へ。採点結果は紙で解いた場合には記録されません。
        </p>
      </section>

      {/* ------------------------------------------------------------------
          表紙
         ------------------------------------------------------------------ */}
      <section className="print-avoid-break mb-10">
        <div className="border-t-2 border-b border-ink py-6 mb-6">
          <p className="text-[11px] tracked text-ink-soft mb-2">{SITE.name}</p>
          <h1 className="font-serif text-[26px] font-medium text-ink leading-snug mb-2">
            {product.name}
          </h1>
          <p className="text-[13px] text-ink-soft">
            {questions.length}問 / {def.timeLimitMin}分 / 合格基準 {def.passLabel}
          </p>
        </div>

        <table className="w-full text-[12px] text-ink-soft mb-6">
          <tbody>
            {Object.entries(catCounts).map(([cat, n]) => (
              <tr key={cat} className="border-b border-line">
                <td className="py-1.5">{catName(cat)}</td>
                <td className="py-1.5 text-right tabular">{n}問</td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 text-ink font-medium">合計</td>
              <td className="py-1.5 text-right text-ink font-medium tabular">
                {questions.length}問
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-[11px] text-ink-soft leading-relaxed space-y-1.5">
          <p>
            本模試は{SITE.name}のオリジナル問題で構成しており、実際の試験問題の転載ではありません。
            合否判定はあくまで学習の目安です。
          </p>
          <p>{def.specNote}</p>
          <p>
            作成・監修: {AUTHOR.name}({AUTHOR.jobTitle})／{SITE.url}
          </p>
          <p>
            この紙面は購入者ご本人の学習用です。複製・再配布・転売はご遠慮ください。
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          問題編
         ------------------------------------------------------------------ */}
      {withQuestions && (
        <section className="print-break-before mb-10">
          <h2 className="font-serif text-[19px] font-medium text-ink border-b border-ink pb-2 mb-5">
            問題編
          </h2>
          <p className="print-hide text-[12px] text-ink-faint mb-5 leading-relaxed">
            解答は次の解答用紙に記入してください。制限時間 {def.timeLimitMin}分。
          </p>
          <div className={twoColumn ? "print-two-col" : ""}>
            {questions.map((q, i) => (
              <div key={q.id} className="print-avoid-break mb-5 text-[12px] leading-relaxed">
                <p className="text-ink mb-1.5">
                  <span className="tabular text-ink-soft mr-2">問{i + 1}</span>
                  <span className="font-serif">{q.q}</span>
                </p>
                <ol className="pl-5 space-y-0.5 text-ink-soft">
                  {q.choices.map((c, ci) => (
                    <li key={ci} className="list-none -indent-5">
                      <span className="tabular mr-1.5">{MARK[ci]}.</span>
                      {c}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------
          解答用紙
         ------------------------------------------------------------------ */}
      {withAnswerSheet && (
        <section className="print-break-before mb-10">
          <h2 className="font-serif text-[19px] font-medium text-ink border-b border-ink pb-2 mb-3">
            解答用紙
          </h2>
          <p className="text-[11px] text-ink-soft mb-5">
            該当する記号を塗りつぶすか、丸で囲んでください。　受験日 ______ 年 ___ 月 ___ 日
            得点 ______ / {questions.length}
          </p>
          {/* 140問がA4 1枚に収まる密度。列を増やして行数を落としている
              (4段だと35行になり、1ページに入りきらず2枚に割れた) */}
          <div className="print-avoid-break grid grid-cols-7 gap-x-2.5 gap-y-0 text-[10px]">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className="flex items-center gap-1 border-b border-line py-[9px]"
              >
                <span className="tabular w-5 shrink-0 text-right text-ink-faint">{i + 1}</span>
                <span className="flex gap-[3px] text-ink-soft">
                  {q.choices.map((_, ci) => (
                    <span
                      key={ci}
                      className="inline-block h-4 w-4 rounded-full border border-ink-soft text-center text-[9px] leading-[15px]"
                    >
                      {MARK[ci]}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------
          解答・解説編
         ------------------------------------------------------------------ */}
      {withExplanations && (
        <section className="print-break-before">
          <h2 className="font-serif text-[19px] font-medium text-ink border-b border-ink pb-2 mb-3">
            解答・解説編
          </h2>

          {/* 先に正解一覧。答え合わせは一覧のほうが速い */}
          <div className="print-avoid-break mb-7">
            <h3 className="text-[13px] font-medium text-ink mb-2">正解一覧</h3>
            <div className="grid grid-cols-8 gap-x-3 gap-y-0.5 text-[11px] tabular">
              {questions.map((q, i) => (
                <div key={q.id} className="border-b border-line py-0.5">
                  <span className="text-ink-soft mr-1.5">{i + 1}</span>
                  <span className="text-ink font-medium">{MARK[q.answer]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={twoColumn ? "print-two-col" : ""}>
            {questions.map((q, i) => (
              <div key={q.id} className="print-avoid-break mb-4 text-[11px] leading-relaxed">
                <p className="text-ink mb-1">
                  <span className="tabular text-ink-soft mr-2">問{i + 1}</span>
                  <span className="text-ink font-medium">正解 {MARK[q.answer]}</span>
                  <span className="text-ink-faint ml-2">［{catName(q.category)}］</span>
                </p>
                <p className="font-serif text-ink-soft mb-1">{q.q}</p>
                <p className="text-ink-soft">{q.explain}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
