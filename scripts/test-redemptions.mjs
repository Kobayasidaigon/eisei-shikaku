// =============================================================================
// 引き換え回数(端末の切り替え回数)の判定テスト。
//
// 「30日で5回」。間違えると、金を払った人を締め出すか、逆に上限が素通りする。
// どちらも黙って起きるので、実行して確かめる。
//
//   node scripts/test-redemptions.mjs
// =============================================================================

import {
  MAX_REDEMPTIONS,
  REDEMPTION_WINDOW_DAYS,
  consumeRedemption,
  limitReachedMessage,
} from "../src/lib/redemptions.ts";

const DAY = 24 * 60 * 60;
const WINDOW = REDEMPTION_WINDOW_DAYS * DAY;
const NOW = 1_800_000_000; // 固定時刻(Date.now を使わないので結果が揺れない)

function fakeStore(metadata, { failRetrieve = false, failUpdate = false } = {}) {
  const calls = { retrieve: 0, update: 0, lastMetadata: null };
  return {
    calls,
    async retrieve() {
      calls.retrieve++;
      if (failRetrieve) throw new Error("stripe down");
      return { metadata };
    },
    async update(_id, params) {
      calls.update++;
      if (failUpdate) throw new Error("stripe down");
      calls.lastMetadata = params.metadata;
      return {};
    },
  };
}

const cases = [];
const check = (name, fn) => cases.push([name, fn]);

/* ---------- 基本 ---------- */

check(`未使用 → 通す(上限${MAX_REDEMPTIONS}回)`, async () => {
  const s = fakeStore({});
  const r = await consumeRedemption(s, "pi_1", NOW);
  const m = s.calls.lastMetadata;
  return [r.status === "granted" && m.redeemed === "1" && m.redeemedFrom === String(NOW), JSON.stringify(m)];
});

check("上限の1つ手前 → 通す", async () => {
  const s = fakeStore({ redeemed: String(MAX_REDEMPTIONS - 1), redeemedFrom: String(NOW - DAY) });
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "granted" && s.calls.lastMetadata.redeemed === String(MAX_REDEMPTIONS), r.status];
});

check("期間内に上限ちょうど → 拒否し、書き込みもしない", async () => {
  const s = fakeStore({ redeemed: String(MAX_REDEMPTIONS), redeemedFrom: String(NOW - DAY) });
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "limit_reached" && s.calls.update === 0, r.status];
});

/* ---------- 期間の扱い(ここが本体) ---------- */

check(`${REDEMPTION_WINDOW_DAYS}日を過ぎたら回数が戻る`, async () => {
  const s = fakeStore({ redeemed: String(MAX_REDEMPTIONS), redeemedFrom: String(NOW - WINDOW - 1) });
  const r = await consumeRedemption(s, "pi_1", NOW);
  const m = s.calls.lastMetadata;
  return [r.status === "granted" && m.redeemed === "1" && m.redeemedFrom === String(NOW), JSON.stringify(m)];
});

check(`ちょうど${REDEMPTION_WINDOW_DAYS}日で戻る(境界)`, async () => {
  const s = fakeStore({ redeemed: String(MAX_REDEMPTIONS), redeemedFrom: String(NOW - WINDOW) });
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "granted" && s.calls.lastMetadata.redeemed === "1", r.status];
});

check(`${REDEMPTION_WINDOW_DAYS}日に1秒足りなければまだ戻らない(境界)`, async () => {
  const s = fakeStore({ redeemed: String(MAX_REDEMPTIONS), redeemedFrom: String(NOW - WINDOW + 1) });
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "limit_reached", r.status];
});

check("拒否のとき、回数が戻る時刻を返す", async () => {
  const from = NOW - 10 * DAY;
  const s = fakeStore({ redeemed: String(MAX_REDEMPTIONS), redeemedFrom: String(from) });
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "limit_reached" && r.resetAt === from + WINDOW, JSON.stringify(r)];
});

