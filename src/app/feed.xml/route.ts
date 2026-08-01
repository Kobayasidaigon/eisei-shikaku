import { COLUMNS, columnDates } from "@/data/columns";
import { SITE } from "@/data/site";

/**
 * RSS 2.0 フィード(/feed.xml)。
 *
 * にほんブログ村等のランキングサイト登録やRSSリーダー購読用。
 * output:"export" のため force-static でビルド時に静的生成される。
 * コラム追加時はデプロイで自動更新。
 */
export const dynamic = "force-static";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toPubDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export async function GET() {
  // 更新日(なければ公開日)の新しい順に20件
  const columns = [...COLUMNS]
    .sort((a, b) =>
      columnDates(b).modified.localeCompare(columnDates(a).modified)
    )
    .slice(0, 20);

  const items = columns
    .map((c) => {
      const url = `${SITE.url}/columns/${c.slug}/`;
      return `    <item>
      <title>${escapeXml(c.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(c.lead)}</description>
      <pubDate>${toPubDate(columnDates(c).modified)}</pubDate>
    </item>`;
    })
    .join("\n");

  const lastBuildDate = columns[0]
    ? toPubDate(columnDates(columns[0]).modified)
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.name)}</title>
    <link>${SITE.url}</link>
    <atom:link href="${SITE.url}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(SITE.description)}</description>
    <language>ja</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
