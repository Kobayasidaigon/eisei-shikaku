# 第2回模試(有料)— セットアップと運用

第1回模試は無料のまま変えない。有料にするのは「第2回」= 第1回とは別問題で、
本試験と同じ問題数・時間・合格基準で受けられる回。買い切り・登録不要。

---

## 1. 仕組み(ログインもDBも持たない)

このサイトには会員機能もデータベースもない。購入の事実は **Stripe の決済セッションを
唯一の真実**とし、決済確認が取れた時点で HMAC 署名つき cookie を発行して、以降は
その署名だけで受験権を判定する。

```
購入ボタン
  → POST /api/checkout        Stripe Checkout セッションを作成
  → Stripe の決済ページ
  → /[certId]/moshi2/?s=cs_xxx に戻る
  → POST /api/unlock          session_id を Stripe に照会し「支払い済み」を確認
                              → 署名 cookie kt_m2_<certId> を発行(400日)
  → GET /api/moshi2/[certId]  cookie を検証してペーパーを配信

同時に、Stripe から webhook が飛ぶ (ブラウザの挙動とは無関係):

  checkout.session.completed
  → POST /api/stripe-webhook/  署名を検証し、購入者に受験用リンクをメール送信
  → メールのリンク (?k=署名トークン)
  → POST /api/restore          署名を検証して cookie を配り直す
```

URL の `?s=` は決済セッションIDで、**それ単体では何の権限も持たない**。サーバーが
Stripe に照会して初めて受験権になる。cookie は `ACCESS_SECRET` で署名するので偽造できない。

### なぜ webhook が要るか

`/api/unlock` は**ブラウザが決済から戻ってきたときにしか動かない**。決済直後に
タブを閉じた、リダイレクトに失敗した、という場合は cookie が付かず、
「払ったのに受験できない」状態になる。webhook は Stripe がサーバーへ直接叩きに
来るので、ブラウザの挙動に関係なく必ず発火する。ここが最後の砦。

メールに載せるリンクには受験権そのもの(cookie に入るのと同じ署名トークン)が
入っている。端末を変えても、cookie を消しても、このリンクを開けば復旧できる。
Stripe への問い合わせは不要で、署名が本物であること自体が決済済みの証拠になる。

購入者のメールアドレスは Stripe Checkout が自動で集めるため、入力欄の追加は不要
(`session.customer_details.email`)。

有料の問題データ(`src/data/moshi2/*.ts`)は **サーバー専用**。クライアント
コンポーネントから import してはいけない。import した瞬間、購入せずに読めてしまう。

## 2. ローカルで開く

```bash
git fetch origin claude/qr-code-puzzle-site-15yoh1
git checkout claude/qr-code-puzzle-site-15yoh1
npm install                      # stripe が増えているので必要
cp .env.local.example .env.local # DEV_UNLOCK_MOSHI2=true が入っている
npm run dev                      # http://localhost:3530
```

- 商品ページ: http://localhost:3530/eisei1/moshi2/
- 印刷用: http://localhost:3530/eisei1/moshi2/print/

`DEV_UNLOCK_MOSHI2=true` があると、**決済を通さずに**有料の紙面を開けます。
解除中は画面に赤い帯が出ます。

この解除は `NODE_ENV === "development"` と環境変数の**二重ガード**で、
`next build` した本番では絶対に有効になりません
(`src/lib/access.ts` の `isDevUnlockEnabled`)。
`.env.local` に `DEV_UNLOCK_MOSHI2=true` を残したまま `next start` しても
API は 402 を返すことを確認済みです。

実際の決済フロー(Stripeテスト決済 → 受験権の付与 → cookie発行)まで試す場合は、
`.env.local` に `STRIPE_SECRET_KEY=sk_test_…` と `ACCESS_SECRET` を足し、
`DEV_UNLOCK_MOSHI2` を消してください。テストカードは 4242 4242 4242 4242 です。

## 3. 必要な環境変数(Vercel)

