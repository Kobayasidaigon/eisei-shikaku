"use client";

/**
 * 第2回模試(有料)の出し分け。
 *
 *   未購入        → 商品説明と購入ボタン
 *   決済から復帰  → /api/unlock で決済を検証 → 受験権の cookie を受け取る
 *   購入済み      → /api/moshi2/[certId] からペーパーを取得して MoshiExam に渡す
 *
 * 有料の問題データはこのバンドルに含まれない。API が購入者判定を通したときだけ
 * ネットワーク越しに届く。ページ自体は静的生成のままなので SEO には影響しない。
 *
 * fetch 先の URL は末尾スラッシュ必須。next.config.ts が trailingSlash: true のため、
 * スラッシュ無しだと 308 リダイレクトを1往復挟むことになる。
 *
 * URL の ?s= は「決済セッションID」で、これ単体は何の権限も持たない。
 * サーバーが Stripe に照会して支払い済みを確認して初めて受験権になる。
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import MoshiExam from "@/components/MoshiExam";
import type { CertId, Question } from "@/data/certs";
import type { MoshiDef } from "@/data/moshi";
import { moshi2ProductOf } from "@/data/products";
import { SITE } from "@/data/site";
import { daysToNextExam, trackMoshi2 as track, trackMoshi2Ecommerce } from "@/lib/moshi2-funnel";

type Paper = { def: MoshiDef; questions: Question[]};
type Status = "loading" | "locked" | "ready" | "notReady" | "error";

/**
 * 【2026-09-20 改修の要点】販売ページ到達→checkout が 0/75人(28日)だった。
 *   ・価値を伝える節(誰向け/含まれるもの/サンプル/作問方針)は `pitch` としてサーバー側で
 *     組み、未購入のときだけここで描く。購入済みの人には受験画面だけを出す。
 *   ・価格ボックスは価値の後ろ。ボタンの直下は肯定形の安心3行だけにし、赤字の警告
 *     (シークレットウィンドウ/回数制限/返金不可)は FAQ に移した。
 *   ・計測: moshi2_page_view{src} / moshi2_price_view / moshi2_checkout_start(beacon) /
 *     purchase(標準eコマース)。Stripe テストモードの購入は送らない。
 */
