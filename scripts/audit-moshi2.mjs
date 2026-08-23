#!/usr/bin/env node
// =============================================================================
// 第2回模試(有料)の問題データの機械監査。prebuild で実行し、違反があれば
// ビルドを落とす。
//
// 【なぜ別スクリプトか】
// audit-questions.mjs は src/data の *-questions.ts をファイル名で拾うため、
// src/data/moshi2/*.ts を見ない。有料で売る問題こそ品質を落とせないので、
// 同じ基準に加えて2つを検査する:
//
//   1. 無料で公開済みの問題との重複
//      無料サイトで解ける問題を売ってしまうのが、この商品で一番やってはいけない事故。
//   2. 正解位置の周期パターン
//      分布が均等でも規則的だと、内容を知らなくても当てられる。実際に
//      「i % 4 で均す」実装で4問ごとに同じ位置が正解になる縞模様が出た。
//
//   node scripts/audit-moshi2.mjs          … 監査(違反があれば exit 1)
//   node scripts/audit-moshi2.mjs --report … 数値だけ出して常に exit 0
// =============================================================================

import fs from "node:fs";
import path from "node:path";

const REPORT_ONLY = process.argv.includes("--report");

const LIMITS = {
  GAP_CHARS: 20,
  GAP_RATIO_PCT: 2,
  ANSWER_POS_PCT: 45,
  DUP_MAX: 0,
  POS_REF_MAX: 0,
  // 周期のある位置クラスで、同じ正解位置が占めてよい上限(3択なら偶然は約33%)
  PERIOD_SHARE: 0.7,
  // 検査する周期の範囲
  PERIOD_MIN: 2,
  PERIOD_MAX: 6,
};

const POS_REF = /選択肢[0-9１-４]|最初の選択肢|[1-4１-４]番目の選択肢/;

// 有料の第2回を売る資格 → 無料プールのどのファイルと突き合わせるか。
// (src/data/products.ts に資格を足したらここにも足すこと)
/* 監査の対象。**このリストはサイト固有**なので、他サイトからスクリプトを
   コピーしたときは必ず書き換えること。 */
const TARGETS = [
  {
    certId: "eisei2",
    paid: "src/data/moshi2/eisei2.ts",
    // 第1回はこれらの無料バンクから出題されるため、ここと重複が無ければ第1回とも重複しない。
    freePool: [
      "src/data/eisei2-hourei-questions.ts",
      "src/data/eisei2-eisei-questions.ts",
      "src/data/eisei2-seiri-questions.ts",
      "src/data/moshi-extra-questions.ts",
    ],
  },
  {
    certId: "eisei1",
    paid: "src/data/moshi2/eisei1.ts",
    // 第1回はこれらの無料バンクから出題されるため、ここと重複が無ければ第1回とも重複しない。
    freePool: [
      "src/data/eisei1-hourei-yugai-questions.ts",
      "src/data/eisei1-eisei-yugai-questions.ts",
      "src/data/eisei2-hourei-questions.ts",
      "src/data/eisei2-eisei-questions.ts",
      "src/data/eisei2-seiri-questions.ts",
      "src/data/moshi-extra-questions.ts",
    ],
  },
];


/** audit-questions.mjs と同じブロック分割方式で問題を読む(CRLF 対応)。 */
function readQuestions(file) {
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, "utf8");
  const items = [];
  for (const b of src.split(/\r?\n  \{\r?\n/).slice(1)) {
    const id = (b.match(/id: "((?:[^"\\]|\\.)*)"/) || [])[1];
    const q = (b.match(/q: "((?:[^"\\]|\\.)*)"/) || [])[1];
    const cm = b.match(/choices: \[([\s\S]*?)\],\r?\n/);
    const am = b.match(/answer: (\d)/);
    const em = b.match(/explain: "((?:[^"\\]|\\.)*)"/);
    const cat = (b.match(/category: "([^"]+)"/) || [])[1];
    if (!id || !q || !cm || !am) continue;
    items.push({
      id,
      q,
      category: cat ?? "",
      choices: [...cm[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]),
      answer: Number(am[1]),
      explain: em ? em[1] : "",
    });
  }
  return items;
}