check("期間の起点は途中で伸びない(消費のたびにリセットされない)", async () => {
  const from = NOW - 10 * DAY;
  const s = fakeStore({ redeemed: "2", redeemedFrom: String(from) });
  await consumeRedemption(s, "pi_1", NOW);
  return [s.calls.lastMetadata.redeemedFrom === String(from), s.calls.lastMetadata.redeemedFrom];
});

check("旧データ(redeemedFrom が無い) → 新しい期間として数え直す", async () => {
  const s = fakeStore({ redeemed: "3" });
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "granted" && s.calls.lastMetadata.redeemed === "1", r.status];
});

/* ---------- 締め出さない側に倒す ---------- */

check("PaymentIntent が特定できない → 数えずに通す", async () => {
  const s = fakeStore({});
  const r = await consumeRedemption(s, undefined, NOW);
  return [r.status === "granted" && s.calls.retrieve === 0, r.status];
});

check("Stripe が落ちている(retrieve) → 通す", async () => {
  const s = fakeStore({}, { failRetrieve: true });
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "granted", r.status];
});

check("Stripe が落ちている(update) → 通す", async () => {
  const s = fakeStore({}, { failUpdate: true });
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "granted", r.status];
});

check("redeemed が壊れている → 0 として扱う", async () => {
  const s = fakeStore({ redeemed: "abc", redeemedFrom: String(NOW - DAY) });
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "granted" && s.calls.lastMetadata.redeemed === "1", r.status];
});

check("redeemed が負 → 0 として扱う", async () => {
  const s = fakeStore({ redeemed: "-5", redeemedFrom: String(NOW - DAY) });
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "granted" && s.calls.lastMetadata.redeemed === "1", r.status];
});

check("他の metadata を壊さない", async () => {
  const s = fakeStore({ certId: "nsca-cpt", kind: "moshi2" });
  await consumeRedemption(s, "pi_1", NOW);
  const m = s.calls.lastMetadata;
  return [m.certId === "nsca-cpt" && m.kind === "moshi2" && m.redeemed === "1", JSON.stringify(m)];
});

check("metadata が null → 0 として扱う", async () => {
  const s = fakeStore(null);
  const r = await consumeRedemption(s, "pi_1", NOW);
  return [r.status === "granted" && s.calls.lastMetadata.redeemed === "1", r.status];
});

/* ---------- 通し ---------- */

check(`${MAX_REDEMPTIONS}回まで通り、${MAX_REDEMPTIONS + 1}回目で止まり、期間明けに戻る`, async () => {
  const meta = {};
  const store = {
    async retrieve() { return { metadata: meta }; },
    async update(_id, p) { for (const k of Object.keys(meta)) delete meta[k]; Object.assign(meta, p.metadata); return {}; },
  };
  const got = [];
  for (let i = 0; i < MAX_REDEMPTIONS + 1; i++) {
    got.push((await consumeRedemption(store, "pi_1", NOW + i)).status);
  }
  got.push((await consumeRedemption(store, "pi_1", NOW + WINDOW + 1)).status);
  const want = [...Array(MAX_REDEMPTIONS).fill("granted"), "limit_reached", "granted"];
  return [JSON.stringify(got) === JSON.stringify(want), got.join(",")];
});

check("拒否の文面に復帰日が入る", async () => {
  // 2027-01-15 09:00 JST に戻る想定の値
  const resetAt = Math.floor(Date.parse("2027-01-15T00:00:00Z") / 1000);
  const msg = limitReachedMessage(resetAt, "support@example.com");
  return [msg.includes("1月15日") && msg.includes(String(MAX_REDEMPTIONS))
          && msg.includes("support@example.com"), msg];
});

let failed = 0;
for (const [name, fn] of cases) {
  let ok = false, got = "";
  try { [ok, got] = await fn(); } catch (e) { got = String(e); }
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}`);
  if (!ok) console.log(`        実際: ${got}`);
}
console.log(`\n${cases.length - failed}/${cases.length} 通過`);
if (failed) {
  console.error("引き換え回数の判定が壊れています。修正するまでビルドしないこと。");
  process.exit(1);
}
