import { QUESTIONS, CERTS } from "./questions";

export const SITE = {
  name: "衛生管理者ドリル",
  // SERPのモバイル表示(全角28〜32字)を意識して、資格名+「無料練習問題」を前方に置く
  tagline: "第一種・第二種衛生管理者の無料練習問題",
  // 本番: シカクモンのサブドメイン(新規ドメイン購入なし)
  url: "https://eisei.shikakumon.com",
  description: `第一種・第二種衛生管理者試験の無料練習問題サイト。関係法令・労働衛生・労働生理に加え、第一種の有害業務2科目まで解説つき4択で演習でき、本番形式モードや模擬試験で合格ライン判定もできます。全${CERTS.length}試験・全${QUESTIONS.length}問。`,
  // シカクモン関連リンク
  hubUrl: "https://shikakumon.com",
  studioUrl: "https://studio.shikakumon.com/",
  // ★A8で衛生管理者の通信講座アフィリ提携(アガルート衛生管理者講座 等)が通ったら
  //   url を設定する。設定した瞬間、採点結果画面に「講座で対策」CTA(rel=sponsored・
  //   【PR】)が点灯する(シカクモンの freeHref と同じ設計)。空のうちは非表示=偽リンクを出さない。
  //   なおA8はサイト単位の提携のため、本サイト(eisei.shikakumon.com)を副サイトとして
  //   登録したうえで提携申請すること(他サイトのa8matリンクの流用は規約違反)。
  courseAffiliate: { url: "", label: "講座で弱点をつぶす" },
  // 合格ラインは試験ごとに CERTS で定義（ここは表示用の既定値）
  passLine: 60,
  // 「全分野ミックス」で出題する問題数
  mixCount: 12,
  // Google アナリティクス(GA4)測定ID。★本サイト用のGA4プロパティを作成したら設定する。
  //   空文字の間は layout 側で GA タグを描画しない(他サイトのIDを流用しないこと)。
  gaId: "",
};

// E-E-A-T: 運営者情報(構造化データと著者ボックスで使用)。
// ★重要: 運営者は労働衛生の実務資格を主張しない。公式の試験範囲にもとづく
//   演習問題を作成・検証して提供する編集運営、という正直な立て付けにする
//   (専門家なりすまし=景表法リスクを避ける)。
export const AUTHOR = {
  name: "衛生管理者ドリル編集部",
  jobTitle: "資格試験ドリルの編集・運営",
  description:
    "公式の試験範囲にもとづき、第一種・第二種衛生管理者の練習問題と解説を作成し、独立した検証を経て公開しています。特定の実務資格の保有を主張するものではなく、出典を示した学習用の教材として提供します。",
};

// Next.js の metadata は浅いマージのため、ページ側で openGraph を書くと
// layout の siteName/locale が消える。ページ側は必ずこれをスプレッドする。
export const OG_BASE = {
  siteName: SITE.name,
  locale: "ja_JP",
  images: [{ url: "/og-default.png", width: 1200, height: 630, alt: SITE.name }],
};

// 相対パスを本番ドメインの絶対URLに変換(canonical / JSON-LD 用)。
export function absUrl(path: string): string {
  const base = SITE.url.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
