// =============================================================================
// 衛生管理者ドリル — 問題データ(サーバー集約)
//
// 【位置づけ】第二種衛生管理者試験の "対策演習問題" です。試験の公式問題そのもの
//   ではありません。公式の出題範囲にもとづき作成し、独立したファクトチェック工程を
//   経て公開しています。
//
// 【重要・必読】法令・基準・試験範囲は改定されます。公開前および定期的に、
//   最新の法令・公式テキストと照合してください。
//
// 編集メモ: choices は必ず4つ。answer は正解の choices インデックス(0〜3)。
//   ドリルは表示時にシャッフルするが、模試(MoshiExam)は固定ペーパーのため
//   シャッフルしない。正解位置は 0〜3 に散らすこと。
// =============================================================================

import { EISEI2_HOUREI_QUESTIONS } from "./eisei2-hourei-questions";
import { EISEI2_EISEI_QUESTIONS } from "./eisei2-eisei-questions";
import { EISEI2_SEIRI_QUESTIONS } from "./eisei2-seiri-questions";
import { stampCert, type CertId, type CategoryId, type Question } from "./certs";

// 問題データの最終更新日(sitemap の lastmod に使用)。
// 問題の追加・修正・解説の書き直しをしたら必ずこの日付を更新すること。
export const QUESTIONS_UPDATED_AT = "2026-08-02";

// 型・CERTS・CATEGORIES・軽量ヘルパーは certs.ts に分離(再export)。
// サーバーコンポーネントは従来どおり "@/data/questions" から import できる。
export * from "./certs";

// 全資格の問題を結合(サーバー専用。クライアントは question-loader を使う)
export const QUESTIONS: Question[] = [
  ...EISEI2_HOUREI_QUESTIONS,
  ...EISEI2_EISEI_QUESTIONS,
  ...EISEI2_SEIRI_QUESTIONS,
].map(stampCert);

export function questionsOfCert(certId: CertId): Question[] {
  return QUESTIONS.filter((q) => q.cert === certId);
}

export function questionsOf(certId: CertId, categoryId: CategoryId): Question[] {
  return QUESTIONS.filter((q) => q.cert === certId && q.category === categoryId);
}

export function countOf(certId: CertId, categoryId: CategoryId): number {
  return questionsOf(certId, categoryId).length;
}

// QuizApp(クライアント)へ渡す問題数(サーバーで計算し、SSR表示と実データを一致させる)
export function quizCountsFor(activeCertId: CertId): import("./certs").QuizCounts {
  const totals = Object.fromEntries(
    QUESTIONS.reduce((m, q) => m.set(q.cert!, (m.get(q.cert!) ?? 0) + 1), new Map<CertId, number>())
  ) as Record<CertId, number>;
  const activeCat: Partial<Record<CategoryId, number>> = {};
  for (const q of QUESTIONS) {
    if (q.cert === activeCertId) activeCat[q.category] = (activeCat[q.category] ?? 0) + 1;
  }
  return { totals, activeCat };
}