export default function Moshi2Gate({ certId, pitch }: { certId: CertId; pitch?: ReactNode }) {
  const product = moshi2ProductOf(certId);
  const [status, setStatus] = useState<Status>("loading");
  const [paper, setPaper] = useState<Paper | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const priceRef = useRef<HTMLElement | null>(null);
  const priceSeen = useRef(false);
  const pageViewSent = useRef(false);

  const fetchPaper = useCallback(async () => {
    const res = await fetch(`/api/moshi2/${certId}/`, { cache: "no-store" });
    if (res.status === 402) {
      setStatus("locked");
      return;
    }
    if (res.status === 503) {
      setStatus("notReady");
      return;
    }
    if (!res.ok) {
      setMessage("問題の読み込みに失敗しました。時間をおいて開き直してください。");
      setStatus("error");
      return;
    }
    const data = (await res.json()) as Paper;
    setPaper(data);
    setStatus("ready");
  }, [certId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("canceled") === "1") setCanceled(true);

      // どこから来たか(result=第1回の結果画面 / landing=資格トップ / それ以外=direct)。
      // 販売ページ到達64人のうち結果画面経由は6人だけ、という推定を確定させるための計測。
      // 読んだら canonical を汚さないよう URL から消す(ハッシュ #sample は残す)。
      // ref で1回に抑えるのは、開発時の StrictMode が effect を2度走らせ、2度目が
      // (URL から src を消した後なので)direct として二重に数えられるのを防ぐため。
      const src = params.get("src");
      if (!pageViewSent.current) {
        pageViewSent.current = true;
        track("moshi2_page_view", { cert: certId, src: src ?? "direct" });
      }
      if (src) {
        params.delete("src");
        const q = params.toString();
        window.history.replaceState({}, "", `/${certId}/moshi2/${q ? `?${q}` : ""}${window.location.hash}`);
      }

      // 決済後に届くメールの受験用リンク(?k=署名トークン)。
      // 端末を変えた・cookieを消した場合の復旧口。決済からの復帰(?s=)より先に見る。
      const restoreToken = params.get("k");
      if (restoreToken) {
        try {
          const res = await fetch("/api/restore/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ certId, token: restoreToken }),
          });
          const data = await res.json().catch(() => ({}));
          if (!alive) return;
          if (res.ok) {
            track("moshi2_restore", { cert: certId });
          } else {
            setMessage(data?.error ?? "受験用リンクを確認できませんでした。");
          }
        } catch {
          if (!alive) return;
          setMessage("通信エラーが発生しました。");
        }
        // トークンをURLに残さない(履歴や共有で出回らないように)
        window.history.replaceState({}, "", `/${certId}/moshi2/`);
      }

      const sessionId = params.get("s");
      if (sessionId) {
        // 決済からの復帰。URL から session_id を消してから検証する
        // (リロードや共有で同じ URL が出回らないようにするため)。
        try {
          const res = await fetch("/api/unlock/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ certId, sessionId }),
          });
          const data = await res.json().catch(() => ({}));
          if (!alive) return;
          if (res.ok) {
            // Stripe テストモードの決済(livemode=false)は GA4 に載せない。
            // テスト購入が実売上と混ざると「売れた」と誤読するため。
            if (data?.livemode !== false) {
              track("moshi2_purchase_complete", { cert: certId });
              trackMoshi2Ecommerce("purchase", product, { transaction_id: sessionId });
            }
          } else {
            setMessage(data?.error ?? "決済の確認に失敗しました。");
          }
        } catch {
          if (!alive) return;
          setMessage("決済の確認中に通信エラーが発生しました。");
        }
        window.history.replaceState({}, "", `/${certId}/moshi2/`);
      }

      if (!alive) return;
      try {
        await fetchPaper();
      } catch {
        if (!alive) return;
        setMessage("通信エラーが発生しました。");
        setStatus("error");
      }
    })();

    return () => {
      alive = false;
    };
  }, [certId, fetchPaper]);

  // 価格ボックスが見えたら1回だけ moshi2_price_view。未購入表示のときだけ要素が存在する
  useEffect(() => {
    const el = priceRef.current;
    if (!el || priceSeen.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (priceSeen.current || !entries.some((e) => e.isIntersecting)) return;
        priceSeen.current = true;
        track("moshi2_price_view", { cert: certId });
        io.disconnect();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [certId, status]);

  async function buy() {
    if (buying) return;
    setBuying(true);
    setMessage(null);
    // 直後に Stripe へ遷移するので beacon で送る(遷移で送信が打ち切られないように)。
    // 実際には /api/checkout の往復を待ってから遷移するため、その間にも送り切れる。
    track("moshi2_checkout_start", { cert: certId }, { beacon: true });
    trackMoshi2Ecommerce("begin_checkout", product, undefined, { beacon: true });
    try {
      const res = await fetch("/api/checkout/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.url) {
        window.location.href = data.url as string;
        return;
      }
      setMessage(data?.error ?? "決済ページを開けませんでした。");
    } catch {
      setMessage("通信エラーが発生しました。");
    }
    setBuying(false);
  }

  if (!product) return null;

  if (status === "ready" && paper) {
    return (
      <>
        {/* 印刷導線は受験UIの「上」に置く。下に置くと140問の後ろに埋もれて見つからない */}
        <div className="print-hide mb-2.5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-surface p-4">
          <p className="text-[13px] text-ink-soft leading-relaxed">
            紙で解く・書き込んで復習するなら、問題・解答用紙・解説を A4 に組んだ紙面をどうぞ。
          </p>
          <Link
            href={`/${certId}/moshi2/print/`}
            className="shrink-0 rounded-[8px] bg-ink px-4 py-2 text-[13px] text-paper no-underline transition-colors hover:bg-accent"
          >
            印刷用ページを開く →
          </Link>
        </div>

        {/* 受験権は cookie で持つため、この端末から消えることがある。
            戻り方を、実際に受験できている今この瞬間に伝えておく */}
        <p className="print-hide mb-5 text-[12px] text-ink-faint leading-relaxed">
          このページをお気に入りに入れておくと、次回すぐ開けます。
          ブラウザのデータを消すなどで受験できなくなったときは、
          購入時にお届けしたメールのリンクから開き直してください。
          <span className="text-ink-soft">メールは消さずに残しておいてください。</span>
        </p>

        {/* 受験UIそのものは紙に出さない。タイマーや問題番号の一覧を刷っても意味がない */}
        <div className="print-hide">
          <MoshiExam certId={certId} paper={paper} />
        </div>

        {/* この画面を誤って印刷したときに、紙に出るのはこの一行だけ */}
        <p className="print-only text-[13px] leading-relaxed">
          この画面は受験用です。印刷用の紙面は {SITE.url}/{certId}/moshi2/print/ をご利用ください。
        </p>
      </>
    );
  }

  if (status === "loading") {
    return (
      <>
        {pitch}
        <section className="bg-surface border border-line rounded-[10px] p-5 text-[13px] text-ink-soft">
          読み込み中…
        </section>
      </>
    );
  }

  if (status === "notReady") {
    return (
      <section className="bg-surface border border-line rounded-[10px] p-5">
        <p className="text-[13px] text-ink-soft leading-relaxed">
          第2回は現在準備中です。公開までのあいだは
          <Link href={`/${certId}/moshi/`} className="underline underline-offset-2 hover:text-ink">
            無料の第1回模擬試験
          </Link>
          をご利用ください。
        </p>
      </section>
    );
  }

  /* ---------- 未購入 / エラー ---------- */
  const days = daysToNextExam(product.examDates);
  const price = `¥${product.priceJpy.toLocaleString()}`;
  return (
    <>
      {pitch}

      <section
        ref={priceRef}
        id="buy"
        className="bg-surface border border-accent/40 rounded-[10px] p-5 sm:p-6 max-w-xl scroll-mt-20"
      >
        {canceled && (
          <p className="text-[12px] text-ink-faint mb-3">
            決済を中断しました。もう一度お手続きいただけます。
          </p>
        )}
        {days != null && (
          <p className="text-[12px] text-accent-ink tabular mb-2">本試験まで あと{days}日</p>
        )}
        <p className="font-serif text-[26px] font-medium text-ink leading-none mb-2">
          {price}
          <span className="text-[12px] text-ink-faint ml-2 font-sans">税込・買い切り</span>
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed mb-1">
          書店の問題集1冊分より低い価格で、本番形式の通し練習が1回分増えます。
        </p>
        <button
          onClick={buy}
          disabled={buying}
          className="mt-3 bg-ink text-paper rounded-[8px] px-5 py-2.5 text-[13px] hover:bg-accent transition-colors disabled:opacity-50"
        >
          {buying ? "決済ページを準備中…" : `購入して受験する(${price})→`}
        </button>
        <ul className="text-[12px] text-ink-soft mt-3 leading-relaxed space-y-1">
          <li>決済は Stripe。カード情報は当サイトに渡りません。</li>
          <li>購入後すぐ受験できます。購入時のメールのリンクから、別の端末でも開けます。</li>
          <li>不具合で受験できない場合は全額返金します。</li>
        </ul>
        {message && <p className="text-[12px] text-wrong mt-4">{message}</p>}
      </section>

      {/* よくある質問。以前は購入ボタンの直下に赤字で書いていた注意事項(シークレット
          ウィンドウ/30日5回/返金不可)をここに移した。買う直前に警告を3つ読ませるのは
          ¥1,280 の判断を止めるだけで、知りたい人だけが開ける形のほうが害が小さい。 */}
      <section className="mt-6 max-w-xl">
        <h2 className="font-serif text-[16px] font-medium text-ink mb-2">よくある質問</h2>
        <div className="divide-y divide-line border-y border-line">
          <details className="group py-2.5">
            <summary className="cursor-pointer text-[13px] text-ink list-none flex justify-between gap-3">
              第1回を受けていなくても購入できますか？
              <span className="text-ink-faint group-open:rotate-90 transition-transform">›</span>
            </summary>
            <p className="text-[12.5px] text-ink-soft leading-relaxed mt-1.5">
              はい。第1回は無料で、いつでも受けられます。先に第1回で形式に慣れてからでも、第2回から始めても構いません。
            </p>
          </details>
          <details className="group py-2.5">
            <summary className="cursor-pointer text-[13px] text-ink list-none flex justify-between gap-3">
              端末やブラウザを変えたら？
              <span className="text-ink-faint group-open:rotate-90 transition-transform">›</span>
            </summary>
            <p className="text-[12.5px] text-ink-soft leading-relaxed mt-1.5">
              購入時のメールのリンクから開き直せます(30日で5回まで。翌月に戻ります)。メールは消さずに残しておいてください。
            </p>
          </details>
          <details className="group py-2.5">
            <summary className="cursor-pointer text-[13px] text-ink list-none flex justify-between gap-3">
              シークレットモードで買えますか？
              <span className="text-ink-faint group-open:rotate-90 transition-transform">›</span>
            </summary>
            <p className="text-[12.5px] text-ink-soft leading-relaxed mt-1.5">
              通常ウィンドウでの購入をお願いします。受験権がブラウザに保存されるため、シークレットウィンドウを閉じると消えてしまいます(その場合もメールのリンクから復旧できます)。
            </p>
          </details>
          <details className="group py-2.5">
            <summary className="cursor-pointer text-[13px] text-ink list-none flex justify-between gap-3">
              何回解けますか？
              <span className="text-ink-faint group-open:rotate-90 transition-transform">›</span>
            </summary>
            <p className="text-[12.5px] text-ink-soft leading-relaxed mt-1.5">
              何回でも解き直せます。受験権は購入したブラウザに約13か月保存され、採点後の「もう一度受験する」から同じ{product.questionCount}問を何度でも通せます。印刷用の紙面も期間中いつでも開けます。
            </p>
          </details>
          <details className="group py-2.5">
            <summary className="cursor-pointer text-[13px] text-ink list-none flex justify-between gap-3">
              返金は？
              <span className="text-ink-faint group-open:rotate-90 transition-transform">›</span>
            </summary>
            <p className="text-[12.5px] text-ink-soft leading-relaxed mt-1.5">
              商品の性質上、購入後のご都合による返金はお受けしていません。
              解錠できない等の不具合で受験できない場合は全額返金しますので、
              <Link href="/contact/" className="underline underline-offset-2 hover:text-ink">
                お問い合わせ
              </Link>
              ください。詳しくは
              <Link href="/legal/" className="underline underline-offset-2 hover:text-ink">
                特定商取引法に基づく表示
              </Link>
              をご覧ください。
            </p>
          </details>
        </div>
      </section>

      {/* 無料の第1回への戻し口は、ここ1か所だけ小さく残す。以前はページ冒頭と購入ボックスの
          2か所で「まずは無料の第1回で」と送り返していて、戻ってくる仕組みが無かった。 */}
      <p className="text-[12px] text-ink-faint mt-6 max-w-xl">
        第1回(無料)をまだ受けていない方は
        <Link href={`/${certId}/moshi/`} className="underline underline-offset-2 hover:text-ink">
          こちら
        </Link>
        。
      </p>
    </>
  );
}
