// 構造化データ(JSON-LD)を <script type="application/ld+json"> として出力する共通コンポーネント。
// "</script>" 相当の文字列が生成データに混入しても script が早期終了しないよう
// "<" をエスケープする(JSON としては等価)。
export default function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
