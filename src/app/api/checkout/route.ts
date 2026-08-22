// =============================================================================
// 第2回模試の購入 — Stripe Checkout セッションを作って決済ページの URL を返す。
//
// 価格は src/data/products.ts に置き、price_data でその都度渡す。Stripe 側に
// 商品を登録する手順を増やさないため(値段の変更もコード1箇所で済む)。
// =============================================================================

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { moshi2ProductOf } from "@/data/products";
import { SITE } from "@/data/site";
import { resolveRedirectOrigin } from "@/lib/checkout-origin";

// Stripe SDK のデフォルトに追随させず明示的に固定する。SDK 更新でレスポンス
// 構造が変わってもサーバー側の契約が保たれ、更新は意図的に行える。
const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

/** 決済後の戻り先。判定の本体と理由は src/lib/checkout-origin.ts にある */
function originForRedirect(request: Request): string {
  return resolveRedirectOrigin(
    request.headers.get("origin"),
    process.env,
    SITE.url.replace(/\/$/, "")
  );
}

export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "決済は現在準備中です。" },
      { status: 503 }
    );
  }

  let body: { certId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  const product = moshi2ProductOf(String(body.certId ?? ""));
  if (!product) {
    return NextResponse.json({ error: "この資格の第2回模試はまだ販売していません。" }, { status: 404 });
  }

  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true });

  // 決済後の戻り先。本番では必ず SITE.url を使う。Origin ヘッダは偽装できるため、
  // 本番でそれを信じると任意のサイトへ飛ばせるリダイレクタになってしまう。
  // 開発中だけ、実際にアクセスしている http://localhost:3520 などへ戻す
  // (本番URL固定のままだと、ローカルで決済しても本番へ飛ばされて確認できない)。
  const base = originForRedirect(request);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: product.priceJpy,
            product_data: { name: product.name, description: product.description },
          },
        },
      ],
      // 決済後にこの URL へ戻る。session_id を付けて /api/unlock が検証する。
      success_url: `${base}/${product.certId}/moshi2/?s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/${product.certId}/moshi2/?canceled=1`,
      metadata: { certId: product.certId, kind: "moshi2" },
      payment_intent_data: {
        metadata: { certId: product.certId, kind: "moshi2" },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "決済ページを開けませんでした。" }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("checkout: Stripe セッション作成に失敗", err);
    return NextResponse.json({ error: "決済の準備に失敗しました。" }, { status: 502 });
  }
}
