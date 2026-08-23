// =============================================================================
// 模擬試験 第2回(有料)のペーパー組み立て。
//
// 【重要】このファイルと src/data/moshi2/*.ts は **サーバー専用** です。
//   クライアントコンポーネントから import しないでください。import すると
//   有料の問題データがブラウザのバンドルに載り、購入せずに読めてしまいます。
//   受験画面へは /api/moshi2/[certId] が購入者判定を通したうえで配信します。
//
// 試験仕様(問題数・時間・合格基準)は src/data/products.ts が唯一の定義元。
// ここは「仕様 + 問題データ」を突き合わせてペーパーにするだけ。
// =============================================================================

import type { CertId, Question } from "./certs";
import { moshi2ProductOf } from "./products";

/** 問題データファイルが export する形。 */
export type Moshi2Source = {
  /** 出題順に並んだ固定ペーパー(全員が同じ問題・同じ順序) */
  questions: Question[];
  /**
   * 3肢択一の本試験(NSCA-CPT/CSCS)向けに、表示時へ間引く誤答の index。
   * 問題ID → choices の0始まりindex。正解の index は指定できない。
   */
  drop3?: Record<string, number>;
  /**
   * 五肢択一の本試験(危険物乙4 / 二級ボイラー技士 / ビル管理士)向けに、
   * 表示時へ追加する5本目の誤答。問題ID → 選択肢文。
   * drop3 とは逆向きの操作で、両方を同時に指定することはない。
   * 挿入位置はIDから決定的に算出するため、全員が同一の紙面になる。
   */
  extra5?: Record<string, string>;
  /** 問題データの最終更新日 */
  updatedAt: string;
};

export type Moshi2Paper = Moshi2Source & {
  round: number;
  timeLimitMin: number;
  passCount: number;
  passLabel: string;
  isFullSpec: boolean;
  specNote: string;
  /** 科目別の合格基準(ある試験のみ)。start は出題順から算出する */
  sections?: { label: string; start: number; count: number; passCount: number }[];
};

/**
 * 資格ID → 問題データの遅延ローダー。
 * dynamic import にしてあるのは、有料データを必要なリクエストでのみ読み込み、
 * 静的解析で誤ってクライアント側に引きずり込まれる経路を作らないため。
 */
const SOURCES: Partial<Record<CertId, () => Promise<Moshi2Source>>> = {
  "eisei2": () => import("./moshi2/eisei2").then((m) => m.EISEI2_MOSHI2),
  "eisei1": () => import("./moshi2/eisei1").then((m) => m.EISEI1_MOSHI2),
};

/**
 * 第2回のペーパーを取得する。未販売・データ未投入・問題数が仕様と食い違う場合は
 * null を返す(中途半端なペーパーを売らないための安全弁)。
 */
export async function loadMoshi2(certId: CertId): Promise<Moshi2Paper | null> {
  const product = moshi2ProductOf(certId);
  const load = SOURCES[certId];
  if (!product || !load) return null;

  const src = await load();
  if (!Array.isArray(src.questions) || src.questions.length !== product.questionCount) {
    console.error(
      `moshi2(${certId}): 問題数が仕様と一致しません(仕様 ${product.questionCount}問 / 実データ ${src.questions?.length ?? 0}問)`
    );
    return null;
  }

  return {
    ...src,
    round: product.round,
    timeLimitMin: product.timeLimitMin,
    passCount: product.passCount,
    passLabel: product.passLabel,
    isFullSpec: product.isFullSpec,
    specNote: product.specNote,
    // products.ts の科目構成から start(先頭からの位置)を積み上げて算出する。
    // 二重定義を避けるため、count だけを持たせて start はここで導く。
    sections: product.sections?.reduce<
      { label: string; start: number; count: number; passCount: number }[]
    >((acc, sec) => {
      const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].count : 0;
      acc.push({ label: sec.label, start, count: sec.count, passCount: sec.passCount });
      return acc;
    }, []),
  };
}

/**
 * 表示用の整形。API(受験用)とサンプル表示の両方から呼ぶ。
 * 同じ関数を通すことで、サンプルに出る紙面と購入後の紙面が必ず一致する。
 */

/** 5本目の誤答の挿入位置。問題IDから決定的に決まる(無料の第1回と同じ式)。 */
function insertPos(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h % 5;
}

/** 五肢択一の本試験に合わせて5本目の誤答を挿し込む。 */
export function applyExtra5(questions: Question[], extra?: Record<string, string>): Question[] {
  if (!extra) return questions;
  return questions.map((q) => {
    const fifth = extra[q.id];
    if (!fifth) return q;
    const pos = insertPos(q.id);
    const choices = [...q.choices];
    choices.splice(pos, 0, fifth);
    // 挿入位置が正解以前なら、正解の index が1つ後ろへずれる
    return { ...q, choices, answer: q.answer >= pos ? q.answer + 1 : q.answer };
  });
}

/** 3肢択一の本試験に合わせて誤答を1本落とす。 */
export function applyDrop3(questions: Question[], drop?: Record<string, number>): Question[] {
  if (!drop) return questions;
  return questions.map((q) => {
    const d = drop[q.id];
    if (d == null || d === q.answer || d < 0 || d >= q.choices.length) return q;
    return {
      ...q,
      choices: q.choices.filter((_, i) => i !== d),
      answer: q.answer > d ? q.answer - 1 : q.answer,
    };
  });
}

/** 受験者が実際に見る並びに整えた紙面を返す。 */
export function shapeForDisplay(paper: Moshi2Paper): Question[] {
  return applyExtra5(applyDrop3(paper.questions, paper.drop3), paper.extra5);
}