/** データファイル末尾の DROP3(問題ID → 落とす誤答index)を読む。 */
function readDrop3(file) {
  if (!fs.existsSync(file)) return {};
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/const DROP3: Record<string, number> = \{([\s\S]*?)\n\};/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const t = line.match(/"([^"]+)":\s*(\d+)/);
    if (t) out[t[1]] = Number(t[2]);
  }
  return out;
}

/** 比較用に設問文を正規化(記号と空白の揺れを吸収)。 */
const norm = (s) => String(s).replace(/[（）()「」、。・,.\s]/g, "");

/* ---- 移植したまま書き換え忘れていないかの検査 ----
   moshi2-config.ts は「移植時に書き換える唯一のファイル」だが、書き換えを忘れても
   ビルドは通ってしまう。cookie の接頭辞が移植元と同じままだと、署名鍵を共有した
   場合に別サイトで買った受験権がこちらでも通る。実際に設備へ移植したとき、
   筋トレの値(kt_m2_ / 筋トレ資格ドリル / kintore@)が残ったまま気づかなかった。 */
function auditConfig() {
  const cfgPath = "src/data/moshi2-config.ts";
  const sitePath = "src/data/site.ts";
  if (!fs.existsSync(cfgPath) || !fs.existsSync(sitePath)) return [];
  const cfg = fs.readFileSync(cfgPath, "utf8");
  const site = fs.readFileSync(sitePath, "utf8");
  const pick = (re, src) => (src.match(re) || [])[1] ?? "";
  const siteName = pick(/name:\s*"([^"]+)"/, site);
  const prefix = pick(/cookiePrefix:\s*"([^"]+)"/, cfg);
  const mailFrom = pick(/mailFrom:\s*"([^"]+)"/, cfg);
  const contact = pick(/contactEmail:\s*"([^"]+)"/, cfg);
  const v = [];
  if (!prefix) v.push("cookiePrefix が読めない");
  if (siteName && mailFrom && !mailFrom.startsWith(siteName))
    v.push(`mailFrom の差出人名 "${mailFrom}" がサイト名 "${siteName}" と一致しない — 移植元の値が残っている疑い`);
  // 連絡先はサイトの問い合わせページと揃っているか
  const contactPage = "src/app/contact/page.tsx";
  if (contact && fs.existsSync(contactPage)) {
    const pageMail = pick(/CONTACT_EMAIL\s*=\s*"([^"]+)"/, fs.readFileSync(contactPage, "utf8"));
    if (pageMail && pageMail !== contact)
      v.push(`contactEmail "${contact}" が問い合わせページの "${pageMail}" と違う — 移植元の値が残っている疑い`);
  }
  return v;
}

const cfgViolations = auditConfig();
console.log(`\n[第2回の設定の検査] src/data/moshi2-config.ts`);
if (cfgViolations.length) {
  console.log("  違反:");
  cfgViolations.forEach((x) => console.log("    - " + x));
} else {
  console.log("  → 移植時の書き換え漏れなし");
}

let anyViolation = cfgViolations.length > 0;


