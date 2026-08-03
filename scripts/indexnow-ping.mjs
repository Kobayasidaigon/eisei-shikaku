// IndexNow ping スクリプト
//
// 使用法: npm run indexnow
//
// 本番の sitemap.xml から全URLを取得し、IndexNow API(Bing等が採用)に
// 「これらのURLが更新された」と通知する。記事・ページ追加のデプロイ後に
// 1回実行するだけでよい(Googleは非対応だが害はない)。
//
// 前提: public/{KEY}.txt が本番にデプロイ済みであること。

const HOST = "eisei.shikakumon.com";
// 本サイト専用の IndexNow キー。public/{KEY}.txt に同じ文字列を置いてある。
// (キーはサイトごとに固有にする必要があるため、姉妹サイトのものを流用しないこと)
const KEY = "c91787eb780ae215b000ded4d9b8bac6";
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

async function main() {
  const keyUrl = `https://${HOST}/${KEY}.txt`;
  const keyRes = await fetch(keyUrl);
  if (!keyRes.ok) {
    console.error(
      `キーファイルが本番にありません(${keyRes.status}): ${keyUrl}\n先にデプロイしてください。`
    );
    process.exit(1);
  }

  const res = await fetch(SITEMAP_URL);
  if (!res.ok) {
    console.error(`sitemap取得失敗: ${res.status}`);
    process.exit(1);
  }
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) {
    console.error("sitemapからURLを抽出できませんでした");
    process.exit(1);
  }
  console.log(`sitemapから ${urls.length} URLを抽出`);

  const body = { host: HOST, key: KEY, keyLocation: keyUrl, urlList: urls };
  const ping = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  console.log(`IndexNow応答: ${ping.status} ${ping.statusText}`);
  if (ping.status === 200 || ping.status === 202) {
    console.log("送信完了。Bing等のクローラーに更新が通知されました。");
  } else {
    console.error(await ping.text());
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
