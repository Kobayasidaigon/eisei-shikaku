// =============================================================================
// Stripe の webhook。決済が成立したら、購入者に受験用リンクをメールで送る。
//
// 【なぜ /api/unlock ではなく webhook か】
// /api/unlock はブラウザが決済から戻ってきたときにしか動かない。決済直後に
// タブを閉じた・リダイレクトに失敗した場合は cookie が付かず、払ったのに
// 受験できない状態になる。webhook は Stripe がサーバーへ直接叩きに来るので、
// ブラウザの挙動に関係なく必ず発火する。ここが最後の砦。
//
// メールに載せるリンクには受験権そのもの(署名済みトークン)を入れる。
// 端末を変えても、cookie を消しても、このリンクを開けば復旧できる。
//
// 必要な環境変数:
//   STRIPE_SECRET_KEY      署名検証に使う SDK の初期化
//   STRIPE_WEBHOOK_SECRET  署名シークレット(whsec_…)。未設定なら何もしない
//   RESEND_API_KEY         未設定ならメールを送らない(webhook自体は成功を返す)
// =============================================================================

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { SITE } from "@/data/site";
import { moshi2ProductOf } from "@/data/products";
import { ACCESS_MAX_AGE_SEC, signAccess } from "@/lib/access";
import { MAX_REDEMPTIONS, REDEMPTION_WINDOW_DAYS } from "@/lib/redemptions";
import { sendMail } from "@/lib/email";
import { MOSHI2_CONFIG } from "@/data/moshi2-config";

const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

/** 受験権の有効期間を「およそ何ヶ月」と日本語で言うための概算 */
const ACCESS_MONTHS = Math.round(ACCESS_MAX_AGE_SEC / (30 * 24 * 60 * 60));

export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whSecret) {
    // 鍵を入れる前でも 200 を返す。Stripe 側で「失敗し続けている」扱いに
    // なってエンドポイントを無効化されるのを避けるため。
    return NextResponse.json({ received: true, configured: false });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "signature_missing" }, { status: 400 });
  }

  // 署名検証には生のボディが要る。JSON にパースしてはいけない。
  const raw = await request.text();
  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, whSecret);
  } catch (err) {
    // 署名が合わない = Stripe 以外からのリクエスト。ここで必ず弾く
    console.error("stripe-webhook: 署名の検証に失敗", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const certId = session.metadata?.certId;
  const product = certId ? moshi2ProductOf(certId) : undefined;
  const email = session.customer_details?.email ?? session.customer_email;
  if (!product || session.metadata?.kind !== "moshi2" || !email) {
    // 別商品や、メールが取れなかった場合。webhook 自体は成功扱いにする
    return NextResponse.json({ received: true, mailed: false });
  }

  // 受験権そのもの(cookie に入るのと同じ署名トークン)をリンクに載せる
  const token = signAccess({ c: product.certId, s: session.id, t: Math.floor(Date.now() / 1000) });
  const base = SITE.url.replace(/\/$/, "");
  const link = `${base}/${product.certId}/moshi2/?k=${encodeURIComponent(token)}`;

  const text = [
    `${product.name} をご購入いただき、ありがとうございます。`,
    ``,
    `下のリンクを開くと、その端末で受験できるようになります。`,
    `${link}`,
    ``,
    `このメールは受験用の控えです。端末を変えたときや、ブラウザのデータを`,
    `消したあとでも、同じリンクから受験を再開できます(およそ${ACCESS_MONTHS}ヶ月有効)。`,
    `端末の切り替えは${REDEMPTION_WINDOW_DAYS}日で${MAX_REDEMPTIONS}回までです。他の方には転送しないでください。`,
    ``,
    `※シークレットウィンドウでは開かないでください。ウィンドウを閉じた時点で`,
    `　受験権が消え、台数を1つ消費してしまいます。`,
    ``,
    `紙で解きたい場合は、受験ページの「印刷用ページを開く」から`,
    `問題・解答用紙・解説を A4 に組んだ紙面を印刷できます。`,
    ``,
    `うまく開けないときは、このメールに返信いただくか`,
    `${MOSHI2_CONFIG.contactEmail} までご連絡ください。`,
    ``,
    `— ${SITE.name}`,
    base,
  ].join("\n");

  const html = `
<div style="font-family:sans-serif;line-height:1.8;color:#2b2722;max-width:560px">
  <p>${escapeHtml(product.name)} をご購入いただき、ありがとうございます。</p>
  <p>下のボタンから、その端末で受験できるようになります。</p>
  <p style="margin:24px 0">
    <a href="${escapeHtml(link)}"
       style="background:#2b2722;color:#faf8f4;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">
      受験をはじめる
    </a>
  </p>
  <p style="font-size:13px;color:#6b6355">
    このメールは受験用の控えです。端末を変えたときや、ブラウザのデータを消したあとでも、
    同じリンクから受験を再開できます(およそ${ACCESS_MONTHS}ヶ月有効)。
    端末の切り替えは${REDEMPTION_WINDOW_DAYS}日で${MAX_REDEMPTIONS}回までです。他の方には転送しないでください。
  </p>
  <p style="font-size:13px;color:#a23a28">
    シークレットウィンドウでは開かないでください。ウィンドウを閉じた時点で受験権が消え、
    台数を1つ消費してしまいます。
  </p>
  <p style="font-size:13px;color:#6b6355">
    紙で解きたい場合は、受験ページの「印刷用ページを開く」から、
    問題・解答用紙・解説を A4 に組んだ紙面を印刷できます。
  </p>
  <p style="font-size:13px;color:#6b6355">
    うまく開けないときは、このメールに返信いただくか ${escapeHtml(MOSHI2_CONFIG.contactEmail)} までご連絡ください。
  </p>
  <p style="font-size:12px;color:#8d8577;border-top:1px solid #e5e0d6;padding-top:12px">
    ${escapeHtml(SITE.name)}　${escapeHtml(base)}
  </p>
</div>`.trim();

  const mailed = await sendMail({
    to: email,
    subject: `${product.name} の受験用リンク`,
    text,
    html,
  });

  if (!mailed) {
    // 送れなくても Stripe には成功を返す。ここで 500 を返すと Stripe が
    // 何度も再送してきて、送れたときに重複メールになる。
    console.error("stripe-webhook: 受験用リンクのメールを送れませんでした", session.id);
  }

  return NextResponse.json({ received: true, mailed });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
