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
import { loadMoshi2, shapeForDisplay } from "@/data/moshi2";
import { moshi2ProductOf } from "@/data/products";
import { accessCookieName, verifyAccess } from "@/lib/access";

export async function GET(_request: Request, { params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;

  const product = moshi2ProductOf(certId);
  if (!product) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const jar = await cookies();
  const token = jar.get(accessCookieName(certId))?.value;
  if (!verifyAccess(token, certId)) {
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
  const questions = shapeForDisplay(paper);

  return NextResponse.json(
    {
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
