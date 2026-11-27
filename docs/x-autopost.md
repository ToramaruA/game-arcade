# X自動投稿（Buffer）

Game Arcadeの新作がmainに追加されたときだけ、GitHub ActionsがBuffer経由でXに紹介を投稿する。

## 起動条件
- .github/workflows/x-autopost.yml がmainのsite/games/games.json変更時に実行される
- マージ前のゲーム一覧と比較し、新しく追加されたlisted: trueのslugだけを投稿する
- 既存ゲームの修正や、workflowを追加しただけのマージでは投稿しない
- ChatGPTの次作企画タスク、Claude Codeの制作PR、Cloudflare Pagesの公開手順は変更しない

## 投稿までの処理
1. SecretsのBUFFER_API_KEYでBuffer GraphQL APIに接続する
2. Bufferに連携したX（twitter）チャンネルが**ちょうど1つ**で有効であることを確かめる
3. 公開URL https://game-arcade-bdt.pages.dev/games/<slug>/ のHTMLとog.pngが閲覧できるまで確認する（最大およそ4分）
4. Bufferに登録済みの投稿を検索し、同じゲームURLを含む投稿があればスキップする
5. ゲーム名・説明文・URL・既存の共有画像og.pngを使い、createPostのmode: shareNowで送信
6. Bufferが受理したPost IDをActionsログに表示する

**Bufferが投稿を受け付けた時点と、Xで実際に表示された時点は異なる。**
Xへの配信失敗はBufferの投稿履歴で確認すること。Secretsの値そのものをログへ出してはいけない。

## 動作確認（投稿なし）
GitHub → Actions → **Publish new game to X via Buffer** → Run workflow。
入力slugに公開済みゲームのslug（例: wind-garden）を指定して実行する。
手動実行は**必ずプレビューだけ**で、Xへ投稿しない。ログに投稿文・画像URLが表示される。

## 注意・制約
- BufferのAPIキーはSettings → Secrets and variables → Actions → BUFFER_API_KEYに保存する
- 複数のXアカウントをBufferに連携した場合、誤投稿防止のため停止する（将来チャンネルID指定が必要）
- 再実行時はBufferの既存投稿を確認してから送信する。ただしBufferの履歴削除、API側の不整合、投稿後で記録が見えるまでの短時間などでは完全な重複防止を保証できない
- 既存投稿の履歴が多すぎて確認しきれない場合は送信せず失敗する
- Cloudflareが公開できなかったときは投稿しない。失敗した場合はActionsのログを確認する
- 以前から公開しているゲームを後から自動投稿する仕組みではない
- URLが変更されたらscripts/config.jsと公式サイト側のcanonical/OG画像設定を合わせて変更する

## 公式仕様
- https://developers.buffer.com/examples/create-text-post.html
- https://developers.buffer.com/examples/create-image-post.html
- https://developers.buffer.com/guides/pagination.html

## 投稿別の実績を見る（読み取りのみ・手動）
GitHub → Actions → **X post metrics via Buffer (read-only)** → Run workflow。
`scripts/x-metrics-report.mjs` が、Bufferに連携したXチャンネル（ちょうど1つ）の投稿を読み、ログとジョブの Summary に次を出す。

- 送信済み（status: sent）の件数、配信失敗（status に error/fail）の件数、全投稿の status 内訳
- 投稿ごと：投稿ID、作品slug（本文のURLから）、本文の冒頭、送信時刻（`sentAt` がAPIにあるときだけ）、予定時刻（`dueAt`。実際の送信時刻とは区別）、`metricsUpdatedAt`、metrics の type/name/value/unit
- 取得できた指標の種類：表示回数・反応・リンククリック（type/name に link/url と明示されたものだけ）・汎用クリック（リンククリックとは断定しない）

決まりごと：
- GraphQL の `query` だけを送る（送る前に `mutation` を拒否する）。新規投稿・削除・予約・設定変更はしない。定期実行はしない。
- BufferのAPIは実験的なので、Postの項目はスキーマを調べて、ある項目だけを取得する。調べられないときは公式例の項目（status・dueAt・metricsUpdatedAt・metrics）で取得する。
- 取得できない値・未更新の値は 0 にせず「取得不可」「未更新」と表示する。
- 鍵の値・アカウント名は出さない。
- APIで取れないときは、無料の Buffer の Insights（分析）画面で投稿ごとの表示・反応を手で確認する。

参考：https://developers.buffer.com/examples/get-posts-with-metrics.html ／ https://support.buffer.com/en-us/articles/what-is-buffers-api-GtIYIQilz5
