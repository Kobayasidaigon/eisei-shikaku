// =============================================================================
// 決済の確認と受験権の付与。
//
// 決済後に戻ってくる success_url の session_id を Stripe に問い合わせ、
// 「支払い済み」かつ「この資格の第2回模試の決済」であることを確認できたときだけ
// 署名 cookie を発行する。URL のパラメータは信用しない(session_id を Stripe に
// 照会して初めて事実になる)。
//
// 引き換え回数は PaymentIntent の metadata に記録し、上限を超えたら発行しない。
// 決済 URL がそのまま無限の受験権になるのを防ぐため(端末の乗り換えは許容する)。
// 台帳の操作は /api/restore と共通で src/lib/redemptions.ts にある。
// =============================================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { moshi2ProductOf } from "@/data/products";
import {
  ACCESS_MAX_AGE_SEC,
  accessCookieName,
  signAccess,
  verifyAccess,
} from "@/lib/access";
import { consumeRedemption, limitReachedMessage } from "@/lib/redemptions";
import { MOSHI2_CONFIG } from "@/data/moshi2-config";

const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "決済は現在準備中です。" }, { status: 503 });
  }

  let body: { certId?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  const certId = String(body.certId ?? "");
  const sessionId = String(body.sessionId ?? "");
  const product = moshi2ProductOf(certId);
  if (!product || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "決済情報を確認できませんでした。" }, { status: 404 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "お支払いがまだ完了していません。" }, { status: 402 });
  }
  if (session.metadata?.certId !== certId || session.metadata?.kind !== "moshi2") {
    return NextResponse.json({ error: "この決済は別の商品のものです。" }, { status: 403 });
  }

  // すでにこの端末で受験できるなら台帳を消費しない。
  // 決済直後の画面をリロードしただけで1台分減るのを防ぐため。
  const jar = await cookies();
  const alreadyUnlocked = !!verifyAccess(jar.get(accessCookieName(certId))?.value, certId);

  if (!alreadyUnlocked) {
    const piId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    const outcome = await consumeRedemption(stripe.paymentIntents, piId);
    if (outcome.status === "limit_reached") {
      return NextResponse.json(
        { error: limitReachedMessage(outcome.resetAt, MOSHI2_CONFIG.contactEmail) },
        { status: 429 }
      );
    }
  }

  const token = signAccess({ c: certId, s: sessionId, t: Math.floor(Date.now() / 1000) });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(accessCookieName(certId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SEC,
  });
  return res;
}
