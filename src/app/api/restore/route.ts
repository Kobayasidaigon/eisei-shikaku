// =============================================================================
// メールの受験用リンクから受験権を復旧する。
//
// 決済後に送るメールには、cookie に入るのと同じ署名トークンが載っている。
// このエンドポイントはその署名を検証して、開いた端末に cookie を配り直す。
//
// 署名が本物であること自体が「決済済み」の証拠になるため、支払いの再確認は要らない。
// ただし端末数の上限は数える(数えないと、このリンクが無限の受験権になってしまう)。
//
// 【同じ端末で開き直しても消費しない】
// リンクを2回踏んだだけで2台分減るのでは、正規の購入者がすぐ上限に達する。
// すでに有効な cookie を持っている端末では、台帳に触れず期限を延ばすだけにする。
// =============================================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { moshi2ProductOf } from "@/data/products";
import { ACCESS_MAX_AGE_SEC, accessCookieName, verifyAccess } from "@/lib/access";
import { type RedeemOutcome, consumeRedemption, limitReachedMessage } from "@/lib/redemptions";
import { MOSHI2_CONFIG } from "@/data/moshi2-config";

const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

export async function POST(request: Request) {
  let body: { certId?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  const certId = String(body.certId ?? "");
  const token = String(body.token ?? "");
  if (!moshi2ProductOf(certId) || !token) {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  // 署名・有効期限・資格の一致をまとめて検証する
  const payload = verifyAccess(token, certId);
  if (!payload) {
    return NextResponse.json(
      {
        error:
          `このリンクは使えません。有効期限が切れているか、リンクが途中で切れている可能性があります。お手数ですが ${MOSHI2_CONFIG.contactEmail} までご連絡ください。`,
      },
      { status: 403 }
    );
  }

  // すでにこの端末で受験できるなら、台帳を消費せず cookie の期限を延ばすだけ
  const jar = await cookies();
  const alreadyUnlocked = !!verifyAccess(jar.get(accessCookieName(certId))?.value, certId);

  if (!alreadyUnlocked) {
    const outcome = await countAgainstLedger(payload.s);
    if (outcome.status === "limit_reached") {
      return NextResponse.json(
        { error: limitReachedMessage(outcome.resetAt, MOSHI2_CONFIG.contactEmail) },
        { status: 429 }
      );
    }
  }

  const res = NextResponse.json({ ok: true, counted: !alreadyUnlocked });
  res.cookies.set(accessCookieName(certId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SEC,
  });
  return res;
}

/**
 * トークンに入っている Checkout Session ID から PaymentIntent を辿って1台分消費する。
 * Stripe に届かない・鍵が無いといった事情では消費せずに通す(購入者を締め出さない)。
 */
async function countAgainstLedger(sessionId: string | undefined): Promise<RedeemOutcome> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !sessionId?.startsWith("cs_")) return { status: "granted" };

  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true });
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const pi = session.payment_intent;
    const piId = typeof pi === "string" ? pi : pi?.id;
    return await consumeRedemption(stripe.paymentIntents, piId);
  } catch (err) {
    console.error("restore: 台帳を引けませんでした(受験権は発行する)", err);
    return { status: "granted" };
  }
}
