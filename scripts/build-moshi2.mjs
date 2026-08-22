#!/usr/bin/env node
// =============================================================================
// 生成→検品ワークフローの出力から、第2回模試(有料)の問題データファイルを作る。
//
//   node scripts/build-moshi2.mjs <input.json> [certId]
//
// 入力 JSON の形:
//   { "byCat": { "kaibou": [ {q, choices[4], answer, explain, drop}, ... ], ... } }
//
// やること:
//   1. 分野ごとに必要数を切り出して、仕様の問題数(products.ts)ちょうどにする
//   2. 分野を混ぜて出題順を作る(1つの分野が固まらないよう等間隔に配る)
//   3. 正解位置を 0,1,2,3 に均す(長さや位置から正解を推測されないため)
//   4. TypeScript のデータファイルとして書き出す
//
// 3 は audit-moshi2.mjs の「正解位置の偏り」を確実に通すための処理。
// 生成モデルに散らすよう指示はしているが、機械で均すほうが確実。
// =============================================================================

import fs from "node:fs";
import path from "node:path";

const [, , inputPath, certArg, ...rest] = process.argv;
const CERT = certArg ?? "nsca-cpt";

/* 本試験の選択肢数に合わせた表示方法。データは常に4択で持ち、表示時に変換する。
     drop3  4択から誤答を1本落として3択にする(NSCA-CPT/CSCS)
     plain  4択のまま(第二種電気工事士・消防設備士6類・冷凍3種)
     extra5 4択に5本目の誤答を足して五肢択一にする(危険物乙4・ボイラー・ビル管理士)
   extra5 では入力の各問に extra5(5本目の誤答文)が要る。 */
const DISPLAY = (rest.find((a) => a.startsWith("--display="))?.split("=")[1] ?? "drop3");

/* 選択肢の並びに意味がある出題形式(冷凍3種の「イ・ロ・ハの正誤組合せ」など)では、
   並べ替えると不自然な紙面になる。その場合は入力の順序と正解位置をそのまま使う。
   正解位置の散らばりは、問題を作る側で担保すること。 */
const KEEP_ORDER = rest.includes("--keep-order");
if (!["drop3", "plain", "extra5"].includes(DISPLAY)) {
  console.error(`--display は drop3 / plain / extra5 のいずれか(指定: ${DISPLAY})`);
  process.exit(1);
}

if (!inputPath) {
  console.error("使い方: node scripts/build-moshi2.mjs <input.json> <certId> [--display=drop3|plain|extra5]");
  process.exit(1);
}

/* ---- 仕様(products.ts)から問題数を読む。二重定義を避けるため直読み ---- */
const productsSrc = fs.readFileSync("src/data/products.ts", "utf8");
/* この資格の定義だけを切り出す。単純に split すると、questionCount のような
   必須項目は先頭で拾えるが、sections のような任意項目は「後ろの資格のもの」を
   拾ってしまう(実際に踏んだ)。対応する閉じ括弧まででブロックを閉じる。 */
const blockStart = productsSrc.indexOf(`"${CERT}": {`);
let block = null;
if (blockStart >= 0) {
  const open = productsSrc.indexOf("{", blockStart);
  let depth = 0, i = open;
  for (; i < productsSrc.length; i++) {
    if (productsSrc[i] === "{") depth++;
    else if (productsSrc[i] === "}") { depth--; if (depth === 0) break; }
  }
  block = productsSrc.slice(open, i + 1);
}
if (!block) {
  console.error(`products.ts に "${CERT}" の第2回商品が定義されていません`);
  process.exit(1);
}
const TARGET = Number((block.match(/questionCount: (\d+)/) || [])[1]);

/* 科目別の合格基準がある試験(乙4・ボイラー・ビル管理士など)は、分野ごとの
   出題数が決まっていて、かつ問題が科目順に並んでいる必要がある
   (sections の start を出題順から算出しているため)。
   sections があるときは、均等割りも分野の混ぜ込みも行わない。 */
