import { SITE } from "@/data/site";
import type { CertId } from "@/data/certs";

/**
 * シカクモン Studio 側の資格別 LP (studio.shikakumon.com/lp/<slug>) への対応表。
 *
 * これまで Studio への送客は全部トップページ `/` 固定で、?exam= で資格名を
 * 渡してはいたものの、着地先はその資格の話を一切していなかった。Studio には
 * 資格ごとの LP (試験概要・出題範囲・登録なしで解ける検品済みサンプル 1 問) が
 * あるので、対応する資格はそこへ直接送る。
 *
 * Studio 側は lib/cert-lps.ts (データ駆動 LP) で同じスラッグを持つ。
 * ここに無い資格は従来どおりトップページに落ちる (壊れない)。
 */
export const STUDIO_LP_SLUG: Partial<Record<CertId, string>> = {
  "eisei1": "eisei1",
  "eisei2": "eisei2",
};

/**
 * Studio の着地 URL (クエリ無し)。呼び出し側で utm と ?exam= を付ける。
 * 末尾スラッシュ無しで返すので `${studioBaseUrl(id)}?utm_source=...` と繋げられる。
 */
export function studioBaseUrl(certId: CertId | string | null | undefined): string {
  const slug = certId ? STUDIO_LP_SLUG[certId as CertId] : undefined;
  const base = SITE.studioUrl.replace(/\/$/, "");
  return slug ? `${base}/lp/${slug}` : `${base}/`;
}
