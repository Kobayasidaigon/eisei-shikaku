#!/usr/bin/env node
// =============================================================================
// Stripe 連携の自己診断。
//
//   npm run stripe:check
//
// STRIPE_SECRET_KEY を .env.local か環境変数から読み、アプリと同じ設定で
// Checkout セッションを1件作って、返ってきた内容が products.ts の定義と
// 食い違っていないかを確かめる。確認が済んだセッションはその場で失効させる
// ので、ダッシュボードに未完了の決済が溜まることはない。
//
// 「金額が1桁違う」「通貨が違う」「戻り先URLにセッションIDが入っていない」
// といった、実際に決済してみるまで気づきにくい事故を先に潰すのが目的。
//
// 最後に決済ページのURLを表示するので、テストキーならそのまま開いて
// テストカード 4242 4242 4242 4242 で通し確認ができる。
// =============================================================================

import fs from "node:fs";
import path from "node:path";

/* ---- .env.local を読む(依存を増やさないための簡易パーサ) ---- */
function loadEnvLocal() {
  const p = ".env.local";
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error(
    "\nSTRIPE_SECRET_KEY がありません。" +
      "\n.env.local に次の行を足してから、もう一度実行してください。" +
      "\n\n  STRIPE_SECRET_KEY=sk_test_xxxxxxxx\n"
  );
  process.exit(1);
}

const MODE = KEY.startsWith("sk_live_") ? "本番(live)" : KEY.startsWith("sk_test_") ? "テスト(test)" : "不明";
if (MODE === "不明") {
  console.error("\nSTRIPE_SECRET_KEY の形式が想定外です(sk_test_ か sk_live_ で始まるはずです)。\n");
  process.exit(1);
}

/* ---- アプリと同じ設定値を読む ---- */
const STRIPE_API_VERSION = (() => {
  const src = fs.readFileSync("src/app/api/checkout/route.ts", "utf8");
  const m = src.match(/STRIPE_API_VERSION = "([^"]+)"/);
  if (!m) throw new Error("checkout/route.ts から STRIPE_API_VERSION を読めませんでした");
  return m[1];
})();

const SITE_URL = (() => {
  const src = fs.readFileSync("src/data/site.ts", "utf8");
  const m = src.match(/url:\s*"([^"]+)"/);
  if (!m) throw new Error("site.ts から url を読めませんでした");
  return m[1].replace(/\/$/, "");
})();

/** products.ts から販売中の商品を読む(アプリと同じ定義元を見る) */
function readProducts() {
  const src = fs.readFileSync("src/data/products.ts", "utf8");
  const body = src.split("MOSHI2_PRODUCTS")[1] ?? "";
  const out = [];
  const re = /"([a-z0-9-]+)":\s*\{([\s\S]*?)\n  \},/g;
  let m;
  while ((m = re.exec(body))) {
    const b = m[2];
    const get = (k, num = false) => {
      const r = new RegExp(num ? `${k}:\\s*(\\d+)` : `${k}:\\s*"([^"]*)"`);
      const x = b.match(r);
      return x ? (num ? Number(x[1]) : x[1]) : undefined;
    };
    out.push({
      certId: m[1],
      name: get("name"),
      priceJpy: get("priceJpy", true),
      description: get("description"),
    });
  }
  return out.filter((p) => p.certId && p.name && Number.isFinite(p.priceJpy));
}

const products = readProducts();

console.log("");
console.log("  キーの種類      : " + MODE);
console.log("  API バージョン  : " + STRIPE_API_VERSION);
console.log("  サイトURL       : " + SITE_URL);
console.log("  販売中の商品    : " + products.length + "件");
if (products.length === 0) {
  console.error("\nproducts.ts に販売中の商品がありません。\n");
  process.exit(1);
}
console.log("");

const Stripe = (await import("stripe")).default;
const stripe = new Stripe(KEY, { apiVersion: STRIPE_API_VERSION });

