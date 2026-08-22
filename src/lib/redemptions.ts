/**
 * 受験権の引き換え回数の管理。
 *
 * 台帳は Stripe の PaymentIntent の metadata。データベースを持たないため、
 * 決済そのものに回数を書き込んでいる。決済1件 = 台帳1件で対応する。
 *
 * 数える経路は2つある。両方を同じ台帳に載せないと、片方が素通りして
 * 上限が意味をなさなくなる:
 *
 *   /api/unlock   決済から戻ってきたとき
 *   /api/restore  購入メールのリンクを開いたとき
 *
 * 【生涯N回ではなく「期間内にN回」にしている理由】
 * 生涯N回だと、cookie を消しがちな人(プライベートモード、終了時に削除する設定、
 * 掃除アプリ)が恒久的に締め出され、問い合わせるしか手がなくなる。期間で戻る形なら、
 * 大量に配ろうとする人はその場で止まり、正常な購入者は待てば回復する。
 * 「もう使えません」ではなく「いつから使えます」と言えるのが大きい。
 *
 * 【失敗したら通す】
 * Stripe 側のエラーで数えられなかった場合は受験権を出す。上限管理は流用の抑止が
 * 目的であって、正規の購入者の受験を妨げてまで守るものではない。台帳が引けない
 * ことを理由に、金を払った人を締め出すほうが損失が大きい。
 */

/** 期間内に引き換えできる回数(=端末の切り替え回数)。 */
export const MAX_REDEMPTIONS = 5;

/** 回数が回復するまでの日数。 */
export const REDEMPTION_WINDOW_DAYS = 30;

const WINDOW_SEC = REDEMPTION_WINDOW_DAYS * 24 * 60 * 60;

/** Stripe の paymentIntents のうち、ここで使う部分だけ。テストで差し替えるために切ってある */
export type PaymentIntentStore = {
  retrieve(id: string): Promise<{ metadata?: Record<string, string> | null }>;
  update(id: string, params: { metadata: Record<string, string> }): Promise<unknown>;
};

export type RedeemOutcome =
  | { status: "granted" }
  /** resetAt: 回数が戻る時刻(UNIX秒) */
  | { status: "limit_reached"; resetAt: number };

/** 壊れた値・負の値・欠損はすべて 0 として扱う(締め出す側に倒さない)。 */
function toCount(v: string | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * 引き換え回数を1つ消費する。
 * 上限に達していることを確実に確認できたときだけ limit_reached を返す。
 *
 * @param nowSec テスト用に現在時刻を差し替えるための引数
 */
export async function consumeRedemption(
  store: PaymentIntentStore,
  paymentIntentId: string | null | undefined,
  nowSec: number = Math.floor(Date.now() / 1000)
): Promise<RedeemOutcome> {
  // 台帳が特定できない = 数えようがない。締め出さずに通す
  if (!paymentIntentId) return { status: "granted" };

  try {
    const pi = await store.retrieve(paymentIntentId);
    const meta = pi.metadata ?? {};

    let used = toCount(meta.redeemed);
    let windowStart = toCount(meta.redeemedFrom);

    // 期間が切れている(または初回)なら数え直す
    if (!windowStart || nowSec - windowStart >= WINDOW_SEC) {
      used = 0;
      windowStart = nowSec;
    }

    if (used >= MAX_REDEMPTIONS) {
      return { status: "limit_reached", resetAt: windowStart + WINDOW_SEC };
    }

    await store.update(paymentIntentId, {
      // 既存の metadata (certId / kind など) を消さないよう展開してから上書きする
      metadata: {
        ...meta,
        redeemed: String(used + 1),
        redeemedFrom: String(windowStart),
      },
    });
    return { status: "granted" };
  } catch (err) {
    console.error("redemptions: 引き換え回数を記録できませんでした(受験権は発行する)", err);
    return { status: "granted" };
  }
}

/**
 * 上限に達したときに購入者へ見せる文面。2経路で同じ文言を使う。
 *
 * 連絡先を引数で受けるのは、このモジュールを依存ゼロに保つため。
 * scripts/test-redemptions.mjs が素の node から直接 import するので、
 * ここで `@/` エイリアスを使うと解決できずテストが動かなくなる。
 */
export function limitReachedMessage(resetAt: number, contactEmail: string): string {
  const when = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
  }).format(new Date(resetAt * 1000));
  return (
    `端末の切り替えが${REDEMPTION_WINDOW_DAYS}日間で${MAX_REDEMPTIONS}回の上限に達しました。` +
    `${when}以降にまたご利用いただけます。` +
    `お急ぎの場合は ${contactEmail} までご連絡ください。`
  );
}