| 変数 | 用途 | 未設定だと |
|---|---|---|
| `STRIPE_SECRET_KEY` | 決済セッションの作成と照会 | 購入ボタンが「準備中」を返す |
| `ACCESS_SECRET` | 受験権 cookie の署名鍵。**32文字以上** | 決済しても受験できない |
| `STRIPE_WEBHOOK_SECRET` | webhook の署名検証 (`whsec_…`) | webhook が何もしない(メールが飛ばない) |
| `RESEND_API_KEY` | 受験用リンクのメール送信 | メールを送らない(決済と受験は動く) |
| `MAIL_FROM` | 差出人(任意) | `衛生管理者ドリル <noreply@shikakumon.com>` |

Stripe ダッシュボードで webhook エンドポイントを登録する:

- URL: `https://eisei.shikakumon.com/api/stripe-webhook/` ← **末尾スラッシュ必須**
- イベント: `checkout.session.completed` のみ

末尾スラッシュを忘れると `trailingSlash: true` により 308 リダイレクトが返る。
**Stripe は webhook でリダイレクトを追わない**ので、3xx はそのまま配信失敗になり、
メールが一通も飛ばない。Stripe の画面には `308 ERR` と
`{"redirect":"/api/stripe-webhook/","status":"308"}` が記録される
(実際にこれで詰まった)。

直すのは Stripe 側の URL だけでよく、再デプロイは要らない。エンドポイントの URL を
編集して「再送する」を押せば、失敗していたイベントがそのまま処理される。
Stripe は自動でも再送するため、決済済みの購入が失われることはない。

> `skipTrailingSlashRedirect` でリダイレクト自体を止める手もあるが、これはサイト全体の
> 挙動を変え、URL 正規化を proxy で自前実装することになる。webhook 1本のために
> 全ページへミドルウェアを通すのは割に合わないので採用していない。

### シカクモン Studio と Stripe アカウントを共有している

課金しているのは Studio(サブスク)と、このサイト(模試の買い切り)の2つだが、
Stripe アカウントは1つ。ここで2点間違えやすい。

- `STRIPE_SECRET_KEY` は **アカウント共通**。Studio の Vercel に入っているものと同じ値でよい。
- `STRIPE_WEBHOOK_SECRET` は **エンドポイントごとに違う**。Studio の `whsec_…` を
  流用すると署名検証に必ず失敗する。このサイト用のエンドポイントを新規に登録して、
  その画面に出る `whsec_…` を使うこと。

両方のエンドポイントが `checkout.session.completed` を受け取るが、互いに無視する:

| 発生元 | Studio の webhook | このサイトの webhook |
|---|---|---|
| Studio のサブスク購入 | 通常どおり処理 | `metadata.kind !== "moshi2"` で無視 |
| このサイトの模試購入 | `metadata.userId` が無く `break` → 200 | 受験用リンクをメール送信 |

Studio 側は 200 を返して `success: true` でマークするため、Stripe の再送も
アラートも起きない(`app/api/webhooks/stripe/route.ts` で確認済み)。ログが1行出て
`stripe_events` に1行残るだけで、これは cron の掃除対象。

なお API バージョンは Studio が `2026-03-25.dahlia`、こちらが `2026-07-29.dahlia`
と異なる。webhook エンドポイントごとにバージョンを持てるので問題はない。
こちらが読むのは `payment_status` / `metadata` / `customer_details.email` / `id` だけで、
いずれもバージョン間で変わっていない。

### カード明細に出る名前

決済がカード明細にどう出るかは Stripe アカウント側の設定で決まる(コードでは
指定していない)。アカウント名が「シカクモン」のままだと、衛生管理者ドリルで
買った人の明細に別名が出て、身に覚えがない請求として問い合わせや
チャージバックにつながることがある。Stripe ダッシュボードの
「設定 → 事業設定 → 明細書表記」を一度確認しておく。

ローカルで試す場合は Stripe CLI:

```bash
stripe listen --forward-to localhost:3530/api/stripe-webhook/
```

Resend のドメイン認証 (shikakumon.com) はシカクモン Studio 側で完了済みのため、
APIキーを入れるだけで送れる。追加のDNS設定は不要。

診断:

```bash
npm run stripe:check
```

