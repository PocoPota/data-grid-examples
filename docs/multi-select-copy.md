# セル複数選択 + コピー（Excel貼り付け対応）

## 概要

テーブル上のセルを複数選択し、Ctrl/Cmd+C でクリップボードにTSV形式でコピーする機能。
コピーした内容はExcel・Google Sheets・Numbersにそのまま貼り付け可能。

## 操作方法

| 操作 | 動作 |
|------|------|
| クリック | 単一セル選択 |
| Shift+クリック | アンカーから矩形範囲選択 |
| Ctrl/Cmd+クリック | セルの追加/解除（トグル） |
| ドラッグ | アンカーからの矩形範囲選択 |
| Ctrl/Cmd+ドラッグ | 既存選択を維持しつつ矩形範囲を追加 |
| Ctrl/Cmd+C | 選択セルをTSV形式でクリップボードにコピー |
| Escape | 選択解除 |
| テーブル外クリック | 選択解除 |
| ダブルクリック（編集開始） | 選択解除 → 編集モードへ |
| ソート/フィルタ/カラム表示変更 | 選択解除 |

## アーキテクチャ

### ファイル構成

```
src/
├── hooks/
│   ├── useSelection.ts        # 選択状態管理
│   └── useCopyToClipboard.ts  # クリップボードコピー
├── App.tsx                     # フック統合・イベントバインド
├── EditableCell.tsx            # 編集開始時の選択解除
└── table-overrides.css         # 選択ハイライトCSS
```

### `useSelection.ts`

選択状態を管理するカスタムフック。引数なし。

- **状態モデル**: `Set<"row:col">` — 行・列ともに視覚インデックス（画面上の位置）を数値で保持
- **アンカーセル**: Shift+Click / ドラッグの起点座標を `useRef` で保持
- **矩形範囲計算**: アンカーとカーソル位置から、行・列それぞれの min/max を求めて二重ループで全セルIDを生成。

**公開API:**

| 関数/値 | 説明 |
|---------|------|
| `selected` | 選択中のセルID `Set` |
| `isDragging` | ドラッグ選択中フラグ |
| `isSelected(row, col)` | セルが選択中か判定 |
| `clearSelection()` | 全選択解除 |
| `handleCellMouseDown(row, col, event)` | セルの `mousedown` ハンドラ |
| `handleCellMouseEnter(row, col)` | セルの `mouseenter` ハンドラ（ドラッグ中のみ動作） |
| `handleMouseUp()` | ドラッグ終了ハンドラ（`document` レベルで登録） |

### `useCopyToClipboard.ts`

グローバル `keydown` リスナーでCtrl/Cmd+Cを検知し、選択セルをTSV形式でコピー。

- 選択セルがない場合は何もしない
- 編集中input内でテキストが選択されている場合はブラウザのネイティブコピーに委譲
- 選択セットから視覚行・列インデックスを取り出し、`table.getVisibleLeafColumns()[col].id` で実際のカラムIDに変換して値を取得
- `navigator.clipboard.writeText()` で書き込み

### App.tsx での統合

- `Table.Root` に `ref` を設定（テーブル外クリック判定用）
- `Table.Cell` に `onMouseDown` / `onMouseEnter` + `cell-selected` クラスを付与。ハンドラには `.map()` のループインデックスで行・列の視覚位置を渡す
- `document` レベルで `mouseup`（ドラッグ終了）、`keydown`（Escape）、`mousedown`（テーブル外クリック）を登録
- `sorting` / `globalFilter` / `columnVisibility` の変更を `useEffect` で監視し、変更時に `clearSelection()` を呼び出し
- ドラッグ中はテーブルに `selecting` クラスを付与（`user-select: none`）
- `table.options.meta` に `clearSelection` を追加

### EditableCell.tsx の変更

- `TableMeta` 型に `clearSelection?: () => void` を追加
- ダブルクリック・文字入力による編集開始時に `clearSelection()` を呼び出し

### CSS（table-overrides.css）

