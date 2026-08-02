// =============================================================================
// クライアント用の問題データ動的ローダー。
// 資格ごとに必要なデータファイルだけを dynamic import し、バンドルを分割する。
// 資格を増やすときは SOURCES に <cert>-questions.ts の import を追加する。
// (科目ごとにファイルを分けているため、1資格でも配列で複数ソースを持つ)
// =============================================================================

import { stampCert, type CertId, type Question } from "./certs";

const SOURCES: Record<CertId, Array<() => Promise<Question[]>>> = {
  eisei2: [
    () => import("./eisei2-hourei-questions").then((m) => m.EISEI2_HOUREI_QUESTIONS),
    () => import("./eisei2-eisei-questions").then((m) => m.EISEI2_EISEI_QUESTIONS),
    () => import("./eisei2-seiri-questions").then((m) => m.EISEI2_SEIRI_QUESTIONS),
  ],
};

export async function loadCertQuestions(certId: CertId): Promise<Question[]> {
  const lists = await Promise.all(SOURCES[certId].map((load) => load()));
  return lists.flat().map(stampCert).filter((q) => q.cert === certId);
}
