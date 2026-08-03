/**
 * 資格(CertId)ごとのアフィリエイトリンクの正準定義。
 *
 * 【重要・A8の規約】アフィリエイト提携は「サイト単位」で行う。姉妹サイト
 *   (shikakumon.com 等)で承認済みの a8mat リンクを本サイトに貼るのは提携外サイトへの
 *   掲載にあたり、成果否認や提携解除の対象になる。必ず本サイト
 *   (eisei.shikakumon.com)を副サイトとして登録し、あらためて提携申請すること。
 *
 * 【運用】href が空文字の間はCTAを一切描画しない(= 偽リンクを出さない安全設計)。
 *   提携が承認され a8mat リンクを取得したら、下の href に貼るだけで
 *   ドリルの採点結果画面と模擬試験の合否判定画面の両方にCTAが点灯する。
 *
 * 【申請先の候補】いずれもシカクモン本体で提携実績があり、承認の見込みが高い:
 *   - アガルート: https://www.agaroot.jp/eisei_kanri/ (第一種・第二種とも講座あり)
 *   - オンスク:   https://onsuku.jp/training/eisei2   (ウケホーダイ型のサブスク)
 *   ユーキャンはA8の提携審査に通らなかった実績があるため、使う場合はafb等の別ASPを検討する。
 */

import type { CertId } from "./certs";

export interface AffiliateTarget {
  /** A8の計測付きリンク(有料講座)。空文字の間はCTAを描画しない。 */
  href: string;
  /** アンカーテキスト */
  label: string;
  /** GA4計測用の識別子 */
  course: string;
  /**
   * ★低摩擦オファー(資料請求・無料体験・無料受講相談など)のリンク。
   * 有料講座の申込みは摩擦が大きくCVRの天井が低いため、無料アクションを併設すると
   * 発生件数が取りやすい。未設定(undefined)の間は無料CTAを一切表示しない。
   */
  freeHref?: string;
  freeLabel?: string;
}

export const CERT_AFFILIATE: Record<CertId, AffiliateTarget> = {
  eisei1: {
    // TODO: A8で本サイトを副サイト登録 → アガルート(またはオンスク)と提携後、
    //   第一種衛生管理者講座の a8mat リンクをここに貼る。
    href: "",
    label: "第一種衛生管理者の対策講座を見る",
    course: "eisei1",
  },
  eisei2: {
    // TODO: 同上。第二種衛生管理者講座の a8mat リンクを貼る。
    href: "",
    label: "第二種衛生管理者の対策講座を見る",
    course: "eisei2",
  },
};

/** その資格の有料講座CTAを表示してよいか(リンク未設定なら描画しない) */
export function hasCourseAffiliate(certId: CertId): boolean {
  return Boolean(CERT_AFFILIATE[certId]?.href);
}

/** その資格の無料オファーCTAを表示してよいか */
export function hasFreeOffer(certId: CertId): boolean {
  return Boolean(CERT_AFFILIATE[certId]?.freeHref);
}
