/**
 * 特定商取引法に基づく表示に出す運営責任者の名前を、期間で切り替える。
 *
 * 2026-10-31 運営者の依頼で、1か月だけ本名「長谷川 大悟」を出さず、活動名「熊太郎」で表示する。
 * KUMATARO_UNTIL を過ぎると自動で本名の表示に戻る。表示するページ (/legal/) は
 * revalidate で1時間ごとに作り直すので、戻すための再デプロイは要らない。
 * 戻ったあとは、このファイルと呼び出し側の分岐・revalidate を消してよい。
 * 本体 (shikakumon-studio) と系列ドリルにも同じ期限のファイルがある。
 */

/** この時刻より前は「熊太郎」を表示する (日本時間 2026-12-01 0:00) */
export const KUMATARO_UNTIL = "2026-12-01T00:00:00+09:00";

/** 今が「熊太郎」で表示する期間か */
export function showsKumataro(now: Date = new Date()): boolean {
  return now.getTime() < Date.parse(KUMATARO_UNTIL);
}
