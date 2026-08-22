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

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import MoshiExam from "@/components/MoshiExam";
import type { CertId, Question } from "@/data/certs";
import type { MoshiDef } from "@/data/moshi";
import { moshi2ProductOf } from "@/data/products";
import { SITE } from "@/data/site";

type Paper = { def: MoshiDef; questions: Question[]; dev?: boolean };
type Status = "loading" | "locked" | "ready" | "notReady" | "error";

function track(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("event", name, params);
}

export default function Moshi2Gate({ certId }: { certId: CertId }) {
  const product = moshi2ProductOf(certId);
  const [status, setStatus] = useState<Status>("loading");
  const [paper, setPaper] = useState<Paper | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [canceled, setCanceled] = useState(false);

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
            track("moshi2_purchase_complete", { cert: certId });
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

  async function buy() {
    if (buying) return;
    setBuying(true);
    setMessage(null);
    track("moshi2_checkout_start", { cert: certId });
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
        {paper.dev && (
          <p className="print-hide mb-4 rounded-[8px] border border-wrong/40 bg-wrong-wash px-4 py-2.5 text-[12px] text-wrong">
            開発モードで解除中です(DEV_UNLOCK_MOSHI2)。決済を通さずに表示しています。
            この表示は本番では出ません。
          </p>
        )}
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
      <section className="bg-surface border border-line rounded-[10px] p-5 text-[13px] text-ink-soft">
        読み込み中…
      </section>
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
  return (
    <section className="bg-surface border border-line rounded-[10px] p-5 sm:p-6">
      {canceled && (
        <p className="text-[12px] text-ink-faint mb-3">
          決済を中断しました。もう一度お手続きいただけます。
        </p>
      )}

      <h2 className="font-serif text-[17px] font-medium text-ink mb-3">この模試に含まれるもの</h2>
      <ul className="text-[13px] text-ink-soft leading-relaxed space-y-1.5 list-disc pl-5 mb-4">
        <li>第1回とは完全に別問題の固定ペーパー。全員が同じ問題を同じ順序で解きます。</li>
        <li>制限時間つきの本番形式。時間切れで自動採点されます。</li>
        <li>採点後に合否判定・分野別の正答率・全問の解説。</li>
        <li>間違えた問題は弱点として記録され、練習問題の復習に反映されます。</li>
        <li>
          <span className="text-ink">問題・解答用紙・解説を A4 に組んだ印刷用の紙面つき。</span>
          画面で時間を計って解き、紙に書き込みながら復習できます(PDF保存も可)。
        </li>
        <li>買い切り。会員登録もサブスクリプションもありません。</li>
      </ul>

      <div className="border-t border-line pt-4">
        <p className="font-serif text-[24px] font-medium text-ink leading-none mb-1">
          ¥{product.priceJpy.toLocaleString()}
          <span className="text-[12px] text-ink-faint ml-2 font-sans">買い切り・税込</span>
        </p>
        <button
          onClick={buy}
          disabled={buying}
          className="mt-3 bg-ink text-paper rounded-[8px] px-5 py-2.5 text-[13px] hover:bg-accent transition-colors disabled:opacity-50"
        >
          {buying ? "決済ページを準備中…" : "購入して受験する →"}
        </button>
        <p className="text-[12px] text-ink-faint mt-3 leading-relaxed">
          決済は Stripe で行われます。カード情報が当サイトに渡ることはありません。
          購入後はこの端末ですぐ受験できます。端末を変えるときやブラウザのデータを
          消したときは、購入時にお送りするメールのリンクから開き直してください
          (30日で5回まで。それ以上でも翌月には戻ります)。
        </p>
        <p className="text-[12px] text-wrong mt-2 leading-relaxed">
          シークレットウィンドウ(プライベートモード)でのご購入はお控えください。
          ウィンドウを閉じた時点で受験権が消えてしまいます。
        </p>
      </div>

      {message && <p className="text-[12px] text-wrong mt-4">{message}</p>}

      <p className="text-[12px] text-ink-faint mt-5 leading-relaxed border-t border-line pt-4">
        まだ第1回を受けていない方は、先に
        <Link href={`/${certId}/moshi/`} className="underline underline-offset-2 hover:text-ink">
          無料の第1回模擬試験
        </Link>
        をどうぞ。同じ形式・同じ合格基準で、実力と相性を確かめてから判断できます。
      </p>
    </section>
  );
}