アプリと同じ設定で Checkout セッションを1件作り、請求額が `products.ts` の
`priceJpy` と一致するか、通貨・戻り先URL・metadata が正しいかを確かめて、
確認後にセッションを失効させる。JPY はゼロ十進通貨で `unit_amount` がそのまま
円になるため、ここが桁ずれる事故を先に潰すのが主目的。

`ACCESS_SECRET` の生成:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> **注意**: `ACCESS_SECRET` を変えると、既存の購入者が全員締め出される
> (発行済み cookie が検証できなくなる)。運用開始後は変更しないこと。

未設定でもビルドと表示は通る。`STRIPE_SECRET_KEY` が無いときは購入ボタンが
「決済は現在準備中です。」を返すだけなので、鍵を入れる前に公開しても事故らない。

Stripe 側の商品登録は不要。価格は `src/data/products.ts` の `priceJpy` を
Checkout の `price_data` に渡している。値段の変更はこのファイル1箇所で済む。

### 本番に出す前に Vercel のプレビューで通す

本番キー(`sk_live_`)をいきなり入れると、動作確認のたびに実物のカードへ請求が走る。
逆にテストキーのまま本番へ出すと、第1回を終えた訪問者が購入ボタンを押しても
実物のカードが必ず弾かれる。両方避けるには、環境変数を環境ごとに分ける:

| | Production | Preview |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` | `sk_test_…` |

Vercel の環境変数は**そのデプロイが作られた時点の値**が関数に入る。あとから足しても
既存のデプロイには反映されないので、変数を入れたら必ず Redeploy すること。

**戻り先について**: Vercel はプレビュー環境でも `NODE_ENV` を `"production"` にする。
そのため `NODE_ENV` だけで本番判定をすると、プレビューからの決済が本番URLへ戻り、
未公開ブランチだと 404 に落ちる(実際に起きた)。`src/lib/checkout-origin.ts` で
`VERCEL_ENV` を見て分岐しており、判定は `npm run build` のたびに
`scripts/test-checkout-origin.mjs` が検証する。

### 引き換え回数の上限(流用の抑止)

**30日で5回**まで。台帳は Stripe の PaymentIntent の metadata
(`redeemed` と、期間の起点 `redeemedFrom`)。データベースを持たないので、
決済そのものに書き込んでいる。

数える経路は2つあり、**両方を同じ台帳に載せる**必要がある。片方でも素通りすると
上限が意味をなさない(当初 `/api/restore` が数えておらず、メールのリンクが
無制限の受験権になっていた):

| 経路 | いつ | 数えるか |
|---|---|---|
| `/api/unlock` | 決済から戻ったとき | ○ |
| `/api/restore` | 購入メールのリンクを開いたとき | ○ |

**なぜ「生涯N回」ではなく「期間内にN回」か。**
生涯N回だと、cookie を消しがちな人(プライベートモード、終了時に削除する設定、
掃除アプリ)が恒久的に締め出され、問い合わせるしか手がなくなる。期間で戻る形なら、
大量に配ろうとする人はその場で止まり、正常な購入者は待てば回復する。
拒否の文面で「◯月◯日以降にまたご利用いただけます」と言えるのが大きい。

**同じ端末での開き直しは消費しない。** すでに有効な cookie を持っていれば
台帳に触れず期限を延ばすだけにしている(各ルートの `alreadyUnlocked`)。
これが無いと、リンクを2回踏んだだけで2回分減る。

**Stripe に届かないときは通す。** 台帳が引けないことを理由に、支払った人を
締め出すほうが損失が大きい。上限は流用の抑止が目的であって、
正規の購入者の受験を妨げてまで守るものではない。

判定は `src/lib/redemptions.ts` にまとまっており、`npm run build` のたびに
`scripts/test-redemptions.mjs` が18ケース(期間の境界を含む)を検証する。

> **限界**: 印刷用ページは PDF に保存できる。保存された PDF には受験権もリンクも
> 要らないため、ファイルが1つ出回れば回数の上限は迂回される。紙面に購入者の
> 情報を刷る(透かし)以外に手当てはないが、現時点では入れていない。

## 4. 問題データの作り方

第2回の問題は、第1回および無料で公開中の全問題と **1問も重複してはいけない**。
無料で解ける問題を売るのが、この商品で唯一やってはいけない事故。

```bash
# 1. 生成 → 検品(Workflow)。既存の設問文を重複回避リストとして渡す
#    出力を JSON で保存する

