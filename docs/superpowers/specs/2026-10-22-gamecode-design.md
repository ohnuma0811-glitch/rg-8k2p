# 対戦の土台と GAME CODE（M4-A）の設計書

- 日付: 2026-10-22
- 全体の設計書: `docs/superpowers/specs/2026-10-13-race-game-design.md`（3 GAME CODE、4 遊べる時間の制限、11.4 データの置き場所）
- M4（対戦）は3つに分ける（2026-10-22 のユーザーの判断）。M4-A（この設計書）: つなぐ土台・GAME CODE・GM 画面・遊べる時間をサーバーにも。M4-B: 待合室とチャット。M4-C: 対戦のレース。
- 全体の設計書の 3章・4章・11.4 のとおりに作る。ちがう所はこの設計書を正とする。

## 1. 目的と前提

- 対戦（VS RACE・BATTLE）に入れる人を、家族と友達に限る。GAME CODE（4けた）を知っている端末だけが、待合室（M4-B）に入れる。
- KYUGO・SOKI の遊べる時間（1日20分）を、端末をまたいで合計する。
- SOLO RACE・TIME TRIAL は、Firebase がなくても、つながらなくても、今と同じに遊べる。
- 費用は0円（Firebase の無料プラン Spark。カードの登録なし）。

## 2. つなぎ方

- Firebase のプログラム（JavaScript SDK）を、Google の配信元（`https://www.gstatic.com/firebasejs/<版>/...`）から、版を決めて読み込む（2026-10-22 のユーザーの判断「A」）。読み込むのは、VS RACE・BATTLE を選んだときと、GM 画面を開いたときだけ（SOLO は軽いまま）。
- Realtime Database（シンガポール `asia-southeast1`）と Authentication（匿名ログイン、Google ログイン）を使う。Firestore は使わない。
- Firebase の設定の値（apiKey・databaseURL など）は `src/config.js` に書く。ウェブで使う値は公開してよい物で、守りはルールでする。空のときは、対戦のボタンを押しても「Not set up yet」と出すだけ（SOLO はそのまま）。

## 3. サーバーのデータと守りの決まり（ルール）

| 場所 | 中身 | 読める・書ける人 |
|---|---|---|
| `/secret` | `code`（4けたの文字）、`codeId`（コードの番号。Set のたびに新しく）、`active`（出ているか） | GM だけ。遊ぶ人は読めない |
| `/status` | `codeId`、`active` | だれでも読める（コードそのものは入れない）。GM が書く |
| `/attempts/{uid}` | `codeId`、`count`（何回目か）、`guess`（入れた4けた）、`device`（端末の種類）、`at`（時刻） | 本人が書く。同じ `codeId` の間は `count` を1ずつしか増やせず、5まで。`codeId` が変わったら1から。GM が読む・消す（Unlock） |
| `/access/{uid}` | `codeId`、`name`、`at` | 本人が書く。書けるのは `/attempts/{uid}` の `guess` が `/secret/code` と同じで、`codeId` が `/secret/codeId` と同じで、`active` のときだけ。`name` はあとから本人が書きかえられる。GM が読む |
| `/playtime/{名前}/{日付}` | 使った秒数 | `/access/{uid}` がある端末（一度でも正しく入れた端末）が書く。増やすだけ。GM は0にできる（Reset）。だれでも読める |
| `/limits/{名前}` | 1日の上限（分） | GM が書く。だれでも読める |

- 数字の確かめ方: 端末は、まず `/attempts/{uid}` に「何回目か」と「入れた数字」を書き、そのあと `/access/{uid}` を書こうとする。書ければ正しい。書けなければまちがい。1回試すたびに必ず1回分数えるので、5回より多く試せない。
- 「入れる人」（M4-B の待合室で使う）: `/access/{uid}/codeId` が `/secret/codeId` と同じで、`/secret/active` が true。
- GM: ルールの中に、KENTA の Google アカウントの番号（uid）を1つ書く。メールアドレスはプログラムにもルールにも書かない。
- 名前は `^[A-Z]{1,12}$`、日付は `YYYY-MM-DD`、コードは `^[0-9]{4}$`。
- ルールは `database.rules.json` としてリポジトリに置き、自動テストで確かめてから、KENTA が Firebase の画面に貼る。

## 4. 遊ぶ人の画面と流れ

- タイトルで VS RACE か BATTLE を選ぶ → まだ入っていない端末は GAME CODE の画面 → 名前を選ぶ（`/access/{uid}/name` に書く。GM の Players に出る）→ 待合室（M4-B）。
- M4-A の間は、待合室のかわりに「The waiting room is coming soon.」を出して、タイトルへ戻る。
- GAME CODE の画面: 大きな数字ボタン（0〜9）、入れた数の丸4つ、消す、OK、BACK。
  - まちがい: 「Wrong code. 3 tries left.」（残りの回数）
  - 5回まちがえた: 「Too many tries. Ask the Game Master.」。そのコードの間は入れられない（GM が Unlock するか、新しいコードが出れば、また5回）。
  - コードが出ていない（Stop）: 「No game code now. Ask the Game Master.」
  - つながらない: 「No connection」
