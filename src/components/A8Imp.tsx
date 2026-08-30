/**
 * A8のインプレッション計測ビーコン(提供コード末尾の1px画像)。
 *
 * リンク単体で貼るとクリック・成果は計測される一方、レポートのimp数が0のまま
 * CTR/EPCが読めなくなる。px.a8.net のリンクの隣に必ずこれを併置する。
 * シャード(www11等)は素材ごとに異なるが、本体シカクモンで同一a8matが
 * www11/www14 の両方から計上されている実測があり、集計はa8matで束ねられる。
 * A8以外のhref(Studio・もしも等)には何も描画しない。
 */
export default function A8Imp({ href }: { href?: string }) {
  const m = href?.match(/^https:\/\/px\.a8\.net\/svt\/ejp\?(a8mat=[^&]+)/);
  if (!m) return null;
  return (
    <img
      width={1}
      height={1}
      src={`https://www11.a8.net/0.gif?${m[1]}`}
      alt=""
      style={{ position: "absolute", border: 0 }}
    />
  );
}
