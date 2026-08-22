// =============================================================================
// 有料コンテンツのアクセス権(購入者判定)。
//
// このサイトはログイン機能を持たない。DB も持たない。そこで購入の事実は
// 「Stripe の決済セッション」を唯一の真実とし、決済確認が取れた時点で
// HMAC 署名つきの cookie を発行して、以降はその署名だけで判定する。
//
//   購入 → Stripe Checkout → success_url に session_id が付いて戻る
//        → /api/unlock が Stripe に問い合わせて支払い済みを確認
//        → 署名 cookie を発行(この端末で受験できるようになる)
//
// 署名鍵(ACCESS_SECRET)が漏れない限り、cookie の偽造はできない。
// 逆に鍵を変えると既存の購入者が締め出されるので、運用中は変えないこと。
// =============================================================================

import crypto from "node:crypto";
import { MOSHI2_CONFIG } from "@/data/moshi2-config";

/** cookie の有効期間。資格試験は年1〜数回なので、次年度の受験まで持たせる。 */
export const ACCESS_MAX_AGE_SEC = 400 * 24 * 60 * 60;

export type AccessPayload = {
  /** 対象資格 */
  c: string;
  /** Stripe の Checkout Session ID(サポート時の照合用) */
  s: string;
  /** 発行時刻(UNIX 秒) */
  t: number;
};

function secret(): string {
  const s = process.env.ACCESS_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "ACCESS_SECRET が未設定か短すぎます(32文字以上必要)。Vercel の環境変数に設定してください。"
    );
  }
  return s;
}

/**
 * 開発環境専用: 決済を通さずに有料の紙面を開けるようにする。
 * ローカルで見た目や印刷を確認するたびに Stripe のテスト決済を通すのは面倒なため。
 *
 * セーフティ (姉妹プロジェクトの DEV_MOCK_AUTH と同じ二重ガード):
 * - NODE_ENV === "development" でのみ有効。next build した本番では必ず false
 * - さらに環境変数 DEV_UNLOCK_MOSHI2 === "true" でのみ有効
 * - 本番ビルドでは絶対に有効にならない
 */
export function isDevUnlockEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" && process.env.DEV_UNLOCK_MOSHI2 === "true"
  );
}

/** 購入した資格ごとに cookie を分ける(1資格1決済のため)。 */
export function accessCookieName(certId: string): string {
  return `${MOSHI2_CONFIG.cookiePrefix}${certId}`;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(data: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(data).digest());
}

/** ペイロードに署名してトークン文字列を作る。 */
export function signAccess(payload: AccessPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${hmac(body)}`;
}

/**
 * トークンを検証する。改ざん・期限切れ・資格違いはすべて null を返す。
 * 署名の比較は timingSafeEqual で行う(比較時間から鍵を推測されないため)。
 */
export function verifyAccess(token: string | undefined, certId: string): AccessPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expected: string;
  try {
    expected = hmac(body);
  } catch {
    return null; // ACCESS_SECRET 未設定時は「権限なし」に倒す
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: AccessPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload?.c !== certId) return null;
  if (typeof payload.t !== "number") return null;
  if (Date.now() / 1000 - payload.t > ACCESS_MAX_AGE_SEC) return null;
  return payload;
}
