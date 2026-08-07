import type { CertId, CategoryId } from "./questions";
import { GENERATED_COLUMNS } from "./columns-generated";

// =============================================================================
// 資格ガイド型コラム。SEO流入(「○○とは/難易度/勉強法」)を狙う読み物。
//
// 厳選コラムは CURATED_COLUMNS、生成コラムは columns-generated.ts に置く。
// 「第二種衛生管理者 とは/難易度/勉強法/受験資格」等の入口コラムを追加するときは
// 下の CURATED_COLUMNS に Column を足す(または columns-generated.ts に生成する)。
//
// 【重要】受験資格・費用・試験日程・問題数などの細目は各団体・年度で変わります。
//   本文は一般的な情報・作成時点の理解にもとづくため、最新かつ正確な情報は
//   必ず各資格の公式サイトで確認してください(各記事末尾に注記)。
// =============================================================================

export type ColumnSection = {
  heading: string;
  body?: string;
  list?: string[];
  /** 比較・一覧情報用の表。モバイルでは横スクロールで表示される */
  table?: { headers: string[]; rows: string[][] };
  /** 公式サイト等への出典リンク(本文の下に表示。アフィリエイトには使わない) */
  link?: { href: string; label: string };
};

export type Column = {
  slug: string;
  certId?: CertId; // 単一資格に紐づく場合のみ(比較・選び方コラムは無し)
  kicker?: string; // 一覧/記事のラベル(certId が無いとき用)
  title: string; // 一覧・OGP・h1
  shortTitle: string; // 一覧カードの見出し
  lead: string; // リード文
  sections: ColumnSection[];
  publishedAt?: string; // ISO 8601 (例 "2026-06-25")。未指定は COLUMN_DEFAULT_DATE
  updatedAt?: string; // 大きく書き直したときに設定
  related?: string[]; // 関連記事slugの手動指定(未指定は certId/slug から自動選定)
  // 記事内容に対応する分野別一問一答ページ(certIdの無い用語解説・勉強法記事のCTA先)
  drill?: { certId: CertId; categoryId: CategoryId };
};

// 既存コラムの一括公開日(git履歴上の実際の追加日)。個別に上書き可。
export const COLUMN_DEFAULT_DATE = "2026-07-16";

export function columnDates(c: Column): { published: string; modified: string } {
  const published = c.publishedAt ?? COLUMN_DEFAULT_DATE;
  return { published, modified: c.updatedAt ?? published };
}

// 追加の厳選コラムを用意したらここに足す(生成コラムは columns-generated.ts)。
const CURATED_COLUMNS: Column[] = [];

// 厳選コラム + 自動生成コラムを結合
export const COLUMNS: Column[] = [...CURATED_COLUMNS, ...GENERATED_COLUMNS];

export function columnBySlug(slug: string): Column | undefined {
  return COLUMNS.find((c) => c.slug === slug);
}