/* ---- アカウントの状態 ---- */
try {
  const acct = await stripe.accounts.retrieve();
  console.log("  アカウント      : " + (acct.settings?.dashboard?.display_name || acct.id));
  console.log("  決済の受付      : " + (acct.charges_enabled ? "有効" : "!! 無効(審査が未完了の可能性)"));
  console.log("  入金             : " + (acct.payouts_enabled ? "有効" : "!! 無効"));
  console.log("  既定通貨        : " + (acct.default_currency || "?").toUpperCase());
} catch (e) {
  console.error("\nStripe に接続できませんでした: " + e.message + "\n");
  process.exit(1);
}
console.log("");

let failed = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? "OK  " : "NG  "} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failed++;
};

for (const p of products) {
  console.log(`── ${p.name} (${p.certId}) ─────────────────`);

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: p.priceJpy,
            product_data: { name: p.name, description: p.description },
          },
        },
      ],
      success_url: `${SITE_URL}/${p.certId}/moshi2/?s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/${p.certId}/moshi2/?canceled=1`,
      metadata: { certId: p.certId, kind: "moshi2" },
      payment_intent_data: { metadata: { certId: p.certId, kind: "moshi2" } },
    });
  } catch (e) {
    check("セッションの作成", false, e.message);
    console.log("");
    continue;
  }

  check("セッションの作成", true);
  // JPY はゼロ十進通貨。unit_amount がそのまま円になる(1980 → ¥1,980)。
  // ここが2桁ずれる事故が一番多いので、必ず突き合わせる。
  check(
    "請求額が products.ts と一致",
    session.amount_total === p.priceJpy,
    `Stripe ¥${session.amount_total?.toLocaleString()} / 定義 ¥${p.priceJpy.toLocaleString()}`
  );
  check("通貨が jpy", session.currency === "jpy", session.currency);
  check("決済ページのURLが発行された", Boolean(session.url));
  check("metadata.certId", session.metadata?.certId === p.certId, session.metadata?.certId);
  check("metadata.kind", session.metadata?.kind === "moshi2", session.metadata?.kind);
  check(
    "戻り先にセッションIDが入る",
    typeof session.success_url === "string" && session.success_url.includes("cs_"),
    "決済後にこのIDをStripeへ照会して受験権を出すため"
  );
  check("この時点では未払い", session.payment_status === "unpaid", session.payment_status);

  // /api/unlock と同じ手順で読み直せるか
  try {
    const again = await stripe.checkout.sessions.retrieve(session.id);
    check("セッションを再取得できる", again.id === session.id, "/api/unlock がこの手順で確認する");
  } catch (e) {
    check("セッションを再取得できる", false, e.message);
  }

  if (session.url) {
    console.log("\n  決済ページ:\n  " + session.url);
    if (MODE.startsWith("テスト")) {
      console.log("  テストカード 4242 4242 4242 4242 / 有効期限は未来の日付 / CVCは任意の3桁");
    }
  }

  // 確認用に作っただけなので失効させる(ダッシュボードに残さない)
  try {
    await stripe.checkout.sessions.expire(session.id);
    console.log("  ※ 確認用のセッションは失効させました");
  } catch {
    console.log("  ※ 確認用セッションの失効に失敗しました(実害はありません)");
  }
  console.log("");
}

if (failed > 0) {
  console.error(`診断: ${failed}件の問題があります。上の NG を確認してください。\n`);
  process.exit(1);
}

console.log("診断: 問題なし。");
if (MODE.startsWith("本番")) {
  console.log("本番キーで確認しました。ACCESS_SECRET の設定漏れがないかもあわせてご確認ください。\n");
} else {
  console.log("上の決済ページを開き、テストカードで通し確認をしてください。");
  console.log("決済後に受験権のcookieまで確認するには、ACCESS_SECRET も設定してから");
  console.log("npm run dev で立ち上げ、実際に購入ボタンから進んでください。\n");
}
