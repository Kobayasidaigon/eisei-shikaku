/**
 * Resend でメールを送る最小のヘルパー(fetch のみ・追加依存なし)。
 * シカクモン Studio の lib/email.ts と同じ方針。
 *
 * 必要な環境変数:
 *   RESEND_API_KEY  未設定なら何もしない(no-op)。鍵を入れる前でも動作は壊れない
 *   MAIL_FROM       任意。既定は下の MAIL_FROM_DEFAULT
 *
 * ドメイン認証(shikakumon.com)は Studio 側で完了済みのため、
 * 追加のDNS設定なしに同じ差出人で送れる。
 *
 * 設計:
 *   - 送信の失敗で呼び出し元の処理を巻き込まない(投げずに false を返す)
 *   - 5秒でタイムアウト。Resend が詰まってもリクエスト全体を止めない
 */

import { MOSHI2_CONFIG } from "@/data/moshi2-config";

/** 差出人。サイトごとの値は moshi2-config.ts にある */
const MAIL_FROM_DEFAULT = MOSHI2_CONFIG.mailFrom;
const TIMEOUT_MS = 5000;

export type SendMailParams = {
  to: string;
  subject: string;
  /** プレーンテキスト本文(必須。HTMLを読めない環境向け) */
  text: string;
  /** HTML本文(任意) */
  html?: string;
};

/**
 * メールを送る。送れたら true。
 * RESEND_API_KEY が無い場合は送らずに false を返す(エラーにはしない)。
 */
export async function sendMail({ to, subject, text, html }: SendMailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || MAIL_FROM_DEFAULT,
        to: [to],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("sendMail: Resend が失敗しました", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendMail: 送信できませんでした", err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
