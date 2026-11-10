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
  // Google アナリティクス(GA4)測定ID(本サイト専用プロパティ・2026-08-05設定)。
  gaId: "G-HFRD3CVXVQ",
};

// E-E-A-T: 運営者情報(構造化データと著者ボックスで使用)。
// ★重要: 運営者は労働衛生の実務資格を主張しない(専門家なりすまし=景表法リスクを避ける)。
// 2026-11-10: 「衛生管理者ドリル編集部」をやめ、シカクモンと同じ運営者(ペンネーム 熊太郎)にした。
//   1人で運営しているのに「編集部」と書くと、体制を実際より大きく見せることになるため。
//   「独立した検証を経て公開」も、このリポジトリに検証の記録が無いので書かない(about の編集方針と合わせる)。
export const AUTHOR = {
  name: "熊太郎",
  jobTitle: "シカクモン運営者",
  description:
    "資格試験の練習問題サイト「シカクモン」と、その姉妹サイトを個人で運営しています。労働衛生の実務資格の保有を主張するものではありません。第一種・第二種衛生管理者の練習問題と解説は、公式の試験範囲にもとづき AI で下書きして作り、学習用の教材として公開しています。",
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
