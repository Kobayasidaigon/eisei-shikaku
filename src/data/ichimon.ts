// =============================================================================
// 一問一答(○×)。2026-11-23 追加。本体(shikakumon.com)の /<資格>/ichimon/ と同じ考え方。
//
// 今の4択を、選択肢ごとの○×問題に分ける。「正しいもの/適切なもの」の問題は正解の肢が○・ほかが×、
// 「誤っているもの/適切でないもの/不適切なもの」は逆。事実は元の問題の範囲だけで、書き足さない。
// 肢だけでは意味が通らない問題(組合せ・個数・数値・計算・空欄・「何」を問うもの、
// 「〜に関する」で主題が取れないもの、名詞止めの肢があるもの)は使わない。
// 肢ごとの解説は無いので、元の問題の解説(ほかの肢の話も含む)を出す。
// =============================================================================

import { categoryName, certById, questionsOfCert, type CertId } from "./questions";

export type OxItem = {
  id: string;
  field: string;
  topic: string;
  statement: string;
  /** true = 正しい記述(○) */
  answer: boolean;
  /** 元の問題のID。解説は sharedExplains[sourceId] にある */
  sourceId: string;
  /** 元の問題のページ */
  sourcePath: string;
};

const STEM = /(正しい|適切な|誤っている|適切でない|不適切な)ものはどれか/;
const NEGATIVE = new Set(["誤っている", "適切でない", "不適切な"]);
const SKIP_STEM = /組合せ|組み合わせ|いくつ|何|数値|計算|空欄|語句|値として|値は|[（(]\s*[ア-ンA-Za-z]\s*[)）]|[［\[]/;
/** 肢が文として終わっていること(「〜こと」「〜の伸展」のような名詞止めの肢は、問題文が無いと意味が通らない) */
const SENTENCE_END = /[。るいだたすうくぐつぬむ]$/;
const DEPENDENT_CHOICE = /上記|いずれも|すべて正し|全て正し|^[0-9０-９.．,，\s〜~%％]+[^぀-ヿ一-鿿]*$/;

function topicOf(stem: string): string {
  const m = stem.match(/^(.+?)(?:に関する|についての|について)/);
  return m && m[1].length <= 40 ? m[1] : "";
}

export function buildOx(certId: CertId): { ox: OxItem[]; sharedExplains: Record<string, string> } {
  const ox: OxItem[] = [];
  const sharedExplains: Record<string, string> = {};
  if (!certById(certId)) return { ox, sharedExplains };
  for (const q of questionsOfCert(certId)) {
    const m = STEM.exec(q.q);
    if (!m || SKIP_STEM.test(q.q)) continue;
    if (q.choices.length < 2 || q.answer < 0 || q.answer >= q.choices.length) continue;
    if (q.choices.some((c) => c.length < 12 || DEPENDENT_CHOICE.test(c) || !SENTENCE_END.test(c.trim()))) continue;
    // 「何についての記述か」が問題文から取れないものは、肢だけでは意味が通らないことが多いので使わない
    const topic = topicOf(q.q);
    if (!topic) continue;
    if (!q.explain) continue;
    const negative = NEGATIVE.has(m[1]);
    const sourcePath = `/${q.cert ?? certId}/${q.category}/${q.id}/`;
    sharedExplains[q.id] = q.explain;
    q.choices.forEach((statement, i) => {
      const isAnswer = i === q.answer;
      ox.push({
        id: `${q.id}-${i + 1}`,
        field: categoryName(q.category),
        topic,
        statement: statement.trim(),
        answer: negative ? !isAnswer : isAnswer,
        sourceId: q.id,
        sourcePath,
      });
    });
  }
  return { ox, sharedExplains };
}
