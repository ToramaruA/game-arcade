# game-arcade

使い方と運用は [docs/operations.md](docs/operations.md) を参照。

AI が企画・制作し、人が遊んで承認したブラウザゲームを公開するリポジトリ。

```
ChatGPT が企画・選定 → [GAME] Issue
  → Claude Code が制作・テスト → PR
  → Cloudflare Pages のプレビューURLで人が遊ぶ → Merge（人）
  → 本番公開 → Merge を合図に ChatGPT が次を企画
```

## 構成
| パス | 内容 |
| --- | --- |
| `site/` | 公開ディレクトリ（Cloudflare Pages の出力先） |
| `site/index.html` | トップページ（`site/games/games.json` から一覧を表示） |
| `site/games/<slug>/` | ゲーム1本＝独立した作品ページ（`index.html`, `logic.js`, `game.js`, `style.css`, `og.png`） |
| `templates/game/` | 新しいゲームのひな形 |
| `tests/` | 自動テスト（構成チェック、PC/スマホでの表示確認、各ゲームのロジック） |
| `scripts/` | ひな形作成、共有画像生成、ローカル配信 |
| `docs/` | 運用ガイド（`operations.md`）、好みメモ（`taste.md`）、自動実行に貼るプロンプト |
| `CLAUDE.md` | Claude Code が守るルールと制作手順 |

## ローカルで動かす
```bash
npm ci
npm test
npm run serve   # http://127.0.0.1:8080
```

## Cloudflare Pages の設定
- 本番ブランチ：`main`
- ビルドコマンド：なし（空欄）
- ビルド出力ディレクトリ：`site`
- PR ごとにプレビューURLが自動で作られる。

## main ブランチの保護（GitHub → Settings → Branches）
- Require a pull request before merging（承認数は 0 のまま：自分の PR は自分で承認できないため）
- Require status checks to pass → `test` を必須にする
- 直接 push を禁止する
