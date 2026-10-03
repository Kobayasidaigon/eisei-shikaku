/**
 * 結果画面(ドリルの結果・模試の結果)から シカクモン Studio へ送るリンクの行き先と文言。
 * 2026-10-03(Studio の成長計画 2-7)。QuizApp(result)と MoshiExam(moshi_result)で共用する。
 *
 * 【背景】GA4(28日)で衛生の Studio クリックは 6 人 / 629 人。リンクはすべて Studio のトップ `/` 行きで、
 * 文言に資格名も「登録なしで1問解ける」約束も無かった。
 *
 * 【行き先】
 *   - Studio に資格別 LP がある資格 → /lp/<slug>。LP はヒーロー直下に事前生成の1問がある。
 *     LP は ?exam= も ?theme= も読まない(資格は LP 自身が持っている)ので utm だけ付ける
 *   - それ以外 → トップ `/?exam=<資格名>`。トップは ?exam= が事前生成サンプルに当たれば、
 *     その1問を体験セクションに最初から出す(Studio の lib/referral-sample.ts)。
 *     ?theme= は登録リンク経由で作成画面の分野の初期値まで運ばれるので付ける
 *   2026-10-03 時点では第一種・第二種とも LP がある(トップ行きの資格は無い)。
 *
 * 【文言】「登録なしで1問解ける」は、着地先で本当にそうなる資格(STUDIO_SAMPLE_CERTS)だけに出す。
 * 枠のデザイン・位置(講座アフィリより下)は変えない。
 *
 * 注意: QuizApp はクライアントバンドルなので "@/data/questions" を import しないこと。
 */
import { SITE } from "@/data/site";
import type { CertId } from "@/data/certs";

/**
 * Studio に資格別 LP がある資格 → LP のスラッグ(studio.shikakumon.com/lp/<slug>)。
 * Studio 側の LP(計画 2-6)が本番に出てから、このファイルを含む変更を出すこと
 * (先に出すと LP が 404 になる)。LP を足したら・外したらここを直す。
 */
const STUDIO_LP_BY_CERT: Partial<Record<CertId, string>> = {
  eisei1: "eisei1",
  eisei2: "eisei2",
};

/**
 * 着地先で「登録なしで1問解ける」が本当になる資格。
 *   - LP の資格: LP のヒーロー直下に事前生成の1問がある(Studio の app/lp/<slug> が
 *     pregenExamName に資格名を渡し、lib/sample-exam-pregen に第一種・第二種とも 1 問ある)
 *   - トップ行きの資格: cert.name を ?exam= で渡すと、Studio の findReferralSample
 *     (lib/referral-sample.ts + lib/sample-exam-pregen.ts)が事前生成サンプルに当たり、
 *     その1問を最初から出す
 * 2026-10-03 に Studio のコードを取り出して、両資格ともどちらの経路でも当たることを確かめた。
 * Studio は資格名の表記で引くので、資格を足したとき・cert.name を変えたときは同じ確認をしてから
 * ここを直す(当たらない資格は汎用の文言のまま=約束を出さない)。
 */
const STUDIO_SAMPLE_CERTS: ReadonlySet<CertId> = new Set<CertId>(["eisei1", "eisei2"]);

/**
 * 結果画面の Studio リンク。
 *
 * utm_medium は GA4 のチャネル判定キーなので referral 固定。配置は utm_content
 * (既存値のまま: ドリル結果 = result_cta / 模試結果 = moshi_result)。
 *
 * @param weakField いちばんの弱点分野。トップ行きのときだけ ?theme= に載せる
 */
export function studioResultHref(
  certId: CertId,
  certName: string,
  content: string,
  weakField: string | null
): string {
  const params = new URLSearchParams({
    utm_source: "eisei",
    utm_medium: "referral",
    utm_content: content,
  });
  const lp = STUDIO_LP_BY_CERT[certId];
  if (lp) return `${SITE.studioUrl}lp/${lp}?${params.toString()}`;
  params.set("exam", certName);
  // 分野名はそのまま検索語として使われるので長すぎるものは切る
  if (weakField) params.set("theme", weakField.slice(0, 40));
  return `${SITE.studioUrl}?${params.toString()}`;
}

/**
 * 結果画面の Studio 枠の本文とリンクの文言(見出しは画面ごとに持つ)。
 * 約束を出す文言のアップロードの勧め方は、Studio の利用規約第4条(自分が権利を持つか適法に使える
 * 教材に限る)と Studio の LP の書き方(「ご自身のノートや権利のある教材」)にそろえる
 * (教科書をそのまま撮って上げさせる書き方はしない)。汎用の文言は従来の文のまま変えていない。
 */
export function studioResultCopy(certId: CertId, certName: string): { body: string; linkLabel: string } {
  if (STUDIO_SAMPLE_CERTS.has(certId)) {
    return {
      body: `姉妹サービス「シカクモン Studio」では、AIが作った${certName}の問題を登録なしでその場で1問解けます(解説つき)。ご自身のノートや権利のある教材(写真・PDF)から4択問題を作り、間違えた問題を忘却曲線で自動復習することもできます。`,
      linkLabel: `${certName}の問題を登録なしで1問解いてみる`,
    };
  }
  // 着地先にその資格の1問が無い資格は、従来どおりの汎用の文言
  return {
    body: "手元の教科書やノートの写真・PDFから、AIが4択問題と解説を生成。間違えた問題は忘却曲線で自動復習できます。このドリルに無い資格も学べる姉妹サービスです。",
    linkLabel: "シカクモン Studio を無料で試す",
  };
}
