// =============================================================================
// 決済後の戻り先(success_url / cancel_url)の判定テスト。
//
// ここは間違えると「決済したのに404」か、最悪「任意のサイトへ飛ばせる
// リダイレクタ」になる。実際に Vercel プレビューからの決済が本番URLへ
// 戻ってしまう事故を起こしたので、以後は実行して確かめる。
//
//   node scripts/test-checkout-origin.mjs
// =============================================================================

import { resolveRedirectOrigin } from "../src/lib/checkout-origin.ts";

const PROD = "https://kintore.shikakumon.com";
const BRANCH = "kintore-git-claude-qr-code-abc.vercel.app";
const DEPLOY = "kintore-9f3k2xq1z-team.vercel.app";

const cases = [
  // --- 本番: Origin を一切信用しない ---------------------------------------
  ["本番 / Origin なし", null, { NODE_ENV: "production" }, PROD],
  ["本番 / 攻撃者のOrigin", "https://evil.example", { NODE_ENV: "production" }, PROD],
  ["本番 / VERCEL_ENV=production", "https://evil.example",
    { NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_URL: DEPLOY }, PROD],

  // --- プレビュー: NODE_ENV は本番と同じ "production" になる ---------------
  //     (これを見落として本番URLへ飛ばしていたのが元のバグ)
  ["プレビュー / branch URL から", `https://${BRANCH}`,
    { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: DEPLOY, VERCEL_BRANCH_URL: BRANCH },
    `https://${BRANCH}`],
  ["プレビュー / deploy URL から", `https://${DEPLOY}`,
    { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: DEPLOY, VERCEL_BRANCH_URL: BRANCH },
    `https://${DEPLOY}`],
  ["プレビュー / Origin なし → branch URL", null,
    { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: DEPLOY, VERCEL_BRANCH_URL: BRANCH },
    `https://${BRANCH}`],
  ["プレビュー / 偽装Origin は拒否", "https://evil.example",
    { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: DEPLOY, VERCEL_BRANCH_URL: BRANCH },
    `https://${BRANCH}`],
  ["プレビュー / .vercel.app を騙る偽装も拒否", "https://evil.vercel.app",
    { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: DEPLOY, VERCEL_BRANCH_URL: BRANCH },
    `https://${BRANCH}`],
  ["プレビュー / VERCEL_URL だけ", null,
    { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: DEPLOY },
    `https://${DEPLOY}`],
  ["プレビュー / システム変数が無効 → 本番へ", null,
    { NODE_ENV: "production", VERCEL_ENV: "preview" }, PROD],

  // --- ローカル -------------------------------------------------------------
  ["ローカル / localhost:3520", "http://localhost:3520",
    { NODE_ENV: "development" }, "http://localhost:3520"],
  ["ローカル / 127.0.0.1:3520", "http://127.0.0.1:3520",
    { NODE_ENV: "development" }, "http://127.0.0.1:3520"],
  ["ローカル / localhost.evil.com は拒否", "https://localhost.evil.com",
    { NODE_ENV: "development" }, PROD],
  ["ローカル / evil.com/localhost は拒否", "https://evil.com/localhost",
    { NODE_ENV: "development" }, PROD],
  ["ローカル / Origin なし", null, { NODE_ENV: "development" }, PROD],
];

let failed = 0;
for (const [name, origin, env, want] of cases) {
  const got = resolveRedirectOrigin(origin, env, PROD);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}`);
  if (!ok) console.log(`        期待: ${want}\n        実際: ${got}`);
}

console.log(`\n${cases.length - failed}/${cases.length} 通過`);
if (failed) {
  console.error("決済の戻り先の判定が壊れています。修正するまでビルドしないこと。");
  process.exit(1);
}
