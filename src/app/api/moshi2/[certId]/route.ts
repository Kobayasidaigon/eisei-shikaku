// =============================================================================
// 第2回模試(有料)の配信。購入者の署名 cookie を検証してからペーパーを返す。
//
// 未購入は 402 を返す。受験画面はこのステータスを見て「購入」と「受験」を
// 出し分けるので、有料の問題データが未購入者のバンドルに載ることはない。
//
// 3肢択一への間引き(drop3)はここで適用してから返す。未使用の誤答を
// クライアントに送らないため、そして表示ロジックを第1回と揃えるため。
// =============================================================================

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Question } from "@/data/certs";
import { loadMoshi2 } from "@/data/moshi2";
import { moshi2ProductOf } from "@/data/products";
import { accessCookieName, isDevUnlockEnabled, verifyAccess } from "@/lib/access";

/** 3肢択一の本試験に合わせて誤答を1本落とす(第1回と同じ整形)。 */
/**
 * 五肢択一の本試験に合わせて5本目の誤答を挿し込む。drop3 とは逆向きの操作。
 * 挿入位置は問題IDから決定的に算出する(無料の第1回と同じ式)。全員が同じ紙面になる。
 */
function insertPos(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h % 5;
}

function applyExtra5(questions: Question[], extra?: Record<string, string>): Question[] {
  if (!extra) return questions;
  return questions.map((q) => {
    const fifth = extra[q.id];
    if (!fifth) return q;
    const pos = insertPos(q.id);
    const choices = [...q.choices];
    choices.splice(pos, 0, fifth);
    // 挿入位置が正解以前なら、正解の index が1つ後ろへずれる
    return { ...q, choices, answer: q.answer >= pos ? q.answer + 1 : q.answer };
  });
}

function applyDrop3(questions: Question[], drop?: Record<string, number>): Question[] {
  if (!drop) return questions;
  return questions.map((q) => {
    const d = drop[q.id];
    if (d == null || d === q.answer || d < 0 || d >= q.choices.length) return q;
    return {
      ...q,
      choices: q.choices.filter((_, i) => i !== d),
      answer: q.answer > d ? q.answer - 1 : q.answer,
    };
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;

  const product = moshi2ProductOf(certId);
  if (!product) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 開発時のみ、決済を通さずに中身を確認できる(本番では必ず false)
  const devUnlocked = isDevUnlockEnabled();
  const jar = await cookies();
  const token = jar.get(accessCookieName(certId))?.value;
  if (!devUnlocked && !verifyAccess(token, certId)) {
    // 未購入。商品情報だけ返して購入画面を描けるようにする。
    return NextResponse.json(
      { error: "payment_required", product: { name: product.name, priceJpy: product.priceJpy } },
      { status: 402 }
    );
  }

  const paper = await loadMoshi2(certId as Parameters<typeof loadMoshi2>[0]);
  if (!paper) {
    return NextResponse.json({ error: "not_ready" }, { status: 503 });
  }

  // 3択へ間引く資格と、5択へ足す資格がある。両方を同時に持つことはない
  const questions = applyExtra5(applyDrop3(paper.questions, paper.drop3), paper.extra5);

  return NextResponse.json(
    {
      // 画面側に「決済を通さず開いている」と出すための印。本番では常に undefined
      dev: devUnlocked ? true : undefined,
      def: {
        round: paper.round,
        timeLimitMin: paper.timeLimitMin,
        passCount: paper.passCount,
        passLabel: paper.passLabel,
        isFullSpec: paper.isFullSpec,
        specNote: paper.specNote,
        sections: paper.sections,
        questionIds: questions.map((q) => q.id),
      },
      questions,
    },
    // 購入者ごとの内容。CDN にもブラウザにも残さない。
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
