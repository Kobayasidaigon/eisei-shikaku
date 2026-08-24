// =============================================================================
// 第2回模試(有料)のサンプル問題。商品ページに2問だけ、解説つきで出す。
//
// 【なぜ出すか】
// 見ず知らずのサイトで、中身を1問も見ないまま買う人はいない。問題の粒度と
// 解説の厚みは文章で説明するより1問見せたほうが早い。売っているのは
// 「問題数」ではなく「解説の質」なので、そこを隠したままでは判断材料がない。
//
// 【何を出すか】
// 出題順の先頭と中盤から1問ずつ。分野が重ならないよう、可能なら別分野を選ぶ。
// 選び方は問題数だけで決まるので、ビルドのたびに変わることはない。
// 表示は API と同じ shapeForDisplay を通すため、購入後に見る紙面と一致する。
// =============================================================================
import { categoryName, type CategoryId } from "@/data/certs";
import { loadMoshi2, shapeForDisplay } from "@/data/moshi2";
import type { CertId } from "@/data/certs";

export default async function Moshi2Sample({ certId }: { certId: CertId }) {
  const paper = await loadMoshi2(certId);
  if (!paper) return null;

  const qs = shapeForDisplay(paper);
  if (qs.length < 4) return null;

  // 先頭の1問と、そこから分野が変わる最初の1問(見つからなければ中盤)
  const first = qs[0];
  const mid = Math.floor(qs.length / 2);
  const second = qs.slice(1).find((q) => q.category !== first.category) ?? qs[mid];
  const picked = [first, second];

  return (
    <section className="print-hide mb-5 max-w-xl">
      <h2 className="font-serif text-[17px] font-medium text-ink mb-1">サンプル問題</h2>
      <p className="text-[13px] text-ink-soft leading-relaxed mb-3">
        実際に出題される{paper.questions.length}問のうち2問を、解説までそのまま出します。
        買う前に、問題の難しさと解説の細かさを見てください。
      </p>

      <div className="space-y-3">
        {picked.map((q, n) => (
          <div key={q.id} className="bg-surface border border-line rounded-[10px] p-4">
            <p className="text-[11px] text-ink-faint tracking-wide mb-2">
              サンプル {n + 1}　{categoryName(q.category as CategoryId)}
            </p>
            <p className="text-[13.5px] text-ink leading-relaxed mb-3 whitespace-pre-line">{q.q}</p>

            <ol className="space-y-1 mb-3">
              {q.choices.map((c, i) => (
                <li
                  key={i}
                  className={
                    "text-[13px] leading-relaxed pl-6 -indent-6 " +
                    (i === q.answer ? "text-correct font-medium" : "text-ink-soft")
                  }
                >
                  <span className="inline-block w-6 indent-0 tabular-nums">
                    {i === q.answer ? "✓" : i + 1 + "."}
                  </span>
                  {c}
                </li>
              ))}
            </ol>

            <p className="border-t border-line pt-3 text-[12.5px] text-ink-soft leading-relaxed">
              <span className="text-ink font-medium mr-2">解説</span>
              {q.explain}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-ink-faint mt-3 leading-relaxed">
        残りの{paper.questions.length - 2}問も同じ密度で解説を付けています。
        無料の第1回とは1問も重複しません。
      </p>
    </section>
  );
}