- 一度入った端末は、GM がコードを変えるか止めるまで、GAME CODE の画面を飛ばす（`/status` と `/access/{uid}` の `codeId` をくらべる）。
- 文字は英語。

## 5. GM 画面（`#gm`）

- URL の後ろに `#gm` を付けて開き、「Sign in with Google」でログイン。パソコンはポップアップ、iPhone は Google の画面へ移って戻ってくる方式（redirect）。
- 登録した GM でないときは「Not the Game Master」と、自分の番号（uid）を出す（最初の設定で、この番号をルールに書く）。
- スマホで使えるよう、縦に並べる:
  - Code: 今のコードと「ON / OFF」。数字ボタンで4けたを入れて Set（KENTA が自分で決める。ランダムでは作らない。2026-10-22 のユーザー依頼）。Stop。
  - Players: 今のコードで入った人の名前と時刻（新しい順）。
  - Locked: 今のコードで5回まちがえた端末（端末の種類と時刻）と Unlock。
  - Play time: KYUGO・SOKI の今日の使用時間（分と秒）と Reset。
  - Daily limit: 名前ごとの上限を ＋5・−5 分（5〜120分。最初は20分）。
- チャットを消す操作は M4-B で足す。

## 6. 遊べる時間をサーバーにも

- 今の端末の中の記録（`src/playtime.js`）はそのまま。一度でも正しく入れた端末（`/access/{uid}` がある）だけ、`/playtime/{名前}/{日付}` に足す。足すのは今の記録と同じとき（5秒ごと・レースの終わり）。
- 残り: 上限（`/limits/{名前}`、なければ20分）−（端末の記録とサーバーの記録の多い方）。
- 電波がないときは、足す分を端末にためて、つながったら足す。
- サーバーを読むのは、名前を選んだときとレースの最初だけ（毎フレーム読まない）。
- 一度も正しく入れていない端末は、今と同じく、その端末の中だけで数える。

## 7. ファイル構成

- `src/net/firebase.js`（新しく）: Firebase を読み込んでつなぐ。匿名ログイン・Google ログイン・サーバーの時刻とのずれ。読み書きの小さな道具（`get` `set` `update` `transaction` `onValue`）を返す。
- `src/net/gamecode.js`（新しく）: GAME CODE の流れ（今の状態、試す、残りの回数、入った端末か）。サーバーは引数でもらう（テストではメモリの作り物）。
- `src/net/playtimeSync.js`（新しく）: 遊べる時間をサーバーに足す、ためる、残りを決める。
- `src/gm.js`（新しく）: GM 画面。
- `database.rules.json`（新しく）: ルール。
- `src/screens.js` `style.css`（直す）: GAME CODE の画面、待合室の「coming soon」。
- `src/main.js`（直す）: VS RACE・BATTLE の流れ、`#gm`、遊べる時間のサーバー。
- `src/config.js`（直す）: Firebase の設定、GM の uid は書かない（ルールにだけ書く）。
- `tests/gamecode.test.js` `tests/playtimeSync.test.js`（新しく）、`tests/rules/`（ルールのテスト）。

## 8. 確かめ方

- `node --test`: GAME CODE の流れ（正しい・まちがい・5回・止まっている・コードが変わった・つながらない）、残り時間（端末とサーバーの多い方、上限）、ためて足す。サーバーはメモリの作り物。
- ルールのテスト（Firebase の Emulator）: 遊ぶ人は `/secret` を読めない。まちがったコードでは `/access` に書けない。6回目は `/attempts` に書けない。`count` を飛ばせない・減らせない。GM 以外はコード・上限・Unlock・Reset ができない。時間は増やすだけ。ほかの人の `/attempts` `/access` は書けない。
- そのために、この PC に Java 21（Eclipse Temurin、winget）と、開発用の `firebase-tools`・`@firebase/rules-unit-testing`（npm の devDependencies。公開するゲームには入らない）を入れる（2026-10-22 のユーザーの判断「入れたほうがいいなら入れて良い」）。
- KENTA の準備（Firebase の画面。手順は画面の順に案内する）: プロジェクトを作る、匿名ログインと Google ログインを有効にする、Realtime Database をシンガポールに作る、ウェブアプリを登録して設定の値を教えてもらう、GM 画面に一度ログインして出た番号をルールに書いて貼る。
- 実際の Firebase で: GM がコードを Set → 別の端末で入れる → Players に出る → 5回まちがえて Locked → Unlock → Stop で入れなくなる。KYUGO で SOLO を走って、別の端末で残り時間が減っている。

## 9. 全体の設計書から変わる所

- 3.2: Set code は KENTA が数字ボタンで入れる（変わらない。ランダムでは作らないことをはっきり書く）。
- 11.4: `/status`（コードの番号と出ているかだけ。だれでも読める）を足す。`/attempts` に `guess` を足す（ルールでコードとくらべるため）。
- 7.1 の M4 を、M4-A・M4-B・M4-C に分ける。
