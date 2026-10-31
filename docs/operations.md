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

## 修正の進め方
- **Merge 前のゲーム**：修正は、そのゲームの `[GAME]` PR に直接追加される（新しい PR は増えない）。同じプレビュー URL で確認し、最後に1回 Merge する。
- **公開済みのゲーム**：修正ごとに `main` 向けの `[FIX]` PR ができる。1つずつ確認して Merge する。
- **Merge の目安**：遊びの中心（ルール・難易度・見た目）が固まったら Merge する。細かい調整（文言・色・ボタンの大きさなど）は公開後に1件ずつ直す。修正を足し続けると公開がいつまでも遅れる。
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

## 未決のこと
- BGM：オーナーの自作曲を使う案。曲の置き場（例：`site/music/`）と雰囲気メモを作り、企画で曲を選ぶ方式が候補。mp3 推奨。公開リポジトリなので曲ファイルは誰でもダウンロードできる点に注意。
