# Unicode 手書き検索

手書きで描いた形から、似たUnicode文字を探す静的サイトです。サーバー・ビルド不要。

## 画面構成
ページ全体はスクロールしません。横長の画面では「左: 手書き / 右上: 候補 / 右下: 選択した文字の情報」、縦長の画面では上から「手書き / 候補 / 情報」の順に並びます。候補は表示できる数だけ表示されます。フォントや検索対象は右上の「設定」(ポップアップ)で変更します。

## 仕組み
- 端末のフォントで各文字を描画し、縮小画像＋線の向きの特徴ベクトルを作成（ブラウザ内で実行）
- 手書きを同じ形式に変換し、コサイン類似度で近い順に表示
- フォントに無い文字（豆腐）は自動的に除外

## ローカルで確認
    python3 -m http.server 8000   # → http://localhost:8000

## GitHub Pages に公開する手順
1. GitHubで新規リポジトリを作成（Public、名前は例: `unicode-handwriting-search`）
2. リポジトリ画面の「uploading an existing file」から、このフォルダの**中身**（index.html, style.css, app.js, blocks.js, names.js）をドラッグ＆ドロップ
   ※ zipのままではなく、展開したファイルをアップロードすること。index.html がリポジトリ直下に必要
3. 「Commit changes」を押す
4. Settings → Pages → Build and deployment の Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして Save
5. 1〜2分後、`https://ユーザー名.github.io/リポジトリ名/` で公開される

## データの再生成(文字名・ブロック表)
`names.js`(全文字名)と `blocks.js`(全ブロック)は `build_data.py` で生成済みです。
Unicodeの新版に更新するには:

    pip install fonttools unicodedata2
    python3 build_data.py

文字名は初回に文字を選んだとき、または名前検索したときに読み込まれます(約1.4MB、gzip配信で約300KB)。

## カスタマイズ
`app.js` の `DEF`(初期で検索対象にするブロック)や `JA`(日本語表示名)を編集できます。