```css
.cell-selected {
  background-color: var(--accent-a3);
  box-shadow: inset 0 0 0 1px var(--accent-7);
}

.selecting {
  user-select: none;
}
```

## TSV形式について

タブ文字（`\t`）で列区切り、改行（`\n`）で行区切りのプレーンテキスト。
Excel・Google Sheets・Numbersはすべてこの形式のペーストに対応しているため、特別なフォーマット変換なしに貼り付け可能。

## 設計思想

### なぜ `Set<"row:col">` なのか

セルの選択状態を表現するデータ構造として、2次元配列（`boolean[][]`）や `Map<number, Set<number>>` など複数の選択肢がある。本実装では `Set<string>` を採用した。

```
Set { "0:0", "0:1", "1:0", "1:1" }
```

**理由:**

1. **非連続選択への自然な対応** — Ctrl+クリックで飛び飛びのセルを選択する場合、矩形や範囲では表現できない。Setなら任意のセルの組み合わせをそのまま保持できる。
2. **O(1) の判定** — `isSelected()` は `Set.has()` を呼ぶだけ。テーブルの各セルが毎レンダーで呼ぶため、高速な判定が重要。
3. **イミュータブルな更新が簡単** — `new Set([...prev, ...newCells])` でマージ、`new Set(prev); next.delete(id)` でトグル。Reactの状態更新と相性が良い。

文字列キーの形式は `"row:col"`（例: `"2:3"`）。行・列ともに視覚インデックス（数値）で、`:` をデリミタにすることでパース不要なルックアップと、必要時の分解を両立している。

### なぜ視覚インデックスなのか

行・列ともに画面上の位置（`.map()` の第2引数）を使う。これにより:

- **矩形範囲計算が単純な数値の min/max になる** — カラムIDの `indexOf` 検索が不要
- **`useSelection` がテーブルの構造を知る必要がない** — 引数なしのフックになり、`visibleColumnIds` 等の外部情報への依存がゼロ
- **ソート/フィルタ/カラム表示変更後も正しく動作する** — 視覚インデックスは常に 0, 1, 2, ... と連続

視覚インデックスは表示状態が変わると行・列との対応がずれるため、ソート/フィルタ/カラム表示が変更されると選択を自動クリアして整合性を保つ。

コピー時のみ、視覚列インデックスから実データへの変換が必要になる。`table.getVisibleLeafColumns()[col].id` でカラムIDを取得し、`row.getValue(columnId)` で値を得る。

### アンカー + 矩形範囲モデル

Excelと同じ「アンカーセル」の概念を採用。

```
アンカー (0, 1)    →   ユーザーが最初にクリックしたセル
カーソル (2, 3)    →   Shift+クリック or ドラッグ先のセル
                       ↓
         矩形範囲: row 0~2, col 1~3 の全セル
```

矩形範囲の計算は `getRectCells()` が担当する。2つの座標から行・列それぞれの min/max を求め、二重ループで矩形内の全セルIDを生成する。行列ともに数値なので、純粋な数値比較のみで完結する。

### イベント処理の階層設計

```
<Table.Cell onMouseDown onMouseEnter>     ← 選択イベント（App.tsx で付与）
  └─ <input onMouseDown onDoubleClick>    ← 編集イベント（EditableCell 内部）
```

**重要な判断: イベントハンドラを `Table.Cell`（親）に付ける。**

セルの中身は EditableCell / NameCell / SelectCell と異なるコンポーネントだが、いずれも `stopPropagation()` を呼んでいない。そのためDOMイベントバブリングにより、子要素でのクリックは親の `Table.Cell` まで到達する。

この設計により:
- 各セルコンポーネントを一切変更せずに選択機能を追加できる
- 選択ロジックが App.tsx の1箇所に集約される
- 新しいセルタイプを追加しても選択は自動的に動作する

### ドラッグ選択の仕組み

