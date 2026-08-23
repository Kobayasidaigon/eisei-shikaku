#!/usr/bin/env node
// =============================================================================
// 第2回模試(有料)の売上を Stripe から集計する。
//
//   npm run sales            直近30日
//   npm run sales -- --days=90
//   npm run sales -- --all   全期間
//
// STRIPE_SECRET_KEY を .env.local か環境変数から読む。読み取りしかしない。
//
// Checkout セッションのうち metadata.kind === "moshi2" のものだけを数える。
// 同じ Stripe アカウントで他の商品を売っていても混ざらない。
// 返金は別に取得して差し引くので、テスト購入を返金済みなら純額に出ない。
// =============================================================================
import fs from "node:fs";
import Stripe from "stripe";
import { MOSHI2_PRODUCTS } from "../src/data/products.ts";

const STRIPE_API_VERSION = "2026-07-29.dahlia";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY がありません。.env.local に置くか環境変数で渡してください。");
  process.exit(1);
}
const args = process.argv.slice(2);
const all = args.includes("--all");
const days = Number((args.find((a) => a.startsWith("--days=")) || "").split("=")[1] || 30);
const since = all ? undefined : Math.floor(Date.now() / 1000) - days * 86400;

const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });

process.on("uncaughtException", (e) => {
  console.error("\nStripe に問い合わせできませんでした。");
  console.error("  " + (e?.message ?? e));
  console.error("  鍵が正しいか、ネットワークから api.stripe.com に出られるかを確認してください。\n");
  process.exit(1);
});
const NAME = Object.fromEntries(
  Object.values(MOSHI2_PRODUCTS).filter(Boolean).map((p) => [p.certId, p.name])
);
const yen = (n) => "¥" + n.toLocaleString("ja-JP");
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);

/* ---- 決済 ---- */
const paid = [];
for await (const s of stripe.checkout.sessions.list({
  limit: 100, ...(since ? { created: { gte: since } } : {}),
})) {
  if (s.metadata?.kind !== "moshi2" || s.payment_status !== "paid") continue;
  paid.push({
    certId: s.metadata.certId ?? "(不明)",
    amount: s.amount_total ?? 0,
    created: s.created,
    pi: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id,
    email: s.customer_details?.email ?? "",
  });
}

/* ---- 返金(決済と突き合わせる) ---- */
const refunded = new Map();
for await (const r of stripe.refunds.list({ limit: 100, ...(since ? { created: { gte: since } } : {}) })) {
  const pi = typeof r.payment_intent === "string" ? r.payment_intent : r.payment_intent?.id;
  if (pi) refunded.set(pi, (refunded.get(pi) ?? 0) + r.amount);
}

const mode = key.startsWith("sk_live") ? "本番" : "テスト";
const span = all ? "全期間" : `直近${days}日`;
console.log(`\n${mode}キー / ${span} / 決済 ${paid.length}件\n`);

if (!paid.length) {
  console.log("  この期間の第2回模試の決済はありません。");
  process.exit(0);
}

/* ---- 資格ごと ---- */
const by = {};
for (const p of paid) {
  const b = (by[p.certId] ??= { n: 0, gross: 0, ref: 0, refN: 0 });
  b.n++; b.gross += p.amount;
  const r = refunded.get(p.pi) ?? 0;
  if (r) { b.ref += r; b.refN++; }
}
const W = Math.max(...Object.keys(by).map((k) => (NAME[k] ?? k).length), 8);
console.log("  " + "資格".padEnd(W, "　") + "   件数    売上      返金     純額");
let G = 0, R = 0, N = 0;
for (const [cert, b] of Object.entries(by).sort((a, b2) => b2[1].gross - a[1].gross)) {
  G += b.gross; R += b.ref; N += b.n;
  console.log(`  ${(NAME[cert] ?? cert).padEnd(W, "　")} ${String(b.n).padStart(5)} ${yen(b.gross).padStart(9)} ` +
    `${(b.ref ? `-${yen(b.ref)}(${b.refN})` : "—").padStart(11)} ${yen(b.gross - b.ref).padStart(9)}`);
}
console.log("  " + "─".repeat(W * 2 + 36));
console.log(`  ${"合計".padEnd(W, "　")} ${String(N).padStart(5)} ${yen(G).padStart(9)} ` +
  `${(R ? "-" + yen(R) : "—").padStart(11)} ${yen(G - R).padStart(9)}`);

/* ---- 日ごと ---- */
const daily = {};
for (const p of paid) (daily[day(p.created)] ??= []).push(p);
const ds = Object.keys(daily).sort();
console.log(`\n  日ごと(決済のあった日だけ / ${ds.length}日)`);
for (const d of ds.slice(-21)) {
  const v = daily[d];
  const s = v.reduce((a, x) => a + x.amount, 0);
  console.log(`    ${d}  ${String(v.length).padStart(3)}件 ${yen(s).padStart(9)}  ${"■".repeat(Math.min(v.length, 40))}`);
}

/* ---- 直近の決済 ---- */
console.log("\n  直近の決済");
for (const p of paid.sort((a, b2) => b2.created - a.created).slice(0, 10)) {
  const r = refunded.get(p.pi) ?? 0;
  console.log(`    ${day(p.created)}  ${(NAME[p.certId] ?? p.certId).padEnd(W, "　")} ${yen(p.amount).padStart(8)}` +
    `${r ? "  返金済" : ""}`);
}
console.log("");
