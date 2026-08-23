import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";
import { COLUMNS, columnDates } from "@/data/columns";
import { CERTS, QUESTIONS_UPDATED_AT, ownedCategoriesOfCert, questionsOf, questionsOfCert } from "@/data/questions";
import { MOSHI, MOSHI_UPDATED_AT } from "@/data/moshi";
import { moshi2ProductOf } from "@/data/products";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "");
  // ファイルmtimeはCI(Vercel)ではclone時刻になり偽のlastmodを生むため、
  // 問題データの更新日は定数で管理する(問題を追加・修正したら必ず更新)
  const questionsDate = new Date(QUESTIONS_UPDATED_AT);
  const columnDatesAll = COLUMNS.map((c) => columnDates(c).modified).sort();
  const newestColumn = new Date(columnDatesAll.at(-1) ?? questionsDate);
  const newest = questionsDate > newestColumn ? questionsDate : newestColumn;

  // 信頼ページ(内容を更新したらこの日付も更新)
  const trustPagesDate = new Date("2026-07-10");

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: newest, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/columns/`, lastModified: newestColumn, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/about/`, lastModified: trustPagesDate, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy/`, lastModified: trustPagesDate, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/contact/`, lastModified: trustPagesDate, changeFrequency: "yearly", priority: 0.2 },
  ];

  // 資格別入口ページ + 分野別一問一答ページ
  for (const cert of CERTS) {
    if (questionsOfCert(cert.id).length === 0) continue;
    entries.push({
      url: `${base}/${cert.id}/`,
      lastModified: questionsDate,
      changeFrequency: "weekly",
      priority: 0.9,
    });
    if (MOSHI[cert.id]) {
      entries.push({
        url: `${base}/${cert.id}/moshi/`,
        lastModified: new Date(MOSHI_UPDATED_AT),
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
    // 第2回模試(有料)の商品ページ。問題データは載らないので通常どおり収録する
    if (moshi2ProductOf(cert.id)) {
      entries.push({
        url: `${base}/${cert.id}/moshi2/`,
        lastModified: new Date(MOSHI_UPDATED_AT),
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
    // 共通科目はURL所有者の試験でのみ出力する(静的生成と一致させ、重複URLを載せない)
    for (const cat of ownedCategoriesOfCert(cert)) {
      const qs = questionsOf(cert.id, cat.id);
      if (qs.length === 0) continue;
      entries.push({
        url: `${base}/${cert.id}/${cat.id}/`,
        lastModified: questionsDate,
        changeFrequency: "monthly",
        priority: 0.8,
      });
      // 1問1ページ(論点タイトルのロングテール受け皿)
      for (const q of qs) {
        entries.push({
          url: `${base}/${cert.id}/${cat.id}/${q.id}/`,
          lastModified: questionsDate,
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
    }
  }

  // コラム
  for (const c of COLUMNS) {
    entries.push({
      url: `${base}/columns/${c.slug}/`,
      lastModified: new Date(columnDates(c).modified),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return entries;
}
