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

  /**
   * ★SMART合格講座(全日本情報学習振興協会・A8 4B1TI0系)。2026-09-05 追加。
   * A8 のプログラム詳細(ユーザー確認)で「衛生管理者」が成果報酬対象講座に明記されている。
   * 本体シカクモンで承認済みの提携リンク(どこでもリンク形式)に着地先だけ指定して使う。
   * a8mat は提携(メディア)単位で副サイト別には発行されない(SAT で実測済み)。
   * 本サイトは A8 の副サイトとして登録済みで、広告リンク作成画面の掲載サイトに出る。
   *
   * smartFreeHref = 無料登録(講義の一部を試し見できる)。本体で CVR 7.5% の実績があり、
   *   LEC の資料請求(100円)より前に置く低摩擦オファー。
   * smartHref     = 衛生管理者講座ページ(有料)。SAT の第2候補として併載する。
   */
  smartHref?: string;
  smartLabel?: string;
  smartFreeHref?: string;
  smartFreeLabel?: string;
}

const SMART_A8 = "https://px.a8.net/svt/ejp?a8mat=4B1TI0+9T22IA+4LOQ+BW8O2&a8ejpredirect=";
const SMART_FREE = `${SMART_A8}${encodeURIComponent("https://www.joho-gakushu.jp/smart/registfree.php")}`;
const SMART_EISEI = `${SMART_A8}${encodeURIComponent("https://www.joho-gakushu.or.jp/eiseikanrisya/")}`;

// 2026-08-06実装: 本サイトをA8のサイトとして登録済み(ユーザー実施)。リンクは
// 既提携SAT(現場系eラーニング・購入10%・衛生管理者講座あり)の商品リンク型で、
// 第一種・第二種共通の衛生管理者講座ページ(sat-co.info/ec/eiseikanrisya)に直行させる。
// ※A8のa8matは提携(メディア)単位でサイト別には発行されないことを実測確認済み。
//   掲載サイトの透明性は広告掲載URL提出で担保する。
// 2026-08-26追加: LECオンライン(東京リーガルマインド・A8提携承認2026-08-06・
//   資料請求100円/講座書籍購入1%)はLEC本体に衛生管理者講座があるため、
//   低摩擦の無料オファー(資料請求)として freeHref に設定。素材=A8テキスト素材029
//   (資格サイト=衛生管理者ドリルで発行)。生成リンクは改変しないこと。
export const CERT_AFFILIATE: Record<CertId, AffiliateTarget> = {
  eisei1: {
    href: "https://px.a8.net/svt/ejp?a8mat=4B9X1E+FFHK1M+5TRO+BW8O2&a8ejpredirect=https%3A%2F%2Fwww.sat-co.info%2Fec%2Feiseikanrisya",
    label: "第一種衛生管理者の対策講座(SAT)を見る",
    course: "eisei1",
    freeHref: "https://px.a8.net/svt/ejp?a8mat=4B9ZDE+3TJA5E+1G62+64JTE",
    freeLabel: "LECの講座案内資料を無料で請求する",
    smartHref: SMART_EISEI,
    smartLabel: "第一種衛生管理者のSMART合格講座を見る",
    smartFreeHref: SMART_FREE,
    smartFreeLabel: "無料登録してSMART合格講座を試し見る",
  },
  eisei2: {
    href: "https://px.a8.net/svt/ejp?a8mat=4B9X1E+FFHK1M+5TRO+BW8O2&a8ejpredirect=https%3A%2F%2Fwww.sat-co.info%2Fec%2Feiseikanrisya",
    label: "第二種衛生管理者の対策講座(SAT)を見る",
    course: "eisei2",
    freeHref: "https://px.a8.net/svt/ejp?a8mat=4B9ZDE+3TJA5E+1G62+64JTE",
    freeLabel: "LECの講座案内資料を無料で請求する",
    smartHref: SMART_EISEI,
    smartLabel: "第二種衛生管理者のSMART合格講座を見る",
    smartFreeHref: SMART_FREE,
    smartFreeLabel: "無料登録してSMART合格講座を試し見る",
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
