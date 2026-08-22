// =============================================================================
// 有料商品の定義(買い切り)。
//
// 第1回模試は無料のまま一切変えない。有料にするのは「第2回模試」= 第1回とは
// 別問題の、本試験と同じ問題数・時間・合格基準で受けられる回。
//
// 【設計】試験仕様(問題数・時間・合格基準)の**唯一の定義元**をここに置く。
//   商品ページ(静的生成)は問題データに触れずに仕様を表示でき、有料の問題が
//   クライアントのバンドルに混ざる経路をそもそも作らずに済む。
//   問題データ側(src/data/moshi2/*.ts)は問題と drop3 だけを持つ。
//
// 価格は Stripe のダッシュボードではなくここで定義し、Checkout の price_data に
// 渡す(商品登録の手順を増やさないため)。値段の変更もこのファイル1箇所で済む。
// =============================================================================

import type { CertId } from "./certs";

export type Moshi2Product = {
  certId: CertId;
  /** 表示名(Stripe の明細にもこの名前が出る) */
  name: string;
  /** 税込価格(円)。Stripe には最小単位=円でそのまま渡す */
  priceJpy: number;
  /** 決済画面と商品ページに出す短い説明 */
  description: string;

  /* ---- 試験仕様(第1回と揃える) ---- */
  round: number;
  /** 出題数。問題データの件数はビルド時にこの値と突き合わせる */
  questionCount: number;
  timeLimitMin: number;
  /** 総合の合格基準(問数) */
  passCount: number;
  passLabel: string;
  /** 選択肢の形式(表示用) */
  choiceFormat: string;
  /** 本試験仕様の準拠を主張できるか */
  isFullSpec: boolean;
  /**
   * 科目別の合格基準がある試験(危険物乙4・ボイラー・ビル管理士など)の科目構成。
   * count は分野ごとの出題数で、合計が questionCount と一致していること。
   * **問題は科目順に並ぶ**(start はこの順序から算出される)。
   * 指定すると、組み立てスクリプトは分野を混ぜず科目ごとにまとめて並べる。
   */
  sections?: { label: string; categories: string[]; count: number; passCount: number }[];
  /**
   * 分野ごとの出題数だけを指定する(科目別の合格基準は無い試験向け)。
   * sections と違い、出題順は分野を混ぜたままにする。
   * 本試験の配点比を再現したいが科目別判定は無い、という場合に使う
   * (第二種電気工事士は配線図の比重が高く、均等割りでは本試験とずれる)。
   */
  categoryCounts?: Record<string, number>;
  /** 仕様の根拠と本試験との差異(正直に書く) */
  specNote: string;
};

/** 第2回模試を販売する資格。ここに載っている資格だけ商品ページが生成される。 */
export const MOSHI2_PRODUCTS: Partial<Record<CertId, Moshi2Product>> = {
  "eisei1": {
    certId: "eisei1",
    name: "第一種衛生管理者 模擬試験 第2回",
    priceJpy: 1280,
    description:
      "本試験と同じ44問・180分・5科目の構成。各科目40%以上かつ総得点60%以上が合格基準で、第1回とは完全に別問題です。自動採点・科目別の合否判定・全問の解説に加え、A4に組んだ印刷用の紙面(PDF保存可)つき。",
    round: 2,
    questionCount: 44,
    timeLimitMin: 180,
    passCount: 27,
    passLabel: "総得点60%(44問中27問)以上、かつ各科目40%以上",
    choiceFormat: "4択(本試験は五肢択一)",
    isFullSpec: true,
    specNote:
      "本試験(第一種衛生管理者)は、関係法令(有害業務に係るもの)10問・労働衛生(有害業務に係るもの)10問・関係法令(有害業務以外)7問・労働衛生(有害業務以外)7問・労働生理10問の計44問、試験時間3時間、五肢択一で、合格基準は各科目40%以上かつ総得点60%以上です。本模試も同一の科目構成・問題数・出題順・合格基準で構成しています(選択肢は演習しやすい4択の簡略形式で、実際の試験は五肢択一です)。第1回とは問題が完全に別です。",
    sections: [
      { label: "関係法令(有害業務に係るもの)", categories: ["e1-hourei-yugai"], count: 10, passCount: 4 },
      { label: "労働衛生(有害業務に係るもの)", categories: ["e1-eisei-yugai"], count: 10, passCount: 4 },
      { label: "関係法令(有害業務以外)", categories: ["e2-hourei"], count: 7, passCount: 3 },
      { label: "労働衛生(有害業務以外)", categories: ["e2-eisei"], count: 7, passCount: 3 },
      { label: "労働生理", categories: ["e2-seiri"], count: 10, passCount: 4 },
    ],
  },
};

export function moshi2ProductOf(certId: string): Moshi2Product | undefined {
  return MOSHI2_PRODUCTS[certId as CertId];
}

/** 商品ページを生成する資格ID一覧。 */
export function moshi2CertIds(): CertId[] {
  return Object.keys(MOSHI2_PRODUCTS) as CertId[];
}
