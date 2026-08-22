/**
 * 決済後の戻り先(success_url / cancel_url)のオリジンを決める。
 *
 *   本番      : SITE.url に固定
 *   プレビュー: そのプレビュー自身へ戻す
 *   ローカル  : リクエストの Origin (localhost のみ)
 *
 * Origin ヘッダは呼び出し側が自由に名乗れる。本番でこれを信用すると
 * 「決済後に任意のサイトへ飛ばせるリダイレクタ」になってしまうため、
 * 信用するのは localhost と、Vercel 自身が実行環境に入れた値に一致する場合だけ。
 *
 * 【Vercel プレビューを別扱いする理由】
 * Vercel はプレビュー環境でも NODE_ENV を "production" にする。NODE_ENV だけで
 * 判定すると、プレビューからの決済も本番URLへ戻ってしまい、未公開ブランチの
 * 確認が 404 に落ちる(実際にそうなった)。VERCEL_ENV / VERCEL_URL /
 * VERCEL_BRANCH_URL はリクエストからは細工できないので許可リストに使える。
 *
 * ここだけ切り出してあるのは、決済の戻り先という間違えると痛い判定を
 * scripts/test-checkout-origin.mjs で実行して確かめられるようにするため。
 */

export type OriginEnv = {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  NODE_ENV?: string;
};

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function resolveRedirectOrigin(
  origin: string | null | undefined,
  env: OriginEnv,
  fallback: string
): string {
  if (env.VERCEL_ENV === "preview") {
    // branch URL (デプロイをまたいで固定) を先に、無ければデプロイ個別の URL
    const allowed = [env.VERCEL_BRANCH_URL, env.VERCEL_URL]
      .filter((h): h is string => !!h)
      .map((h) => `https://${h}`);
    // 実際に見ている方のホストへ戻す (cookie は発行先ホストにしか付かないため)
    if (origin && allowed.includes(origin)) return origin;
    return allowed[0] ?? fallback;
  }

  if (env.NODE_ENV === "production") return fallback;

  if (origin && LOCALHOST.test(origin)) return origin;
  return fallback;
}