let sectionsRaw = "";
{
  const at = block.indexOf("sections:");
  if (at >= 0) {
    // categories: [...] の ] で切れないよう、外側の [ ] を対応で数える
    const open = block.indexOf("[", at);
    let depth = 0, k = open;
    for (; k < block.length; k++) {
      if (block[k] === "[") depth++;
      else if (block[k] === "]") { depth--; if (depth === 0) break; }
    }
    sectionsRaw = block.slice(open, k + 1);
  }
}
const SECTIONS = [...sectionsRaw.matchAll(/categories:\s*\[([^\]]*)\][^}]*?count:\s*(\d+)/g)].map(
  (m) => ({
    categories: [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
    count: Number(m[2]),
  })
);
const GROUPED = SECTIONS.length > 0;

/* 分野ごとの出題数だけを指定する形(科目別判定は無い)。順序は混ぜたまま */
const countsRaw = block.split("categoryCounts:")[1]?.split("}")[0] ?? "";
const CATEGORY_COUNTS = Object.fromEntries(
  [...countsRaw.matchAll(/"([^"]+)":\s*(\d+)/g)].map((m) => [m[1], Number(m[2])])
);
const HAS_COUNTS = Object.keys(CATEGORY_COUNTS).length > 0;
if (HAS_COUNTS && !GROUPED) {
  const sum = Object.values(CATEGORY_COUNTS).reduce((a, b) => a + b, 0);
  if (sum !== TARGET) {
    console.error(`categoryCounts の合計 ${sum}問 が questionCount ${TARGET}問 と一致しません`);
    process.exit(1);
  }
}
if (GROUPED) {
  const sum = SECTIONS.reduce((n, x) => n + x.count, 0);
  if (sum !== TARGET) {
    console.error(`sections の合計 ${sum}問 が questionCount ${TARGET}問 と一致しません`);
    process.exit(1);
  }
}
if (!Number.isFinite(TARGET) || TARGET <= 0) {
  console.error("products.ts から questionCount を読めませんでした");
  process.exit(1);
}

/* ---- 資格ごとの分野構成(certs.ts の CERTS.categories と揃える) ---- */
const certsSrc = fs.readFileSync("src/data/certs.ts", "utf8");
const certBlock = certsSrc.split(`id: "${CERT}"`)[1];
const CATS = [...(certBlock.match(/categories: \[([^\]]*)\]/) || [])[1].matchAll(/"([^"]+)"/g)].map(
  (m) => m[1]
);
// 科目定義にだけ現れる分野(鑑別等)も対象に含める
for (const sec of SECTIONS) for (const c of sec.categories) if (!CATS.includes(c)) CATS.push(c);

