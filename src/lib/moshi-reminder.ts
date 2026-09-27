/**
 * 模試の結果画面からの「結果のまとめ + 試験日までの学習リマインド」登録。2026-09-22 追加。
 *
 * 【背景】第1回模試の完了者は月に百人単位でいるのに、完了したら終わりで、その後の接点が
 * 無かった。結果画面でメールアドレスをもらい、試験日から逆算して届ける。
 *
 * 【どこに保存するか】このサイトにはユーザーの DB が無いので、姉妹サービス Studio の
 * Supabase を受け皿にする (Studio リポジトリの app/api/moshi-reminder/subscribe)。
 * ブラウザから別オリジンへ直接 POST する (CORS はサイトごとの許可リスト)。
 * 特定電子メール法の表示義務・同意の記録・配信停止は Studio 側で実装済み。
 *
 * 【ローカル開発】localhost で動かしているときは Studio のローカル (port 3500) に送る。
 * NEXT_PUBLIC_MOSHI_REMINDER_ENDPOINT で上書きできる。
 *
 * 他のドリルサイト (kintore / eisei) と同じファイル。違うのは MOSHI_REMINDER_SITE だけ。
 */
import { trackMoshi2, type Moshi2ResultSummary, type Moshi2Verdict } from "@/lib/moshi2-funnel";

const PRODUCTION_ENDPOINT = "https://studio.shikakumon.com/api/moshi-reminder/subscribe";
const LOCAL_ENDPOINT = "http://localhost:3500/api/moshi-reminder/subscribe";

/** Studio 側で Origin から判定するサイト名 (localhost のときだけ本文で申告する) */
export const MOSHI_REMINDER_SITE = "eisei";

export function moshiReminderEndpoint(): string {
  const env = process.env.NEXT_PUBLIC_MOSHI_REMINDER_ENDPOINT;
  if (env) return env;
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return LOCAL_ENDPOINT;
  }
  return PRODUCTION_ENDPOINT;
}

export type MoshiReminderPayload = {
  email: string;
  cert: string;
  certName: string;
  /** "YYYY-MM-DD" または空 */
  examDate: string;
  verdict: Moshi2Verdict;
  score: number;
  result: Moshi2ResultSummary;
  topPath: string;
  moshi2Path: string | null;
  /** ハニーポット (人間は空のまま) */
  website: string;
};

export type MoshiReminderOutcome = { ok: true; mailed: boolean } | { ok: false; error: string };

/** Studio の登録 API に送る。ネットワーク不通・非 2xx は ok:false で返す (投げない) */
export async function submitMoshiReminder(p: MoshiReminderPayload): Promise<MoshiReminderOutcome> {
  const body = {
    email: p.email,
    cert: p.cert,
    certName: p.certName,
    examDate: p.examDate || undefined,
    verdict: p.verdict,
    score: p.score,
    scale: p.result.scale,
    passLine: p.result.passLine,
    gap: p.result.gap,
    unit: p.result.unit,
    worstCategory: p.result.worstCategory,
    worstPct: p.result.worstPct,
    topPath: p.topPath,
    moshi2Path: p.moshi2Path ?? undefined,
    sourcePath: typeof window !== "undefined" ? window.location.pathname : undefined,
    website: p.website,
    site: MOSHI_REMINDER_SITE,
  };
  try {
    const res = await fetch(moshiReminderEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; mailed?: boolean };
    if (!res.ok) {
      return { ok: false, error: data.error ?? "登録に失敗しました。時間をおいてお試しください。" };
    }
    return { ok: true, mailed: data.mailed === true };
  } catch {
    return { ok: false, error: "登録に失敗しました。通信環境をご確認のうえ、もう一度お試しください。" };
  }
}

/** localStorage のキー (登録済みなら結果画面に「登録済み」を出す) */
export function moshiReminderStorageKey(cert: string): string {
  return `moshiRemind:${cert}`;
}

/** GA4。gtag が遅延ロードでもキューで拾う trackMoshi2 に相乗り */
export function trackMoshiReminder(
  name: "moshi_reminder_view" | "moshi_reminder_submit" | "moshi_reminder_error",
  params: Record<string, string | number | boolean | undefined>
) {
  trackMoshi2(name, params);
}
