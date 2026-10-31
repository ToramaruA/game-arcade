# 運用ガイド（オーナー向け）

この仕組みの全体像、オーナーがどこで何をするか、つまずいたときの対処をまとめたもの。
新しい Claude の会話で続きを頼むときは「`docs/operations.md` を読んで続きをお願い」と伝える。

## 全体の流れ

```
① 企画        ChatGPT（自動タスク）   好みメモを読んで企画・評価・詳細設計 → [GAME] Issue
      ↓
② 制作        Claude Code（自動実行） Issue を読んでゲームを作り、見た目チェック・テスト → [GAME] PR
      ↓
③ プレビュー   Cloudflare（自動）      PR に確認用 URL が付く
      ↓
④ 確認        オーナー（スマホでOK）   確認用 URL で遊ぶ
      │  直したい → ChatGPT に普通の言葉で伝える
      │             → [FIX] Issue → Claude Code が同じ [GAME] PR に修正を追加（自動）→ ④へ
      ↓  遊びの中心が固まったら
⑤ 承認        オーナー（GitHub）      [GAME] PR を Merge
      ↓
⑥ 公開        Cloudflare（自動）      https://game-arcade-bdt.pages.dev/games/<slug>/
      ↓
⑦ 次の企画     ChatGPT（自動）         [GAME] PR の Merge をきっかけに ① へ（毎日朝6時にも再挑戦）
```

## 言葉
| 言葉 | 意味 | Merge |
| --- | --- | --- |
| Issue | 依頼票。`[GAME]` は新作、`[FIX]` は修正 | できない |
| PR | できあがった変更 | できる。`main` に Merge すると公開サイトに反映 |
| `main` | 公開サイトの元になるブランチ。直接は書き換えられない（保護設定） | — |

## オーナーがやること
| やりたいこと | 場所・方法 |
| --- | --- |
| ゲームを遊ぶ | PR に Cloudflare が付ける Preview URL の末尾に `/games/<slug>/` |
| 修正を頼む | ChatGPT に「〇〇（ゲーム名）の△△を直して」と普通の言葉で。追加の要望も**新しく頼む** |
| 公開する | GitHub の PR →「Merge pull request」 |
| 好みを伝える | `docs/taste.md` の「遊んだ感想の記録」に追記（ChatGPT か Claude に頼む） |
| 動きを確認する | GitHub の Issues／Pull requests、https://claude.ai/code/routines の実行履歴 |
| 費用を確認する | https://claude.ai/settings/usage（追加使用量はオフ） |
| アクセス数を見る | Cloudflare → Workers & Pages → game-arcade → Metrics（Web Analytics） |

## 修正の進め方
- **Merge 前のゲーム**：修正は、そのゲームの `[GAME]` PR に直接追加される（新しい PR は増えない）。同じプレビュー URL で確認し、最後に1回 Merge する。
- **公開済みのゲーム**：修正ごとに `main` 向けの `[FIX]` PR ができる。1つずつ確認して Merge する。
- **Merge の目安**：遊びの中心（ルール・難易度・見た目）が固まったら Merge する。細かい調整（文言・色・ボタンの大きさなど）は公開後に1件ずつ直す。修正を足し続けると公開がいつまでも遅れる。
- 制作・修正のたびに Claude Code は「仕上げチェック」（`CLAUDE.md`）を行う：その機能に当然あるべき要素の確認、変えた画面をすべて実際に開いての目視、別エージェントによるプレイヤー目線のレビュー。
- 修正は1依頼1コミットで残るので、Merge 後でも特定の修正だけ取り消せる（Claude に頼む）。

## 設定の場所（普段は触らない）
| もの | 場所 |
| --- | --- |
| 企画の指示 | ChatGPT の自動タスク（きっかけ：`[GAME]` PR の Merge＋毎日朝6時）。控え：`docs/chatgpt-task.md` |
| 制作・修正の指示 | https://claude.ai/code/routines「game-arcade ゲーム制作」（Issue オープン、作成者 `ToramaruA` で起動）。控え：`docs/claude-routine.md` |
| 制作のルール | `CLAUDE.md` |
| 好みメモ | `docs/taste.md` |
| 公開設定 | Cloudflare Pages（本番ブランチ `main`、ビルドなし、出力 `site`） |
| 勝手に公開されない仕組み | GitHub の `main` 保護（PR 経由・テスト `test` 合格が必須・直接 push 禁止） |

## つまずいたときの対処
| 症状 | 原因 | 対処 |
| --- | --- | --- |
| Issue に追記したのに直らない | 自動実行は「Issue が新しく作られたとき」だけ起動する | 追加の要望は新しい Issue として頼む |
| Claude（会話）が作った Issue で制作が始まらない | Claude 自身が作った Issue では自動実行が起動しない | ChatGPT か GitHub で人が作る |
| Merge したのに次の企画が来ない | ChatGPT の Work 上限など | 毎日朝6時に自動で再挑戦する。急ぐ場合はタイトルが `[GAME]` の小さな PR を Merge するか、ChatGPT の普通の会話で `docs/chatgpt-task.md` の指示を実行させる |
| 修正 PR が積み重なった | 以前の動き（今は `CLAUDE.md` で禁止） | 上から順に Merge するか、Claude に付け替えを頼む |
| Merge しようとしたらエラー | GitHub の一時的な不調、またはテスト未完了 | 少し待って再読み込み。続く場合は Claude に頼む |
| `games.json` で競合 | 2つの PR が同時にゲーム一覧を変えた | Claude に解消を頼む |

