import type { CertId } from "./certs";

/**
 * 模擬試験(第1回)の固定ペーパー定義。
 *
 * 本番形式モード(ランダム出題・時間無制限・全体%判定のみ)と違い、模試は
 * 「全員が同じ問題を同じ順序で解く固定問題+制限時間+本試験どおりの合否判定
 * (科目別基準を含む)」。固定にするのは回として成立させるため(第2回以降の
 * 追加前提)と、GA計測で完了率・得点分布を同一条件で比較するため。
 *
 * questionIds は本試験の科目出題順どおりの科目ブロック順(科目別判定の
 * start/count が紙面位置に対応)。
 */
export type MoshiSection = {
  label: string;     // 科目名
  start: number;     // 0始まりの開始index
  count: number;
  passCount: number; // この科目単独の合格基準(問数)
};

export type MoshiDef = {
  round: number;
  timeLimitMin: number;
  passCount: number;   // 総合合格基準(問数)
  passLabel: string;   // 表示用
  isFullSpec: boolean; // 本試験仕様準拠(問題数・時間・基準)を主張できるか
  lead?: string;       // 入口ページのリード文の上書き(ハーフ模試等)
  choiceLabel?: string; // 出題形式の表示上書き(4択・組合せ形式など)
  specNote: string;    // 仕様の根拠と本試験との差異(正直に書く)
  sections?: MoshiSection[]; // 科目別合格基準(全科目基準+総合基準の両方で判定)
  questionIds: string[];
};

export const MOSHI_UPDATED_AT = "2026-08-02";

export const MOSHI: Partial<Record<CertId, MoshiDef>> = {
  eisei2: {
    round: 1,
    timeLimitMin: 180,
    passCount: 18,
    passLabel: "総得点60%(30問中18問)以上、かつ各科目40%以上",
    isFullSpec: true,
    choiceLabel: "4択(本試験は五肢択一)",
    specNote:
      "本試験(第二種衛生管理者)は関係法令10問・労働衛生10問・労働生理10問の計30問、試験時間3時間、五肢択一で、合格基準は各科目40%以上かつ総得点60%以上です。本模試も同一の科目構成・問題数・合格基準で構成しています(選択肢は演習しやすい4択の簡略形式で、実際の試験は五肢択一です)。試験時間・基準は制度改正で変わる場合があるため、最新情報は公式でご確認ください。",
    sections: [
      { label: "関係法令(有害業務以外)", start: 0, count: 10, passCount: 4 },
      { label: "労働衛生(有害業務以外)", start: 10, count: 10, passCount: 4 },
      { label: "労働生理", start: 20, count: 10, passCount: 4 },
    ],
    // 各科目の問題プール(50問)から論点が偏らないよう10問ずつ抽出。
    // 固定ペーパーは選択肢をシャッフルしないため、正解位置が0〜3に散る組合せを選ぶこと。
    questionIds: [
      // 関係法令(有害業務以外) 10問 — 管理体制・健康診断・事務所則・労基法をバランスよく
      "eisei2-hourei-01", "eisei2-hourei-02", "eisei2-hourei-05", "eisei2-hourei-10", "eisei2-hourei-13",
      "eisei2-hourei-17", "eisei2-hourei-21", "eisei2-hourei-30", "eisei2-hourei-40", "eisei2-hourei-43",
      // 労働衛生(有害業務以外) 10問 — 温熱・換気・照明・食中毒・統計・救急・作業管理
      "eisei2-eisei-01", "eisei2-eisei-02", "eisei2-eisei-06", "eisei2-eisei-11", "eisei2-eisei-13",
      "eisei2-eisei-17", "eisei2-eisei-22", "eisei2-eisei-28", "eisei2-eisei-41", "eisei2-eisei-48",
      // 労働生理 10問 — 循環・呼吸・血液・消化・腎臓・神経・感覚・体温
      "eisei2-seiri-01", "eisei2-seiri-03", "eisei2-seiri-07", "eisei2-seiri-09", "eisei2-seiri-12",
      "eisei2-seiri-13", "eisei2-seiri-24", "eisei2-seiri-29", "eisei2-seiri-41", "eisei2-seiri-47",
    ],
  },
  eisei1: {
    round: 1,
    timeLimitMin: 180,
    passCount: 27,
    passLabel: "総得点60%(44問中27問)以上、かつ各科目40%以上",
    isFullSpec: true,
    choiceLabel: "4択(本試験は五肢択一)",
    specNote:
      "本試験(第一種衛生管理者)は、関係法令(有害業務に係るもの)10問・労働衛生(有害業務に係るもの)10問・関係法令(有害業務以外)7問・労働衛生(有害業務以外)7問・労働生理10問の計44問、試験時間3時間、五肢択一で、合格基準は各科目40%以上かつ総得点60%以上です。本模試も同一の科目構成・問題数・出題順・合格基準で構成しています(選択肢は演習しやすい4択の簡略形式で、実際の試験は五肢択一です)。試験時間・基準は制度改正で変わる場合があるため、最新情報は公式でご確認ください。",
    sections: [
      { label: "関係法令(有害業務に係るもの)", start: 0, count: 10, passCount: 4 },
      { label: "労働衛生(有害業務に係るもの)", start: 10, count: 10, passCount: 4 },
      { label: "関係法令(有害業務以外)", start: 20, count: 7, passCount: 3 },
      { label: "労働衛生(有害業務以外)", start: 27, count: 7, passCount: 3 },
      { label: "労働生理", start: 34, count: 10, passCount: 4 },
    ],
    // 本試験の科目出題順どおりに並べる(科目別判定の start/count が紙面位置に対応)。
    // 共通3科目は第二種模試と重ならない問題を優先し、続けて受験しても復習にならないようにした。
    questionIds: [
      // 関係法令(有害業務に係るもの) 10問
      "eisei1-hourei-yugai-01", "eisei1-hourei-yugai-03", "eisei1-hourei-yugai-06", "eisei1-hourei-yugai-08",
      "eisei1-hourei-yugai-11", "eisei1-hourei-yugai-15", "eisei1-hourei-yugai-19", "eisei1-hourei-yugai-24",
      "eisei1-hourei-yugai-33", "eisei1-hourei-yugai-39",
      // 労働衛生(有害業務に係るもの) 10問
      "eisei1-eisei-yugai-01", "eisei1-eisei-yugai-04", "eisei1-eisei-yugai-08", "eisei1-eisei-yugai-13",
      "eisei1-eisei-yugai-17", "eisei1-eisei-yugai-20", "eisei1-eisei-yugai-25", "eisei1-eisei-yugai-28",
      "eisei1-eisei-yugai-33", "eisei1-eisei-yugai-40",
      // 関係法令(有害業務以外) 7問
      "eisei2-hourei-03", "eisei2-hourei-07", "eisei2-hourei-19", "eisei2-hourei-25",
      "eisei2-hourei-34", "eisei2-hourei-41", "eisei2-hourei-46",
      // 労働衛生(有害業務以外) 7問
      "eisei2-eisei-04", "eisei2-eisei-09", "eisei2-eisei-14", "eisei2-eisei-23",
      "eisei2-eisei-30", "eisei2-eisei-37", "eisei2-eisei-43",
      // 労働生理 10問
      "eisei2-seiri-04", "eisei2-seiri-08", "eisei2-seiri-14", "eisei2-seiri-17", "eisei2-seiri-21",
      "eisei2-seiri-26", "eisei2-seiri-33", "eisei2-seiri-38", "eisei2-seiri-44", "eisei2-seiri-50",
    ],
  },
};
