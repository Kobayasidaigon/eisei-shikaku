import { QUESTIONS, CERTS } from "./questions";

export const SITE = {
  name: "衛生管理者ドリル",
  // SERPのモバイル表示(全角28〜32字)を意識して、資格名+「無料練習問題」を前方に置く
  tagline: "第一種・第二種衛生管理者の無料練習問題",
  // 本番: シカクモンのサブドメイン(新規ドメイン購入なし)
  url: "https://eisei.shikakumon.com",
  description: `第一種・第二種衛生管理者の過去問対策サイト。関係法令・労働衛生・労働生理に第一種の有害業務2科目を加えた全${QUESTIONS.length}問を、全問解説つきで無料公開。分野別の一問一答から、科目別の合格基準で判定する模擬試験まで。登録不要・スマホ対応。`,
  // シカクモン関連リンク
  hubUrl: "https://shikakumon.com",
  studioUrl: "https://studio.shikakumon.com/",
  // 講座アフィリエイトのリンクは資格(第一種/第二種)ごとに異なるため、
  // src/data/affiliate.ts の CERT_AFFILIATE で管理する(ここには置かない)。
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