for (const t of TARGETS) {
  const paid = readQuestions(t.paid);

  console.log(`\n[第2回模試の監査] ${t.certId} — ${paid.length}問  (${t.paid})`);
  if (paid.length === 0) {
    console.log("  問題データが未投入のためスキップ(販売は loadMoshi2 側で止まります)");
    continue;
  }

  const violations = [];
  const pos = [0, 0, 0, 0, 0];
  const overGap = [];
  let posRef = 0;
  let shape = 0;

  for (const it of paid) {
    const { choices: ch, answer: a } = it;
    // 4択が基本だが、鑑別等のように最初から5択で持つ問題もある
    if (!Array.isArray(ch) || (ch.length !== 4 && ch.length !== 5) || !(a >= 0 && a < ch.length)) {
      shape++;
      continue;
    }
    pos[a]++;
    const lens = ch.map((c) => c.length);
    if (lens[a] === Math.max(...lens)) {
      const gap = lens[a] - Math.max(...lens.filter((_, i) => i !== a));
      if (gap >= LIMITS.GAP_CHARS) overGap.push({ id: it.id, gap });
    }
    if (POS_REF.test(it.explain)) posRef++;
  }

  /* ---- 受験者が実際に見る正解位置と、その周期性 ----
     データは常に4択で持ち、表示時に変換する。どの変換をするかはデータファイル
     自身が持っている(DROP3 なら3択へ間引く / EXTRA5 なら5択へ足す / どちらも
     無ければ4択のまま)。ここを間違えると、実際に受験者が見る縞模様を見逃す。 */
  const paidSrc = fs.readFileSync(t.paid, "utf8");
  const MODE = /const EXTRA5/.test(paidSrc)
    ? "extra5"
    : /const DROP3/.test(paidSrc)
      ? "drop3"
      : "plain";
  const maxChoices = Math.max(...paid.map((it) => (Array.isArray(it.choices) ? it.choices.length : 0)));
  const SHOWN = MODE === "drop3" ? 3 : MODE === "extra5" ? 5 : maxChoices;

  /** 5本目の挿入位置。表示側・組み立て側と同じ式でなければ意味がない */
  const insertPos = (id) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
    return h % 5;
  };

  const drop3 = MODE === "drop3" ? readDrop3(t.paid) : {};
  const shown = paid.map((it) => {
    if (MODE === "drop3") {
      const d = drop3[it.id];
      return d != null && d !== it.answer && it.answer > d ? it.answer - 1 : it.answer;
    }
    if (MODE === "extra5") {
      const pos = insertPos(it.id);
      return it.answer >= pos ? it.answer + 1 : it.answer;
    }
    return it.answer;
  });
  const shownCount = [0, 0, 0, 0, 0];
  for (const v of shown) shownCount[v]++;

  /* ---- 解説が「受験者に見えない選択肢」を名指しで否定していないか ----
     drop3 で1本間引く資格では、4択のつもりで書いた解説が、表示されない誤答を
     「〜は誤りである」と否定していることがある。答えは正しくても、受験者には
     何の話か分からない解説になる。有料商品で解説を売りにしている以上これは欠陥。
     解説は特定の選択肢を名指しせず、事実として述べる形に書くこと。 */
  const REFUTE = /(誤り|適切でない|不適切|該当しない|正しくない|ではない|とする(記述|説明|考え方)は)/;
  const STOPW = new Set(["する","ある","こと","もの","ない","その","この","ため","など","以上","以下","場合","とき"]);
  const ghostRefs = [];
  if (MODE === "drop3") {
    for (const it of paid) {
      const d = drop3[it.id];
      if (d == null || !Array.isArray(it.choices) || !it.choices[d]) continue;
      const dropped = it.choices[d];
      const shown = it.choices.filter((_, i) => i !== d).join("｜");
      const toks = [...new Set([...dropped.matchAll(/[一-龥ァ-ヶ0-9.]{3,12}/g)].map((x) => x[0]))]
        .filter((t) => !STOPW.has(t) && !shown.includes(t) && !it.q.includes(t));
      for (const t of toks) {
        const i = it.explain.indexOf(t);
        if (i >= 0 && REFUTE.test(it.explain.slice(i, i + 46))) { ghostRefs.push(it.id); break; }
      }
    }
  }

  const periodHits = [];
  for (let k = LIMITS.PERIOD_MIN; k <= LIMITS.PERIOD_MAX; k++) {
    for (let r = 0; r < k; r++) {
      const cls = shown.filter((_, i) => i % k === r);
      if (cls.length < 8) continue;
      const freq = {};
      for (const v of cls) freq[v] = (freq[v] || 0) + 1;
      const top = Math.max(...Object.values(freq));
      const share = top / cls.length;
      if (share > LIMITS.PERIOD_SHARE) {
        periodHits.push(
          [
            "周期",
            k,
            "の",
            r,
            "番目: ",
            Math.round(share * 100),
            "%が同じ位置 (",
            cls.length,
            "問中",
            top,
            "問)",
          ].join("")
        );
      }
    }
  }

  /* ---- 重複 ---- */
  const seen = new Map();
  const dupsInside = [];
  for (const it of paid) {
    const k = norm(it.q);
    if (seen.has(k)) dupsInside.push(`${it.id} ⇔ ${seen.get(k)}`);
    else seen.set(k, it.id);
  }

  const freeMap = new Map();
  for (const f of t.freePool) {
    for (const it of readQuestions(f)) {
      if (t.excludeCategoryPrefix && it.category.startsWith(t.excludeCategoryPrefix)) continue;
      freeMap.set(norm(it.q), `${path.basename(f)}:${it.id}`);
    }
  }
  const dupsFree = [];
  for (const it of paid) {
    const hit = freeMap.get(norm(it.q));
    if (hit) dupsFree.push(`${it.id} ⇔ ${hit}`);
  }

  const n = paid.length;
  const pct = (x) => Math.round((x / n) * 1000) / 10;
  const maxPosPct = pct(Math.max(...pos));
  const gapPct = pct(overGap.length);

  console.log(`  正解肢が${LIMITS.GAP_CHARS}字以上長い: ${overGap.length}問 (${gapPct}%)  [上限 ${LIMITS.GAP_RATIO_PCT}%]`);
  console.log(`  正解位置の最大偏り : ${maxPosPct}%  [上限 ${LIMITS.ANSWER_POS_PCT}%]`);
  console.log(
    `  ${SHOWN}択表示での正解位置: ${shownCount.slice(0, SHOWN).join(" / ")}  ※受験者が実際に見る分布`
  );
  console.log(`  正解位置の周期性   : ${periodHits.length}件  [上限 0件]`);
  console.log(`  設問文の重複(内部) : ${dupsInside.length}件  [上限 ${LIMITS.DUP_MAX}件]`);
  console.log(`  無料問題との重複   : ${dupsFree.length}件  [上限 ${LIMITS.DUP_MAX}件]  ※有料の生命線`);
  console.log(`  解説が位置に言及   : ${posRef}問  [上限 ${LIMITS.POS_REF_MAX}問]`);
  if (MODE === "drop3")
    console.log(`  解説が見えない選択肢を否定: ${ghostRefs.length}問  [上限 0問]`);
  if (shape) console.log(`  形式不正           : ${shape}件`);

  if (shape > 0) violations.push(`形式不正が${shape}件`);
  if (ghostRefs.length > 0)
    violations.push(
      `解説が表示されない選択肢を名指しで否定している問題が${ghostRefs.length}問 (${ghostRefs.slice(0, 5).join(", ")}${ghostRefs.length > 5 ? " ほか" : ""})`
    );
  if (posRef > LIMITS.POS_REF_MAX) violations.push(`解説が選択肢の位置に言及している問題が${posRef}問`);
  if (gapPct > LIMITS.GAP_RATIO_PCT)
    violations.push(`正解肢が${LIMITS.GAP_CHARS}字以上長い問題が${overGap.length}問(${gapPct}%)`);
  if (maxPosPct > LIMITS.ANSWER_POS_PCT) violations.push(`正解位置が${maxPosPct}%に偏っている`);
  if (periodHits.length > 0)
    violations.push(
      `正解位置に周期パターンがある(${periodHits.length}件) — 分布が均等でも規則的だと内容を知らずに当てられる\n      ` +
        periodHits.slice(0, 4).join("\n      ")
    );
  if (dupsInside.length > LIMITS.DUP_MAX) violations.push(`第2回の内部で設問が${dupsInside.length}件重複`);
  if (dupsFree.length > LIMITS.DUP_MAX)
    violations.push(`無料で公開済みの問題と${dupsFree.length}件重複 — 有料商品として成立しない`);

  if (violations.length) {
    anyViolation = true;
    console.log("\n  違反:");
    violations.forEach((v) => console.log("    - " + v));
    if (dupsFree.length) {
      console.log("\n  無料問題との重複(先頭5件):");
      dupsFree.slice(0, 5).forEach((d) => console.log("    " + d));
    }
    if (dupsInside.length) {
      console.log("\n  内部重複(先頭5件):");
      dupsInside.slice(0, 5).forEach((d) => console.log("    " + d));
    }
    if (overGap.length) {
      console.log("\n  正解肢が長い上位5件:");
      overGap.sort((a, b) => b.gap - a.gap).slice(0, 5).forEach((o) => console.log(`    ${o.id} (+${o.gap}字)`));
    }
  } else {
    console.log("  → 監査OK");
  }
}

console.log("");
if (REPORT_ONLY) process.exit(0);
if (anyViolation) {
  console.error("audit-moshi2: 違反があるためビルドを中止します\n");
  process.exit(1);
}