ドラッグ選択は3つのイベントの協調で実現する。通常クリック・Ctrl/Cmd+クリックのいずれも `isDragging = true` を設定するため、どちらからでもドラッグ選択が開始される。

```
mousedown（セル上）  →  isDragging = true, アンカーを記録
       ↓                 通常: baseSelectionRef = 空Set
       ↓                 Ctrl:  baseSelectionRef = 現在の選択（トグル後）
mouseenter（別セル） →  isDragging中ならアンカー〜現在セルの矩形を計算
       ↓                 選択 = baseSelectionRef ∪ 矩形範囲
mouseup（document）  →  isDragging = false
```

`mouseup` を `document` レベルで登録しているのは、テーブル外でマウスを離した場合も確実にドラッグを終了するため。セルレベルで `mouseup` を付けると、セルの外にドラッグした際に終了イベントを取りこぼす。

ドラッグ中はテーブルに `.selecting` クラスを付けて `user-select: none` を適用する。これがないと、ドラッグ操作中にブラウザのネイティブテキスト選択が発生してしまう。

### `baseSelectionRef` — 通常ドラッグと Ctrl+ドラッグの違い

通常のドラッグでは `baseSelectionRef` は空Setで、矩形範囲がそのまま選択になる。一方 Ctrl+ドラッグでは、既存の選択を維持しつつ新しい矩形範囲を追加したい。

Ctrl+クリック時に `baseSelectionRef` へ現在の選択状態（トグル後）を保存し、ドラッグ中の `mouseenter` でこの基底選択と新しい矩形範囲をマージする。

```
既存選択: { "0:0", "0:1" }   (Ctrl+クリックで選択済みのセル)
ドラッグ: { "2:3", "3:3" }   (新たにドラッグ中の矩形)
       ↓ マージ
結果:    { "0:0", "0:1", "2:3", "3:3" }
```

### コピー: 選択 → TSV変換のフロー

```
1. Ctrl+C 検知
2. 選択セットから row → Set<col> のマップを構築
3. table.getRowModel().rows を配列インデックス(= 視覚行)で走査
4. table.getVisibleLeafColumns()[col].id でカラムIDを取得し、行の値を取得
5. タブ区切りで結合 → 改行で結合 → navigator.clipboard.writeText()
```

選択セットは視覚インデックスのみを持ち、実データへの変換はコピー時にだけ行う。

### ネイティブコピーとの共存

`useCopyToClipboard` はCtrl+Cを横取りする前に、アクティブ要素の状態をチェックする。

```typescript
// 編集中のinput内でテキストが範囲選択されている場合
if (selectionStart !== selectionEnd) {
  return;  // ← ブラウザのネイティブコピーに委譲
}
```

EditableCell が編集モードに入ると `clearSelection()` で選択をクリアするため、通常は「セル選択あり & テキスト選択あり」が同時に起きることはない。しかし安全策として、テキスト選択が存在する場合は常にネイティブコピーを優先する。

### 選択とセル編集の境界

選択モードと編集モードは排他的に動作する。

```
[選択モード] ──ダブルクリック──→ [編集モード]
              ──文字キー入力──→ [編集モード]
                                     │
     clearSelection() が呼ばれ      │
     選択が全解除される              │
                                     │
[選択モード] ←──Escape/blur────── [編集モード]
```

この排他制御は `table.options.meta.clearSelection` を介して行われる。EditableCell は TanStack Table の `meta` 経由で `clearSelection` を受け取り、編集開始時に呼び出す。これにより useSelection フックと EditableCell の間に直接の依存関係を作らず、TanStack Table の既存の `meta` 機構を仲介役として活用している。

## 既存機能への影響

- **NameCell / SelectCell**: イベントが `stopPropagation` されないため変更不要。親の `Table.Cell` でバブリングしたイベントを処理。
- **EditableCell**: 編集モード突入時に選択解除するのみ。既存の編集動作は維持。
- **ソート/フィルタ/カラム表示**: 選択は視覚インデックスで管理されるため、これらが変更されると選択は自動的にクリアされる。
