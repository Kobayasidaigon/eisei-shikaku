import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* output: "export" は使えない。
     第2回模試(有料)は購入者判定・Stripe webhook・受験権の発行をサーバー側で
     行うため API ルートが要る。静的書き出しでは API ルートを持てない。
     ページ自体は引き続き静的にプリレンダリングされるので、表示は変わらない。 */
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
