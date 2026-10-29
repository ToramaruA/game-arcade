# Claude Code 自動実行（STEP 3）の設定

https://claude.ai/code/routines で新しい自動実行を作る。

- リポジトリ：`ToramaruA/game-arcade`
- きっかけ：GitHub の Issue 作成（opened）
- 条件：タイトルが `[GAME]` で始まるもの（設定画面でフィルタできない場合は、下のプロンプト側で判定する）

## プロンプト（そのまま貼る）

```
このリポジトリの CLAUDE.md の「[GAME] Issue を受けたときの手順」に従って、きっかけになった Issue のゲームを1本作り、PR を出してください。

- Issue タイトルが [GAME] で始まらなければ、何もせず終了する。
- 同じ Issue を参照する open な PR が既にあれば、新しく作らず Issue にコメントして終了する。
- main へは push しない。PR の Merge もしない。
- 途中で止まる場合は、理由を Issue にコメントしてから終了する。
```
