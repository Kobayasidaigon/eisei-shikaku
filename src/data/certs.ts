// =============================================================================
// 衛生管理者ドリル — 試験・分野のマスター定義(問題データを含まない)
//
// クライアントコンポーネント(QuizApp)はこのファイルだけを import すること。
// questions.ts を import すると全問データがバンドルに入ってしまう。
// 問題データは question-loader.ts の動的 import で資格ごとに取得する。
//
// 現状は第二種衛生管理者(有害業務以外の3科目)の1資格。第一種衛生管理者は
// 有害業務に係る関係法令・労働衛生の問題プールが揃い次第、CERTS / CategoryId に
// 追加する(第二種の3科目=第一種と共通の中核科目)。
// =============================================================================

export type CertId = "eisei2";

export type CategoryId =
  // 第二種衛生管理者の3科目(いずれも有害業務に係るもの以外)
  | "e2-hourei"
  | "e2-eisei"
  | "e2-seiri";

export type Question = {
  id: string;
  cert?: CertId; // 未指定は eisei2 で補完
  category: CategoryId;
  q: string;
  // データ上は常に4択。五肢択一の本試験に対する簡略形式(1論点1問で演習しやすくする)。
  // 本試験が5択である旨は各ページ・模試の注記で明示している。
  choices: string[];
  answer: number; // 正解の choices インデックス
  explain: string;
};

export type Category = {
  id: CategoryId;
  name: string;
  desc: string;
};

// 知識領域のマスター(第二種衛生管理者 試験の出題範囲に対応)
export const CATEGORIES: Category[] = [
  {
    id: "e2-hourei",
    name: "関係法令（有害業務以外）",
    desc: "安全衛生管理体制・衛生委員会・健康診断・労働基準法(労働時間・休憩・年休・母性保護)",
  },
  {
    id: "e2-eisei",
    name: "労働衛生（有害業務以外）",
    desc: "温熱環境・換気・照明・情報機器作業・食中毒・救急処置・メンタルヘルス・腰痛予防",
  },
  {
    id: "e2-seiri",
    name: "労働生理",
    desc: "循環器・呼吸・血液・消化と代謝・腎臓・神経・感覚・体温調節・睡眠",
  },
];

export type Cert = {
  id: CertId;
  name: string;
  fullName: string;
  desc: string;
  categories: CategoryId[]; // この試験で出題する知識領域(表示順)
  passLine: number; // 合格ライン(%)
  examCount: number; // 本番形式モードの出題数(本試験の問題数の目安)
  aliases?: string[]; // 別名・略称。title・本文の別表記クエリ対応に使う
  authority?: string; // 試験の実施団体(出典明示・E-E-A-T)
  faq?: { q: string; a: string }[]; // 資格入口ページの可視FAQ+FAQPage(事実が確立した資格のみ)
};

export const CERTS: Cert[] = [
  {
    id: "eisei2",
    name: "第二種衛生管理者",
    fullName: "第二種衛生管理者",
    desc: "事務・情報通信・小売など有害業務の少ない業種で、職場の衛生管理を担う国家資格。関係法令・労働衛生・労働生理の3科目(いずれも有害業務以外)を、解説つき4択で無料演習できます。",
    categories: ["e2-hourei", "e2-eisei", "e2-seiri"],
    passLine: 60,
    examCount: 30,
    aliases: ["衛生管理者", "第2種衛生管理者", "衛生管理者2種"],
    authority: "公益財団法人 安全衛生技術試験協会",
    faq: [
      {
        q: "第二種衛生管理者に受験資格はありますか？",
        a: "あります。学歴に応じた労働衛生の実務経験が必要で、たとえば大学・高等専門学校を卒業して1年以上、高等学校を卒業して3年以上、または労働衛生の実務に10年以上従事した経験などが要件です。必要書類を含む詳細は公式(安全衛生技術試験協会)で必ずご確認ください。",
      },
      {
        q: "第二種衛生管理者の試験科目と合格基準は？",
        a: "関係法令・労働衛生・労働生理の3科目(いずれも有害業務に係るもの以外)・計30問(五肢択一)です。合格には各科目40%以上かつ全科目合計60%以上の得点が必要で、1科目でも4割を切ると不合格になります。",
      },
      {
        q: "第一種衛生管理者との違いは？",
        a: "第一種はすべての業種で衛生管理者になれ、有害業務を含む業種(製造業・建設業・医療業など)にも対応します。第二種は有害業務との関連が少ない業種(情報通信業・金融業・小売業など)に限って選任できます。試験でも第一種は有害業務に関する科目が加わり計44問、第二種は計30問です。",
      },
      {
        q: "第二種衛生管理者は独学で合格できますか？",
        a: "はい。出題論点は定番化しており、過去問中心の演習で独学合格を十分に狙えます。3科目とも苦手を作らず、各科目4割の足切りを超えることが合格の鍵です。",
      },
    ],
  },
];

// サーバー側(ページ)で計算して QuizApp に渡す問題数(SSR時点の表示とカード描画に使う)
export type QuizCounts = {
  totals: Record<CertId, number>; // 資格ごとの総問題数
  activeCat: Partial<Record<CategoryId, number>>; // 初期表示資格の分野別問題数
};

// 各問に cert を補完(現状は全カテゴリが第二種衛生管理者)。
// 第一種を追加するときは category の接頭辞で分岐する。
export function stampCert(q: Question): Question {
  const cert: CertId = q.cert ?? "eisei2";
  return { ...q, cert };
}

export function certById(certId: CertId): Cert | undefined {
  return CERTS.find((c) => c.id === certId);
}

export function categoryName(categoryId: CategoryId): string {
  return CATEGORIES.find((c) => c.id === categoryId)?.name ?? categoryId;
}

export function categoriesOfCert(cert: Cert): Category[] {
  return cert.categories
    .map((id) => CATEGORIES.find((c) => c.id === id))
    .filter((c): c is Category => Boolean(c));
}
