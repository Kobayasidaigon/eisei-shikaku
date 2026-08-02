// =============================================================================
// 衛生管理者ドリル — 問題データ(サーバー集約)
//
// 【位置づけ】衛生管理者試験の "対策演習問題" です。試験の公式問題そのものでは
//   ありません。公式の出題範囲にもとづき作成し、独立したファクトチェック工程を
//   経て公開しています。
//
// 【重要・必読】法令・基準・試験範囲は改定されます。公開前および定期的に、
//   最新の法令・公式テキストと照合してください。
//
// 【データモデル】問題は分野(CategoryId)に属し、試験(Cert)は分野の集合を持つ。
//   第一種と第二種は3科目(e2-*)が共通なので、共通科目の問題は両試験の
//   ドリル・模試の対象になる。ただしURLの所有者は1つ(homeCertOfCategory)で、
//   静的生成は ownedCategoriesOfCert を使って重複コンテンツを防ぐこと。
//
// 編集メモ: choices は必ず4つ。answer は正解の choices インデックス(0〜3)。
//   ドリルは表示時にシャッフルするが、模試(MoshiExam)は固定ペーパーのため
//   シャッフルしない。正解位置は 0〜3 に散らすこと。
// =============================================================================

import { EISEI1_HOUREI_YUGAI_QUESTIONS } from "./eisei1-hourei-yugai-questions";
import { EISEI1_EISEI_YUGAI_QUESTIONS } from "./eisei1-eisei-yugai-questions";
import { EISEI2_HOUREI_QUESTIONS } from "./eisei2-hourei-questions";
import { EISEI2_EISEI_QUESTIONS } from "./eisei2-eisei-questions";
import { EISEI2_SEIRI_QUESTIONS } from "./eisei2-seiri-questions";
import { certById, stampCert, type CertId, type CategoryId, type Question } from "./certs";

// 問題データの最終更新日(sitemap の lastmod に使用)。
// 問題の追加・修正・解説の書き直しをしたら必ずこの日付を更新すること。
export const QUESTIONS_UPDATED_AT = "2026-08-02";

// 型・CERTS・CATEGORIES・軽量ヘルパーは certs.ts に分離(再export)。
// サーバーコンポーネントは従来どおり "@/data/questions" から import できる。
export * from "./certs";

// 全分野の問題を結合(サーバー専用。クライアントは question-loader を使う)
export const QUESTIONS: Question[] = [
  ...EISEI1_HOUREI_YUGAI_QUESTIONS,
  ...EISEI1_EISEI_YUGAI_QUESTIONS,
  ...EISEI2_HOUREI_QUESTIONS,
  ...EISEI2_EISEI_QUESTIONS,
  ...EISEI2_SEIRI_QUESTIONS,
].map(stampCert);

/** その試験の出題範囲(分野の集合)に含まれる全問題。共通科目は両試験に含まれる。 */
export function questionsOfCert(certId: CertId): Question[] {
  const cert = certById(certId);
  if (!cert) return [];
  return QUESTIONS.filter((q) => cert.categories.includes(q.category));
}

/** その試験の出題範囲に含まれる、指定分野の問題。範囲外の分野なら空配列。 */
export function questionsOf(certId: CertId, categoryId: CategoryId): Question[] {
  const cert = certById(certId);
  if (!cert || !cert.categories.includes(categoryId)) return [];
  return QUESTIONS.filter((q) => q.category === categoryId);
}

export function countOf(certId: CertId, categoryId: CategoryId): number {
  return questionsOf(certId, categoryId).length;
}

// QuizApp(クライアント)へ渡す問題数(サーバーで計算し、SSR表示と実データを一致させる)
export function quizCountsFor(activeCertId: CertId): import("./certs").QuizCounts {
  const totals = Object.fromEntries(
    (["eisei2", "eisei1"] as CertId[]).map((id) => [id, questionsOfCert(id).length])
  ) as Record<CertId, number>;
  const activeCat: Partial<Record<CategoryId, number>> = {};
  for (const q of questionsOfCert(activeCertId)) {
    activeCat[q.category] = (activeCat[q.category] ?? 0) + 1;
  }
  return { totals, activeCat };
}