# 2. データファイルを書き出す
node scripts/build-moshi2.mjs <input.json> eisei1

# 3. 監査(prebuild でも自動実行される)
node scripts/audit-moshi2.mjs
```

`build-moshi2.mjs` がやること:

1. 分野ごとに必要数を切り出し、`products.ts` の `questionCount` ちょうどにする
   (足りなければ **書き出さずに中断**する。中途半端なペーパーを売らないため)
2. 分野が固まらないよう等間隔に混ぜて出題順を作る
3. **正解位置を均等かつ不規則に散らす**。単純に `i % 4` で均すと分布は均等でも
   「4問ごとに同じ位置が正解」という周期ができ、内容を知らずに当てられてしまう
   (実際にそうなり、解答一覧を刷って初めて縞模様として見えた)。シード付き擬似乱数で
   均等シャッフルする。受験者が実際に見るのは3択での位置なので、そちらを直接
   割り当てて4択の `answer` と `drop` を逆算している
4. 3肢択一表示用の `drop3`(間引く誤答の index)も一緒に書き出す

`audit-moshi2.mjs` が落とす条件:

- 無料で公開済みの問題との設問重複(**1件でもアウト**)
- 第2回の内部での設問重複
- 解説が選択肢の位置に言及している(出題時にシャッフルされるため破綻する)
- 正解肢が他より20字以上長い問題が2%超(長さで正解が当てられる)
- 正解位置の偏りが45%超
- **正解位置に周期パターンがある**(周期2〜6で、ある位置クラスの70%超が同じ正解位置)
- 形式不正(選択肢が4つでない等)

問題数が仕様と合わない場合は `loadMoshi2()` が `null` を返し、購入画面ではなく
「準備中」が表示される。**データが揃うまで売れない**ようになっている。

## 5. 販売する資格を増やす

1. `src/data/products.ts` の `MOSHI2_PRODUCTS` に資格を追加(価格・問題数・時間・合格基準)
2. `src/data/moshi2.ts` の `SOURCES` にローダーを追加
3. `scripts/audit-moshi2.mjs` の `TARGETS` に、その資格の無料プールのファイルを追加
4. 問題を生成して `build-moshi2.mjs` で書き出す

商品ページ `/[certId]/moshi2/` と sitemap への収録は自動。第1回の結果画面に出る
購入導線(`Moshi2Offer`)も、商品が定義された資格で自動的に有効になる。
未定義の資格では従来どおり意向調査(`MoshiRound2Interest`)が出る。

## 6. 静的書き出しをやめた件

購入者判定には署名の検証が要り、それにはサーバー実行が要るため
`next.config.ts` の `output: "export"` を外した。

既存ページへの影響はない。`next build` の出力で確認済み:

- 全1,189ページが従来どおり静的生成(`○ Static` / `● SSG`)
- 動的(`ƒ`)なのは追加した3つの API のみ

## 7. 計測(GA4)

| イベント | 意味 |
|---|---|
| `moshi2_offer_impression` | 購入導線カードが見えた(`place` で設置場所を区別) |
| `moshi2_offer_click` | 購入導線カードのクリック |
| `moshi2_checkout_start` | 「購入して受験する」を押して決済ページへ |
| `moshi2_purchase_complete` | 決済が確認され受験権が発行された |
| `moshi2_restore` | メールの受験用リンクから受験権を復旧した |
| `moshi2_print` | 印刷用ページから印刷した(範囲・段組も記録) |

`moshi_complete`(第1回の採点完了) → `moshi2_offer_impression` → `moshi2_offer_click`
→ `moshi2_checkout_start` → `moshi2_purchase_complete` が購入ファネル。
どこで落ちているかを見て、価格・文面・設置場所を調整する。