if (CATS.length === 0) {
  console.error(`certs.ts から ${CERT} の分野を読めませんでした`);
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const byCat = input.byCat ?? input;

/* ---- 1. 分野ごとの必要数(最大剰余法で TARGET ちょうどに割る) ---- */
let need;
if (GROUPED) {
  // 分野ごとの内訳は categoryCounts が優先。無ければ科目内で均等に割る
  need = {};
  for (const sec of SECTIONS) {
    if (sec.categories.every((c) => CATEGORY_COUNTS[c] !== undefined)) {
      for (const c of sec.categories) need[c] = CATEGORY_COUNTS[c];
    } else {
      const base = Math.floor(sec.count / sec.categories.length);
      const rem = sec.count - base * sec.categories.length;
      sec.categories.forEach((c, i) => { need[c] = base + (i < rem ? 1 : 0); });
    }
  }
} else if (HAS_COUNTS) {
  need = Object.fromEntries(CATS.map((c) => [c, CATEGORY_COUNTS[c] ?? 0]));
} else {
  const base = Math.floor(TARGET / CATS.length);
  const remainder = TARGET - base * CATS.length;
  need = Object.fromEntries(CATS.map((c, i) => [c, base + (i < remainder ? 1 : 0)]));
}

const picked = {};
let shortage = 0;
for (const c of CATS) {
  const pool = Array.isArray(byCat[c]) ? byCat[c] : [];
  const valid = pool.filter(
    (q) =>
      q &&
      typeof q.q === "string" &&
      Array.isArray(q.choices) &&
      (DISPLAY === "plain" ? q.choices.length === 4 || q.choices.length === 5 : q.choices.length === 4) &&
      Number.isInteger(q.answer) &&
      q.answer >= 0 &&
      q.answer < q.choices.length &&
      typeof q.explain === "string" &&
      // drop(間引く誤答)は3択表示のときだけ要る
      (DISPLAY !== "drop3" ||
        (Number.isInteger(q.drop) && q.drop >= 0 && q.drop <= 3 && q.drop !== q.answer)) &&
      // 5本目の誤答は五肢択一表示のときだけ要る
      (DISPLAY !== "extra5" || (typeof q.extra5 === "string" && q.extra5.length > 0))
  );
  picked[c] = valid.slice(0, need[c]);
  const miss = need[c] - picked[c].length;
  if (miss > 0) {
    shortage += miss;
    console.warn(`  ! ${c}: ${miss}問不足 (検品通過 ${valid.length}問 / 必要 ${need[c]}問)`);
  }
}

if (shortage > 0) {
  console.error(
    `\n合計 ${shortage}問 不足しています(必要 ${TARGET}問)。` +
      `\nワークフローを追加実行して不足分を作ってから、もう一度実行してください。` +
      `\n中途半端な問題数のまま書き出すと loadMoshi2 が販売を止めます。\n`
  );
  process.exit(1);
}

/* ---- 2. 分野を混ぜた出題順を作る(同じ分野が固まらないように等間隔で配る) ---- */
const order = [];
if (GROUPED) {
  // 科目順にまとめて並べる。sections の start がこの順序に依存している
  for (const sec of SECTIONS) {
    for (const c of sec.categories) for (const q of picked[c] ?? []) order.push({ cat: c, q });
  }
} else {
  // 1つの分野が固まらないよう等間隔に混ぜる
  const cursors = Object.fromEntries(CATS.map((c) => [c, 0]));
  while (order.length < TARGET) {
    for (const c of CATS) {
      if (cursors[c] < picked[c].length) {
        order.push({ cat: c, q: picked[c][cursors[c]++] });
        if (order.length === TARGET) break;
      }
    }
  }
}

/* ---- 3. 正解位置を散らす + ID採番 ----
   単純に i % 4 で均すと「4問ごとに同じ位置が正解」という周期になり、
   分布は均等でも完全に予測可能になる(実際にそうなって解答一覧に縞模様が出た)。
   均等かつ規則性が出ないよう、位置の配列をシードつきの擬似乱数でシャッフルして割り当てる。
   シードを固定しているのは、同じ入力からは毎回同じ紙面が出るようにするため。

   受験者が実際に目にするのは、drop3 で誤答を1本落とした「3択での正解位置」。
   そちらを直接コントロールしたいので、
     f = 3択にしたときの正解位置(0..2)
     p = 落とす誤答を4択のどこに差し込むか(0..3)
   を独立に均等割り当てし、そこから 4択での answer と drop を逆算する。
   a = p <= f ? f + 1 : f、d = p。この作り方だと a も 0..3 に均等に散る。 */
function makeRng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(0x5f2b1a7);

/** 0..m-1 を均等な回数だけ並べてシャッフルした配列を作る */
function balancedShuffled(m, n) {
  const arr = Array.from({ length: n }, (_, i) => i % m);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
/** 挿入位置は問題IDから決まる(表示側と同じ式)。extra5 のときだけ使う */
function insertPos(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h % 5;
}

// 先にIDを決める。extra5 では挿入位置がIDから決まるため、位置の割り当てに要る
const counters = Object.fromEntries(CATS.map((c) => [c, 0]));
const ids = order.map(({ cat }) => `${cat}-r2-${++counters[cat]}`);

/* 受験者が実際に目にする位置(表示上の正解位置)を均等かつ不規則に散らす。
   何択で見えるかは表示方法で変わるので、そこに合わせて割り当てる。 */
const SHOWN = DISPLAY === "drop3" ? 3 : DISPLAY === "extra5" ? 5 : 4;
let shownPos;
if (DISPLAY === "plain") {
  // 4択と5択が混ざりうる(消防設備士は筆記4択+鑑別5択)。
  // 選択肢数ごとに分けて均等化しないと、5択側で存在しない位置を指してしまう。
  const lens = order.map(({ q }) => q.choices.length);
  shownPos = new Array(TARGET);
  for (const L of new Set(lens)) {
    const idx = lens.map((v, i) => (v === L ? i : -1)).filter((i) => i >= 0);
    const seq = balancedShuffled(L, idx.length);
    idx.forEach((qi, k) => { shownPos[qi] = seq[k]; });
  }
} else {
  shownPos = balancedShuffled(SHOWN, TARGET);
}

// extra5 では5本目が入る位置(IDで決まる)に正解を置けない。衝突は入れ替えて解消する
if (DISPLAY === "extra5") {
  const posOf = ids.map(insertPos);
  for (let i = 0; i < TARGET; i++) {
    if (shownPos[i] !== posOf[i]) continue;
    // 交換しても双方が衝突しない相手を探す
    const j = shownPos.findIndex(
      (v, k) => k !== i && v !== posOf[i] && shownPos[i] !== posOf[k]
    );
    if (j >= 0) [shownPos[i], shownPos[j]] = [shownPos[j], shownPos[i]];
    else shownPos[i] = (shownPos[i] + 1) % SHOWN; // 見つからなければ均等さを1問だけ譲る
  }
}

const P = DISPLAY === "drop3" ? balancedShuffled(4, TARGET) : null; // 落とす誤答の差し込み位置

const questions = order.map(({ cat, q }, i) => {
  const id = ids[i];
  const t = shownPos[i];
  const answerText = q.choices[q.answer];

  if (DISPLAY === "drop3") {
    const p = P[i];
    const droppedText = q.choices[q.drop];
    const others = q.choices.filter((_, ci) => ci !== q.answer && ci !== q.drop);
    if (rng() < 0.5) others.reverse();

    const kept = [];
    let oi = 0;
    for (let k = 0; k < 3; k++) kept.push(k === t ? answerText : others[oi++]);
    const choices = [...kept];
    choices.splice(p, 0, droppedText);

    return { id, cert: CERT, category: cat, q: q.q, choices,
             answer: p <= t ? t + 1 : t, explain: q.explain, drop: p };
  }

  // 並びに意味がある形式は、入力のまま書き出す
  if (KEEP_ORDER) {
    return { id, cert: CERT, category: cat, q: q.q, choices: [...q.choices],
             answer: q.answer, explain: q.explain, extra5: q.extra5 };
  }

  // plain / extra5: 保存する選択肢の中で正解位置を決める
  const wrongs = q.choices.filter((_, ci) => ci !== q.answer);
  if (rng() < 0.5) wrongs.reverse();

  // extra5 は5本目が入ると正解の index が1つ後ろへずれる。ずれを見込んで逆算する
  const stored = DISPLAY === "extra5" && t > insertPos(id) ? t - 1 : t;
  const choices = [];
  let wi = 0;
  for (let k = 0; k < q.choices.length; k++) choices.push(k === stored ? answerText : wrongs[wi++]);

  return { id, cert: CERT, category: cat, q: q.q, choices,
           answer: stored, explain: q.explain, extra5: q.extra5 };
});

// extra5 のときは5本目が全問そろっていないと紙面が作れない
if (DISPLAY === "extra5") {
  const missing = questions.filter((q) => !q.extra5).map((q) => q.id);
  if (missing.length) {
    console.error(`5本目の誤答(extra5)が無い問題が ${missing.length} 件あります。書き出しを中止します。`);
    missing.slice(0, 5).forEach((id) => console.error("  - " + id));
    process.exit(1);
  }
}

/* ---- 4. 書き出し ---- */
const s = (v) => JSON.stringify(v);
const today = new Date().toISOString().slice(0, 10);

const body = questions
  .map(
    (q) => `  {
    id: ${s(q.id)},
    cert: ${s(q.cert)},
    category: ${s(q.category)},
    q: ${s(q.q)},
    choices: [${q.choices.map(s).join(", ")}]${q.choices.length === 4 ? " as [string, string, string, string]" : ""},
    answer: ${q.answer},
    explain: ${s(q.explain)},
  },`
  )
  .join("\n");

const EXPORT_NAME = `${CERT.replace(/-/g, "_").toUpperCase()}_MOSHI2`;

const mapEntries = (fn) => questions.map(fn).join("\n");
const extraDecl =
  DISPLAY === "drop3"
    ? `/** 3肢択一の本試験に合わせて間引く誤答の index(問題ID → index)。 */
const DROP3: Record<string, number> = {
${mapEntries((q) => `  ${s(q.id)}: ${q.drop},`)}
};
`
    : DISPLAY === "extra5"
      ? `/** 五肢択一の本試験に合わせて足す5本目の誤答(問題ID → 選択肢文)。 */
const EXTRA5: Record<string, string> = {
${mapEntries((q) => `  ${s(q.id)}: ${s(q.extra5)},`)}
};
`
      : "";
const extraField =
  DISPLAY === "drop3" ? "\n  drop3: DROP3," : DISPLAY === "extra5" ? "\n  extra5: EXTRA5," : "";

const out = `// =============================================================================
// ${CERT.toUpperCase()} 模擬試験 第2回(有料) — サーバー専用の問題データ。
//
// 【自動生成】scripts/build-moshi2.mjs が書き出しました。手修正は可能ですが、
//   再生成すると上書きされます。
//
// 【重要】クライアントコンポーネントから import しないこと。
//   配信は /api/moshi2/[certId] のみ(購入者判定を通す)。
//
// 【監査】scripts/audit-moshi2.mjs が prebuild で検査します
//   (正解位置の偏り・正解肢の長さ・解説の位置言及・設問の重複、
//    および無料で公開済みの問題との重複)。
//
// 試験仕様(問題数・時間・合格基準)は src/data/products.ts にあります。
// =============================================================================

import type { Question } from "../certs";
import type { Moshi2Source } from "../moshi2";

/** 出題順の固定ペーパー(全員が同じ問題を同じ順序で解く)。 */
const QUESTIONS: Question[] = [
${body}
];

${extraDecl}
export const ${EXPORT_NAME}: Moshi2Source = {
  questions: QUESTIONS,${extraField}
  updatedAt: ${s(today)},
};
`;

const outPath = path.join("src/data/moshi2", `${CERT}.ts`);
fs.mkdirSync(path.dirname(outPath), { recursive: true }); // 初回移植時は moshi2/ がまだ無い
fs.writeFileSync(outPath, out);

const posCount = [0, 0, 0, 0];
const shownCount = [0, 0, 0, 0, 0];
for (const q of questions) {
  posCount[q.answer]++;
  // 受験者が実際に見る位置。表示方法によって計算が変わる
  if (DISPLAY === "drop3") shownCount[q.answer > q.drop ? q.answer - 1 : q.answer]++;
  else if (DISPLAY === "extra5") {
    const pos = insertPos(q.id);
    shownCount[q.answer >= pos ? q.answer + 1 : q.answer]++;
  } else shownCount[q.answer]++;
}
console.log(`\n${outPath} を書き出しました`);
console.log(`  問題数: ${questions.length} / 仕様 ${TARGET}`);
console.log(`  表示方法: ${DISPLAY} (受験者には${SHOWN}択で見える)${KEEP_ORDER ? " / 選択肢の並びは入力のまま" : ""}`);
console.log(`  分野別: ${CATS.map((c) => `${c}=${counters[c]}`).join(", ")}`);
console.log(`  並び順: ${GROUPED ? "科目ごとにまとめる(科目別の合格判定があるため)" : "分野を混ぜる"}`);
console.log(`  正解位置(保存している4択の上): ${posCount.slice(0, 4).join(" / ")}`);
console.log(
  `  正解位置(${SHOWN}択の表示上): ${shownCount.slice(0, SHOWN).join(" / ")}  ← 受験者が実際に見る分布`
);
console.log(`\n  moshi2.ts の SOURCES に次の1行を足してください:`);
console.log(`    "${CERT}": () => import("./moshi2/${CERT}").then((m) => m.${EXPORT_NAME}),`);
console.log(`\n次: node scripts/audit-moshi2.mjs で監査してください\n`);
