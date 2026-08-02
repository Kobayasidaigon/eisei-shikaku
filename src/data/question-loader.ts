// =============================================================================
// クライアント用の問題データ動的ローダー。
// 試験ごとに必要なデータファイルだけを dynamic import し、バンドルを分割する。
//
// 第一種は共通3科目 + 有害業務2科目の5ファイル、第二種は共通3科目のみを読み込む
// (第二種のドリルに有害業務のデータを載せないための分割)。
// 資格・科目を増やすときは SOURCES に <cert>-<科目>-questions.ts を追加する。
// =============================================================================

import { certById, stampCert, type CertId, type Question } from "./certs";

const loadE2Hourei = () =>
  import("./eisei2-hourei-questions").then((m) => m.EISEI2_HOUREI_QUESTIONS);
const loadE2Eisei = () =>
  import("./eisei2-eisei-questions").then((m) => m.EISEI2_EISEI_QUESTIONS);
const loadE2Seiri = () =>
  import("./eisei2-seiri-questions").then((m) => m.EISEI2_SEIRI_QUESTIONS);
const loadE1HoureiYugai = () =>
  import("./eisei1-hourei-yugai-questions").then((m) => m.EISEI1_HOUREI_YUGAI_QUESTIONS);
const loadE1EiseiYugai = () =>
  import("./eisei1-eisei-yugai-questions").then((m) => m.EISEI1_EISEI_YUGAI_QUESTIONS);

const SOURCES: Record<CertId, Array<() => Promise<Question[]>>> = {
  eisei2: [loadE2Hourei, loadE2Eisei, loadE2Seiri],
  eisei1: [loadE1HoureiYugai, loadE1EiseiYugai, loadE2Hourei, loadE2Eisei, loadE2Seiri],
};

export async function loadCertQuestions(certId: CertId): Promise<Question[]> {
  const cert = certById(certId);
  if (!cert) return [];
  const lists = await Promise.all(SOURCES[certId].map((load) => load()));
  return lists
    .flat()
    .map(stampCert)
    .filter((q) => cert.categories.includes(q.category));
}