## 検索に出すための設定
- サイト側（済）：`site/robots.txt`、`site/sitemap.xml`、トップの静的なゲーム一覧、各ページのタイトル・説明・正式URL・共有画像。新しいゲームを `npm run new-game` で作ると sitemap とトップの一覧も自動更新される（テストで更新漏れを検出）。
- **オーナーの手順（Google Search Console・無料）**
  1. https://search.google.com/search-console を開き、Google アカウントでログイン。
  2. 「プロパティを追加」→ **URL プレフィックス** を選び、`https://game-arcade-bdt.pages.dev/` を入力。
  3. 所有権の確認方法で **HTML ファイル** を選ぶ。`google○○○○.html` という名前のファイルが渡されるので、**ファイル名（と中身の1行）を Claude に伝える**。Claude がサイトに置く PR を出すので、Merge する。
  4. 公開されたら（数分）、Search Console で「確認」を押す。
  5. 左のメニュー「サイトマップ」で `sitemap.xml` と入力して送信。
  6. 数日〜数週間で検索に出始める。「検索パフォーマンス」でどんな言葉で見つけられたか、「ページ」で登録済みかを確認できる。
  - 注意：独自ドメインに移したら、Search Console の登録と `scripts/config.js`・`site/robots.txt` の URL をやり直す。

## 今後やりたいこと
### BGM（オーナーの自作曲）
- 曲の置き場（例：`site/music/`）を作り、曲ごとに雰囲気メモ（例：「静か・不穏・深海向き」）を付ける → 企画で ChatGPT が合う曲を選ぶ → Claude Code が組み込む。
- ブラウザの制限で自動再生はできないので、最初のタップで再生開始＋消音ボタン。
- 決めること：曲数と雰囲気、mp3 で用意できるか、公開リポジトリに置いてよいか（曲ファイルは誰でもダウンロードできる）。
- 曲がそろえば着手できる。

### データで企画を進化させる仕組み
アクセスや遊ばれ方の数字から「どんなゲームが当たるか」を自動でまとめ、次の企画に反映して試し続ける。

- **流れ（案）**：
  1. **測る**：ゲームごとの訪問数・流入元（Cloudflare Web Analytics）。さらに知りたいなら、ゲーム内の「始めた／最後まで遊んだ／もう1回遊んだ／共有した」を数える（外部サービスは使わず、Cloudflare の無料枠の仕組みで自前で記録）。
  2. **まとめる**：週1回、Claude の自動実行が数字を取りに行き、`docs/stats.md`（ゲームごとの成績表）と、`docs/taste.md` に「データから分かったこと」を追記する PR を出す。オーナーが Merge する。
  3. **企画に使う**：ChatGPT の企画は毎回 `docs/taste.md` を読むので、次の企画から自動で反映される。
  4. **試す**：企画ごとに「今回の仮説」（例：共有文を物語にすると共有が増える）を Issue に書き、数字で当たり外れを確かめる。
- **決めること**：
  - Cloudflare の数字を自動で読むための API トークン（読み取り専用）を用意してよいか。
  - ゲーム内の行動まで数えるか（数えると精度が上がるが、各ゲームに記録の仕組みを足す）。
  - 何を「当たり」とするか（訪問数、最後まで遊んだ率、もう1回遊んだ率、共有の数など）。
- **始める目安**：訪問数がある程度たまってから（数十〜数百の訪問がないと差が見えない）。先に検索と共有で人が来る状態を作る。

### 収益化（広告など）
順番は「測る → 人が来たら手段を選ぶ」。
1. **アクセス数を測る（無料）**：✅ 2026-10-31 に Cloudflare Web Analytics を有効化（Cloudflare → Workers & Pages → game-arcade → Metrics）。スクリプトは Cloudflare が自動挿入するのでコードの変更なし。`CLAUDE.md` に例外として記載済み。ページごとの訪問数・流入元・端末をここで見る。
2. **収益の手段**：
   - 広告（Google AdSense など）：審査あり。`pages.dev` のままでは通りにくく、独自ドメイン（年1,000〜2,000円程度）が実質必要。
   - 投げ銭（Ko-fi、Buy Me a Coffee など）：審査なし、リンクを置くだけ。遊びの邪魔になりにくい。
3. **注意**：広告はゲームの見た目・遊び心地を損ないやすいので置き場所（結果画面だけ等）を決める。独自ドメインは「追加料金なし」の方針と合わせて、そのとき判断する。
