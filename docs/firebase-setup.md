# Firebase の準備（対戦と GM 画面）

VS RACE・BATTLE の GAME CODE と、GM 画面（`#gm`）を使うための準備です。費用は0円です（無料プラン Spark。カードの登録はしません）。上から順に進めてください。画面の文字は、日本語の表示のときのものです。

## 1. プロジェクトを作る

1. https://console.firebase.google.com を開き、ふだん使っている Google アカウントでログインします。
2. 「プロジェクトを作成」を押します。
3. プロジェクトの名前を入れます（例: `kyugo-soki-kart`）。
4. 「Google アナリティクス」は**オフ**にして、「プロジェクトを作成」を押します。

## 2. ログインのしかたを2つ有効にする

1. 左のメニューの「構築」→「Authentication」→「始める」を押します。
2. 「ログイン方法」のタブで、次の2つを有効にします。
   - 「匿名」: 押して「有効にする」をオンにし、「保存」。
   - 「Google」: 押して「有効にする」をオンにし、「プロジェクトのサポートメール」を選んで「保存」。
3. 「設定」のタブ →「承認済みドメイン」→「ドメインを追加」で、`ohnuma0811-glitch.github.io` を足します（公開しているゲームのアドレス）。

## 3. データの置き場所（Realtime Database）を作る

1. 左のメニューの「構築」→「Realtime Database」→「データベースを作成」を押します。
2. 場所は「**シンガポール（asia-southeast1）**」を選びます（日本とマレーシアの間）。
3. 「**ロックモードで開始**」を選んで「有効にする」を押します。

## 4. ウェブアプリを登録して、設定の値を教えてください

1. 左上の歯車 →「プロジェクトの設定」→ 下の「マイアプリ」で `</>`（ウェブ）を押します。
2. アプリの名前（例: `kart`）を入れて「アプリを登録」を押します（「Firebase Hosting」はチェックしません）。
3. `const firebaseConfig = { ... }` が出ます。この中の5つの値を、Claude に教えてください。
   - `apiKey`、`authDomain`、`databaseURL`、`projectId`、`appId`
   - `databaseURL` が出ていないときは、Realtime Database の画面のいちばん上に出ているアドレス（`https://〜.asia-southeast1.firebasedatabase.app`）を教えてください。
   - これらの値は、ウェブのゲームに書いて公開してよい値です（守りは5のルールでします）。パスワードではありません。
4. Claude が `src/config.js` に書き入れて、公開します。

## 5. GM の登録とルール（Claude が公開したあと）

1. ゲームのアドレスの後ろに `#gm` を付けて開きます（`https://ohnuma0811-glitch.github.io/rg-8k2p/#gm`）。iPhone では、ホーム画面のアイコンではなく、Safari のブックマークから開いてください。
2. 「Sign in with Google」でログインします。
3. 「Not the Game Master」と、その下に英数字の長い番号（Your user ID）が出ます。この番号を、Claude に教えてください（番号はメールアドレスではありません）。
4. Claude が、リポジトリの `database.rules.json` の `GM_UID_HERE` をその番号に入れかえたものを用意します。
5. Firebase の画面で「Realtime Database」→「ルール」のタブを開き、中を全部消して、Claude が用意したルールを貼り、「公開」を押します。
6. GM 画面を開き直すと、Code・Players・Locked・Play time・Daily limit が出ます。

## 6. 使いかた（GM 画面）

- Code: 数字ボタンで4けたを入れて「Set」。そのコードが GAME CODE になります（期限なし。変えるか Stop するまで使えます）。「Stop」ですぐに使えなくなります。
- Players: 今のコードで入った人の名前と時刻。知らない名前があったら、Stop して新しいコードを出してください。
- Locked: 5回まちがえて入れなくなった端末。「Unlock」でまた5回入れられます。
- Play time: KYUGO・SOKI の今日の使用時間。「Reset」で0に戻します。
- Daily limit: 1日の上限（−5・＋5分）。
