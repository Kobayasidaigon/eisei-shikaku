// 2026-09-20 新設。第2回模試(eisei1/eisei2)を有料販売しているのに特定商取引法に基づく
// 表示が無かったため、筋トレ資格ドリルの /legal/ を移植した。値は SITE / products /
// moshi2-config / redemptions から引くので、このファイルにサイト固有の数字は無い。
import type { Metadata } from "next";
import Link from "next/link";
import { SITE, OG_BASE } from "@/data/site";
import { MOSHI2_PRODUCTS } from "@/data/products";
import { MAX_REDEMPTIONS, REDEMPTION_WINDOW_DAYS } from "@/lib/redemptions";
import { MOSHI2_CONFIG } from "@/data/moshi2-config";

const PAGE_TITLE = "特定商取引法に基づく表示";
const PAGE_DESC = `${SITE.name}の特定商取引法に基づく表示。販売事業者、連絡先、販売価格、支払い方法、引渡し時期、返金の扱いを記載しています。`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: "/legal/" },
  openGraph: {
    ...OG_BASE,
    title: PAGE_TITLE,
    description: PAGE_DESC,
    type: "website",
    url: "/legal/",
  },
};

/** 連絡先は moshi2-config が唯一の定義元。購入メールやエラー文面と必ず一致する。 */
const CONTACT = MOSHI2_CONFIG.contactEmail;

/** 販売中の商品を価格表に出す。products.ts が唯一の定義元なので値がずれない。 */
const PRODUCTS = Object.values(MOSHI2_PRODUCTS).filter(Boolean);

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 sm:flex-row sm:gap-6">
      <dt className="w-full shrink-0 text-ink font-medium sm:w-52">{title}</dt>
      <dd className="flex-1 space-y-1.5 text-ink-soft">{children}</dd>
    </div>
  );
}

export default function LegalPage() {
  return (
    <div className="fade-up">
      <div className="mb-7 border-l-2 border-accent pl-3.5">
        <h1 className="font-serif text-[24px] sm:text-[26px] font-medium text-ink leading-snug tracking-tight">
          特定商取引法に基づく表示
        </h1>
        <p className="mt-2 text-[12px] text-ink-faint tabular">最終更新 2026-09-20</p>
      </div>

      <dl className="max-w-2xl text-[13px] leading-relaxed">
        <Row title="販売事業者">
          <p>{SITE.name}（個人事業主）</p>
        </Row>

        <Row title="運営責任者">
          <p>長谷川 大悟 (はせがわ だいご)</p>
          <p className="text-[12px] text-ink-faint">「熊太郎」は活動名です。</p>
        </Row>

        <Row title="所在地・電話番号">
          <p>請求があれば遅滞なく開示します。{CONTACT} までご連絡ください。</p>
        </Row>

        <Row title="お問い合わせ">
          <p>
            {CONTACT}（
            <Link href="/contact/" className="underline underline-offset-2 hover:text-ink">
              お問い合わせページ
            </Link>
            ）
          </p>
        </Row>

        <Row title="販売価格">
          {PRODUCTS.length > 0 ? (
            <ul className="space-y-0.5">
              {PRODUCTS.map((p) => (
                <li key={p!.certId}>
                  {p!.name}　¥{p!.priceJpy.toLocaleString()}（税込・買い切り）
                </li>
              ))}
            </ul>
          ) : (
            <p>現在、有料商品の販売はありません。</p>
          )}
        </Row>

        <Row title="商品代金以外の料金">
          <p>通信料金、および印刷する場合の用紙代・インク代はお客様のご負担です。</p>
        </Row>

        <Row title="支払い方法・時期">
          <p>クレジットカード（Visa / Mastercard / JCB / American Express）。購入手続きの完了時に即時決済されます。</p>
          <p className="text-[12px] text-ink-faint">
            決済は Stripe, Inc. を通じて行われ、カード情報を当方が保管することはありません。
          </p>
        </Row>

        <Row title="引渡し時期">
          <p>決済完了後すぐにご利用いただけます。発送物はありません。</p>
        </Row>

        <Row title="返品・返金">
          <p className="text-ink">
            商品の性質上、決済後の返金はお受けできません。購入した時点で全問題と解説が閲覧できるためです。
          </p>
          <p>
            そのかわり、同じ形式・問題数の第1回模擬試験を無料で最後まで受けられます。相性はそこでお確かめください。
          </p>
          <p>
            ただし、表示・受験ができない、二重購入、内容に明らかな誤りがある場合は個別に対応します。
            {CONTACT} までご連絡ください。
          </p>
        </Row>

        <Row title="クーリング・オフ">
          <p>通信販売のため適用対象外です。</p>
        </Row>

        <Row title="適格請求書（インボイス）">
          <p>
            免税事業者のため未登録です。領収書が必要な場合は {CONTACT} までご連絡ください（通常の領収書を発行します）。
          </p>
        </Row>

        <Row title="動作環境">
          <p>Chrome / Safari / Firefox / Edge の最新版。Cookie を有効にしてください。</p>
          <p className="text-[12px] text-ink-faint">
            受験権は Cookie で管理しています。購入時と別のブラウザやシークレットウィンドウでは受験できません。
            端末の切り替えは{REDEMPTION_WINDOW_DAYS}日間に{MAX_REDEMPTIONS}回までです。超える場合はご連絡ください。
          </p>
        </Row>
      </dl>

      <p className="mt-8 max-w-2xl text-[12px] text-ink-faint leading-relaxed">
        本サイトの問題はオリジナル問題であり、実際の試験問題の転載ではありません。合否判定は学習の目安です。
        受験料や試験日程は変更されることがあるため、出願前に必ず実施団体の公式情報をご確認ください。
        あわせて
        <Link href="/privacy/" className="underline underline-offset-2 hover:text-ink-soft">
          プライバシーポリシー
        </Link>
        もご確認ください。
      </p>
    </div>
  );
}
