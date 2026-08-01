import { TOPICS } from "./topics-generated";
import type { Question } from "./certs";

// 問題の「論点ラベル」を返す。生成済みマップ(topics-generated.ts)を優先し、
// 無いIDは問題文から問い掛け表現を取り除いて導出する(タイトル・見出し・アンカー用)。
export function topicOf(q: Question): string {
  const t = TOPICS[q.id];
  if (t) return t;
  let s = q.q.trim().replace(/[?？。\s]+$/, "");
  const tails = [
    /(として|のうち|で|、)(最も)?(適切|適当|正しい|誤っている|不適切|不適当|正しくない|間違っている)(なもの|もの)?(は)?、?(次のうち)?どれ(か|ですか)?$/,
    /(は|として)?、?(次のうち)?どれ(か|ですか)?$/,
    /について(正しい|誤っている)?(説明|記述)?$/,
  ];
  for (const re of tails) s = s.replace(re, "");
  s = s.replace(/[、。,\s]+$/, "");
  if (s.length > 30) s = `${s.slice(0, 29)}…`;
  return s || q.q.slice(0, 20);
}
