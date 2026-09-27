/**
 * 第2回模試(有料)の販売ファネルで共有する小物。クライアントから import してよい
 * (有料の問題データには触れない)。
 *
 * 【なぜ作ったか】2026-09-20 の改修で、結果画面のオファーを判定別(未達/あと一歩/合格圏)に
 * 出し分けるようになった。判定の閾値・試験日までの残り日数・GA4 への送り方が
 * Moshi2Offer / Moshi2TopCard / Moshi2Gate でばらばらだと、あとで数字を読むときに
 * 「どの verdict がどの条件か」が追えなくなるので、ここに1本化する。
 */

export type Moshi2Verdict = "fail" | "near" | "pass";

/** 第1回の結果画面が Moshi2Offer に渡す要約。単位は資格によって問数/点数が変わる */
export type Moshi2ResultSummary = {
  passed: boolean;
  /** 合格ラインまでの不足。合格ライン以上なら 0 以下(科目別基準で落ちた場合に起こる) */
  gap: number;
  /** gap と passLine の単位 */
  unit: "問" | "点";
  /** 合格ライン(問数または点数) */
  passLine: number;
  /** 判定帯の幅を決める母数(総問数または満点) */
  scale: number;
  /** いちばん正答率が低かった分野(全問正解なら undefined) */
  worstCategory?: string;
  worstPct?: number;
};

/**
 * 判定。「あと一歩」は不足が母数の1割(最低2)以内。
 * 総合点は足りているのに科目別基準で落ちた場合(gap<=0 かつ不合格)も「あと一歩」に入れる。
 */
export function moshi2Verdict(r: Pick<Moshi2ResultSummary, "passed" | "gap" | "scale">): Moshi2Verdict {
  if (r.passed) return "pass";
  const band = Math.max(2, Math.ceil(r.scale * 0.1));
  return r.gap <= band ? "near" : "fail";
}

/** JST での「今日0時」。ビルド環境が UTC でも日付境界がずれないようにする */
function todayStartJst(): number {
  const shifted = new Date(Date.now() + 9 * 3600_000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 9 * 3600_000;
}

/**
 * 公式発表済みの試験日リスト(YYYY-MM-DD)から、今日以降で最も近い日までの残り日数。
 * 当日=0。該当なし(未設定・すべて過去)は null で、呼び出し側は行ごと出さない。
 */
export function daysToNextExam(dates?: readonly string[]): number | null {
  if (!dates || dates.length === 0) return null;
  const today = todayStartJst();
  let best: number | null = null;
  for (const d of dates) {
    const t = new Date(`${d}T00:00:00+09:00`).getTime();
    if (Number.isNaN(t) || t < today) continue;
    const days = Math.floor((t - today) / 86400000);
    if (best == null || days < best) best = days;
  }
  return best;
}

/**
 * GA4 へ送る。`beacon` を付けると gtag に transport_type: 'beacon' を渡し、直後に
 * ページ遷移しても送信が打ち切られにくくなる(checkout 開始のように遷移直前に送る用)。
 */
export function trackMoshi2(name: string, params?: Record<string, unknown>, opts?: { beacon?: boolean }) {
  if (typeof window === "undefined") return;
  const p = opts?.beacon ? { ...params, transport_type: "beacon" } : params;
  const g = gtagOf();
  if (g) {
    g("event", name, p);
    return;
  }
  // gtag.js は layout で lazyOnload 読込のため、ハイドレーション直後(販売ページの表示など)は
  // まだ window.gtag が無い。`gtag?.()` で捨てると moshi2_page_view がほぼ全件落ちるので、
  // 溜めておいて現れたら順に送る(最長30秒。それでも来なければ諦める)。
  pending.push([name, p]);
  if (flushTimer != null) return;
  const started = Date.now();
  flushTimer = window.setInterval(() => {
    const g2 = gtagOf();
    if (g2) for (const [n, pp] of pending.splice(0)) g2("event", n, pp);
    if (g2 || Date.now() - started > 30_000) {
      window.clearInterval(flushTimer!);
      flushTimer = null;
    }
  }, 300);
}

type Gtag = (...args: unknown[]) => void;
const pending: [string, Record<string, unknown> | undefined][] = [];
let flushTimer: number | null = null;

function gtagOf(): Gtag | undefined {
  const w = window as unknown as { gtag?: Gtag };
  return typeof w.gtag === "function" ? w.gtag : undefined;
}

/**
 * GA4 の e コマース標準イベント(begin_checkout / purchase)。
 * GA4 の「収益」は purchase の value/currency からしか積まれないため、独自名の
 * moshi2_checkout_start / moshi2_purchase_complete と併せて送る(二重計上にはならない)。
 * transaction_id には Stripe の決済セッションIDを入れ、リロードによる重複を GA4 側で排除させる。
 */
export function trackMoshi2Ecommerce(
  name: "begin_checkout" | "purchase",
  product: { certId: string; name: string; priceJpy: number } | undefined,
  extra?: Record<string, unknown>,
  opts?: { beacon?: boolean },
) {
  if (!product) return;
  trackMoshi2(
    name,
    {
      currency: "JPY",
      value: product.priceJpy,
      items: [
        {
          item_id: `moshi2_${product.certId}`,
          item_name: product.name,
          item_category: "moshi2",
          price: product.priceJpy,
          quantity: 1,
        },
      ],
      ...extra,
    },
    opts,
  );
}
