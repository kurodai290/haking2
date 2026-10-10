# BLACKBOX Deep CTF v2 — Railway版

## 重要
この版はGitHub Pagesだけで動かす版ではありません。RailwayにこのZIPの全ファイルを置いて動かしてください。正解のハッシュと進行状況の判定はサーバー側で行います。

## Railwayへデプロイ
1. ZIPを展開します。
2. 中の全ファイルをGitHubリポジトリのルート直下へアップロードします（フォルダーは作りません）。
3. Railwayで **New Project → Deploy from GitHub Repo** を選び、そのリポジトリを接続します。
4. RailwayがNode.jsアプリとしてビルドし、`npm start` で起動します。
5. サービスの **Settings → Networking → Generate Domain** で公開URLを作成します。
6. そのRailway URLを開いてプレイします。GitHub PagesのURLではなく、RailwayのURLを使ってください。

## 重要な注意
- `SESSION_SECRET` をRailwayのVariablesに設定することをおすすめします。長いランダム文字列を使用してください。
- 初版は簡単に試せるようにセッションをメモリ上で管理しています。再デプロイやサーバー再起動で進行状況がリセットされる場合があります。
- Railway上のサーバーが停止・再起動するとメモリセッションが消える場合があります。進行状況の長期保存にはデータベースが必要です。
- この仕組みはURL直打ちによるステージ飛ばしや、ブラウザー内の判定コードを書き換える方法への対策です。ただし問題文や手がかり自体はブラウザーに配信されるため、AIによる分析を完全に防ぐものではありません。
