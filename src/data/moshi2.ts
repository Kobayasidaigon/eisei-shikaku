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
