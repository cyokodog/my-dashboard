# TODO Dashboard アプリケーション

## 概要

日々のタスク管理を行うシンプルなダッシュボード Web アプリケーション。
画面上部にカレンダーイベント表示、左列に「本日のタスク」、右列に「タスクのメモ」を配置した構成。
テキストベースで編集可能で、チェックボックスでタスクの完了状態を管理できる。
macOS のカレンダーアプリと連携し、直近 2 週間の予定を自動取得・表示。

## 技術スタック

- **フレームワーク**: SvelteKit
- **言語**: TypeScript（strict モード）
- **ストレージ**: LocalStorage + Cloudflare Workers KV（クラウド同期）
- **ビルドツール**: Vite
- **マークダウン**: marked（ノート機能）
- **認証**: Cloudflare Zero Trust Access

## TypeScript 型安全性

- `tsconfig.json` で strict モードを有効化
- すべてのコールバック関数の引数に明示的な型アノテーションを付与
- `map`, `filter`, `some`, `findIndex` などの配列メソッドで暗黙的 any を回避
- コンポーネント間で型定義を共有（`types.ts` または各コンポーネント内で定義）

## 機能要件

### 1. カレンダー連携（画面上部）

- macOS カレンダーアプリから直近 2 週間のイベントを自動取得
- 特定カレンダー（"--"）のみを対象
- 日時昇順で表示（10/17 金 12:00 イベント名の形式）
- 本日の予定は太字・青色で強調表示
- 「v」ボタンでイベントを本日のタスクに追加（日時付き）
- 🔄 ボタンで手動更新（強制的に最新データを取得）
- 1 日 1 回の自動取得（タブアクティブ時にチェック）
- LocalStorage でキャッシュ管理（高速表示）

### 2. タスク管理

#### 本日のタスク（左列）

- タスクをカテゴリ別に管理
- テキストエリアで編集可能
- チェックボックスでタスクの完了状態を管理（チェック ON/OFF 切り替え可能）
- 「チェック済みを削除」ボタンでチェック済みアイテムを一括削除
- 「×」ボタンで個別アイテムを削除
- カテゴリ別に縦 1 列で表示

#### タスクのメモ（右列）

- メモをカテゴリ別に管理
- テキストエリアで編集可能
- 「+」ボタンで個別のメモアイテムを「本日のタスク」に移動
- 「×」ボタンで個別アイテムを削除
- カテゴリ別に最大 2 列の横並び表示（auto-fit レイアウト）

#### ノート（左列下部 + フッター）

- カテゴリ別に管理
- テキストエリアで編集可能
- Markdown 記法対応（marked ライブラリ使用）
  - GFM（GitHub Flavored Markdown）有効
  - 改行自動変換（`breaks: true`）
- チェックボックス不要（読み物用）
- 配置場所：
  - 左列：本日のタスクの下
  - フッター：画面最下部
- LocalStorage + Cloudflare KV で個別管理（`notes.taskBelow`, `notes.footer`）

### 3. テキストフォーマット

```
^カテゴリ名
タスク1
vタスク2（チェック済み）

^別のカテゴリ
タスク3

カテゴリなしのアイテム
```

- `^`で始まる行：カテゴリ見出し
- `v`で始まる行：チェック済みアイテム（本日のタスクのみ）
- 通常の行：タスクアイテム
- 空行：カテゴリの区切り
- カテゴリ見出しなしでアイテムを記述することも可能（見出しなしセクション）

### 4. UI/UX

- **レイアウト**: 画面上部にカレンダー、下部に左列（3fr）と右列（7fr）の 2 カラムレイアウト
- **編集モード**: テキストエリアで自由にタスクを編集
- **表示モード**: カテゴリごとにアイテムをリスト表示
  - 左列: 縦 1 列、チェックボックス＋ × ボタン付き
  - 右列: 最大 2 列の横並び、「<」ボタン＋ × ボタン付き
- **モード切り替え**: 編集/確定ボタンで切り替え
- **各パネル**: 枠線と背景色で視覚的に区別
- **ボタンデザイン**:
  - 移動ボタン（v、<）: 青色
  - 削除ボタン（×）: 薄い赤色（ホバーで濃く、拡大）

## データ構造

### TodoSection

```typescript
interface TodoSection {
  heading: string; // カテゴリ名
  items: TodoItem[]; // タスクアイテムの配列
}
```

### TodoItem

```typescript
interface TodoItem {
  text: string; // タスクの内容
  id: string; // 一意のID（タイムスタンプ + ランダム値）
  checked: boolean; // チェック状態（本日のタスクで使用）
}
```

### ストレージデータ

#### 本日のタスク（useTodos）

```typescript
{
  sections: TodoSection[];   // タスクセクション
  inputText: string;         // 編集用テキスト
  isEditing: boolean;        // 編集モード
}
```

#### タスクのメモ（useMemos）

```typescript
{
  sections: TodoSection[];   // メモセクション
  inputText: string;         // 編集用テキスト
  isEditing: boolean;        // 編集モード
}
```

#### ノート（useNotes）

```typescript
{
  taskBelow: {               // 本日のタスク下
    sections: TodoSection[];
    inputText: string;
    isEditing: boolean;
  },
  footer: {                  // フッター領域
    sections: TodoSection[];
    inputText: string;
    isEditing: boolean;
  }
}
```

## 主要機能の実装

### 1. パーサー（parseTodos）

- テキストを`TodoSection`配列に変換
- `^`で始まる行をカテゴリとして認識
- `v`で始まる行をチェック済みアイテムとして認識
- 見出しなしのアイテムはデフォルトセクション（`heading: ''`）に格納
- 各アイテムに一意の ID を自動生成

### 2. シリアライザー（sectionsToText）

- `TodoSection`配列をテキストに変換
- カテゴリとアイテムを整形して出力
- チェック済みアイテムには`v`プレフィックスを付与
- 見出しありセクションには空行を追加、見出しなしセクションには追加しない

### 3. チェックボックス動作（本日のタスク）

- クリックで`checked`状態をトグル
- チェック状態は LocalStorage に保存され、ページリロード後も保持

### 4. チェック済み削除（removeCheckedTodoItems）

- チェック済みアイテムを一括削除
- セクション内のチェック済みアイテムのみをフィルタリング

### 5. メモからタスクへ移動（moveToTodo）

- メモアイテムを「本日のタスク」の見出しなしセクションに移動
- 見出しなしセクションが存在しない場合は先頭に新規作成
- 既に同じテキストのアイテムが存在する場合はボタンを無効化

### 6. アイテム削除（removeItem）

- 左右両パネルで × ボタンによる個別削除が可能
- アイテムを削除後、セクションが空になった場合は自動的にセクションも削除
- 削除操作は即座に LocalStorage に反映

### 7. カレンダー連携

#### CalDAV API（推奨・デフォルト）

- iCloud CalDAV API 経由で直接イベント取得
- 高速（1〜3 秒程度）
- クロスプラットフォーム対応（macOS 以外でも動作）
- Cloudflare Pages/Workers にデプロイ可能
- 環境変数で認証情報を管理（`.env` または Cloudflare の環境変数）
- 必要な環境変数：
  - `ICAL_USERNAME`: Apple ID（メールアドレス）
  - `ICAL_PASSWORD`: iCloud App 専用パスワード
  - `ICAL_CALENDAR_NAMES`: 取得対象カレンダー名（カンマ区切り、空の場合は全カレンダー）
- 日時のタイムゾーン処理：
  - Asia/Tokyo のローカル時刻として正しく表示
  - 終日イベント対応（日付のみ表示）

#### AppleScript（代替手段）

- macOS カレンダーアプリから AppleScript 経由でイベント取得
- 低速（28 秒程度）
- macOS 専用
- 環境変数 `CALENDAR_API_TYPE=applescript` で切り替え
- 一時ファイルにスクリプトを保存して実行（120 秒タイムアウト）

#### 共通機能

- 今日から 1 ヶ月分のイベントを取得
- 取得したイベントは日時昇順でソート表示
- 終日イベントと時刻付きイベントの両方に対応
- 1 日 1 回の自動取得（LocalStorage で管理）
- タブアクティブ時に自動チェック＆取得
- イベントデータをキャッシュして高速表示
- 🔄 ボタンでいつでも手動更新可能
- 本日のイベントを太字・青色で強調表示
- URL を含むテキストは自動的にリンク化（別ウィンドウで開く）

### 8. LocalStorage 連携

- 全ての操作後に LocalStorage に自動保存
- ページ読み込み時に自動復元
- `useTodos`, `useTodoMemos`, `useNotes` で別々のストレージキーを使用
- カレンダー取得日時と取得データを LocalStorage で管理
- キャッシュされたイベントを初回表示時に即座に表示

### 9. Cloudflare Workers KV 同期

- **マージ戦略**: タイムスタンプ比較による自動マージ
  - 各データに `updatedAt` タイムスタンプを付与
  - アプリ起動時に KV とローカルを比較
  - 新しい方を採用（データ消失を防ぐ）
- **自動同期**: 5 秒 debounce で KV に自動保存
- **無料枠内運用**: 無料枠で十分な余裕あり
  - 書き込み: 1,000 回/日（実際は 10〜20 回/日）
  - 読み取り: 10 万回/日（実際は 5〜10 回/日）
  - ストレージ: 1GB（実際は数十 KB）
- **開発環境**: KV が使えない場合はスキップ（エラーにしない）
- **デプロイ**: Cloudflare Pages で KV バインディング設定が必要

### 10. ノート機能

- Markdown 記法対応（marked ライブラリ）
  - GFM（GitHub Flavored Markdown）有効
  - 改行自動変換（`breaks: true`）
  - URL 自動リンク化
  - コードブロック、テーブル、タスクリストなど対応
- カテゴリ見出し対応（`^` で始まる行）
- 複数配置可能な設計（現在：本日のタスク下 + フッター）
- 今後の拡張に対応したストレージ構造

### 11. アクセス認証（Cloudflare Zero Trust Access）

個人利用を前提としたアプリケーションのため、不特定多数からのアクセスを防ぐ認証機能を実装。

#### 採用した方式：Cloudflare Zero Trust Access

- **メールアドレスベースのアクセス制御**
  - 特定のメールアドレス（所有者のみ）にアクセスを許可
  - One-time PIN 認証方式を採用（メールで認証コードを送信）
- **セッション管理**
  - 24時間のセッション維持
  - 複数デバイス間で自動ログイン
- **ログ機能**
  - アクセス履歴を記録（いつ、どこからアクセスしたか確認可能）
  - 不正アクセスの検知が可能

#### Zero Trust vs Basic認証の比較

| 項目 | Zero Trust (Cloudflare Access) | Basic認証 |
|------|-------------------------------|----------|
| **認証方式** | メールアドレス + ワンタイムPIN | ユーザー名 + パスワード |
| **セキュリティ** | ✅ 高（パスワード漏洩リスクなし） | ❌ 低（パスワードが漏れたら終わり） |
| **セッション管理** | ✅ 複数デバイスで自動ログイン | ❌ デバイスごとに再入力 |
| **アクセスログ** | ✅ あり（履歴確認可能） | ❌ なし |
| **パスワード管理** | ✅ 不要（既存のメールアカウント利用） | ❌ 必要（パスワード変更が面倒） |
| **設定の複雑さ** | ❌ やや複雑（初回設定に時間がかかる） | ✅ シンプル（数行のコードで実装可能） |
| **将来の拡張性** | ✅ 高（MFA、IP制限などを追加可能） | ❌ 低（機能拡張が困難） |
| **費用** | ✅ 無料（50ユーザーまで） | ✅ 無料 |

#### メリット

1. **パスワード管理不要**: 既存のメールアカウントを利用するため、新たにパスワードを覚える必要がない
2. **セキュリティログ**: アクセス履歴が自動的に記録され、不正アクセスを検知できる
3. **デバイス間の利便性**: 一度ログインすれば複数デバイス（PC、スマホなど）で24時間有効
4. **将来の拡張が容易**: 必要に応じてMFA（多要素認証）やIP制限などを追加可能

#### デメリット

1. **初回設定が複雑**: Cloudflare Zero Trustの設定に時間がかかる（約15〜20分）
2. **外部サービス依存**: Cloudflareのサービスに依存するため、障害時にアクセス不可の可能性
3. **メール受信が必要**: 認証コードをメールで受信するため、メールが使えない環境では不便

#### 設定手順

1. Cloudflare Zero Trustにアクセスしてチーム作成（無料プラン）
2. Identity Provider設定（One-time PIN有効化）
3. Accessアプリケーション作成
   - Application name: 任意の名前
   - Domain: `my-dashboard-app-388.pages.dev`
   - Session Duration: 24 hours
4. ポリシー設定
   - Action: Allow
   - Rule: Emails = 所有者のメールアドレス
5. 保存して完了

#### 代替案の検討

個人利用で「とにかくシンプルに」を優先する場合、以下の代替案も検討可能：

- **Basic認証**: Cloudflare Workerで数行のコードで実装可能。設定は簡単だが、セキュリティログやセッション管理はなし
- **IP制限**: 自宅や職場のIPアドレスのみ許可。モバイル環境では使えない
- **ランダムURL**: プロジェクト名を推測困難な文字列にする。URLが漏れたら終わり

本プロジェクトでは、セキュリティと利便性のバランスを考慮して **Cloudflare Zero Trust Access** を採用。

## ディレクトリ構成

```
my-dashboard-app/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── CalendarEvents.svelte # カレンダーイベント表示コンポーネント
│   │   │   ├── TodoPanel.svelte      # タスク用パネルコンポーネント
│   │   │   └── NotePanel.svelte      # ノート用パネルコンポーネント
│   │   ├── todoParser.ts             # テキストパース・シリアライズ機能
│   │   ├── types.ts                  # 型定義
│   │   ├── syncManager.ts            # KV同期ロジック
│   │   ├── useTodos.ts               # 本日のタスクStore
│   │   ├── useTodoMemos.ts           # タスクのメモStore
│   │   └── useNotes.ts               # ノートStore
│   ├── routes/
│   │   ├── api/
│   │   │   ├── calendar/
│   │   │   │   └── +server.ts        # カレンダーAPI（CalDAV/AppleScript）
│   │   │   └── sync/
│   │   │       └── +server.ts        # KV同期API
│   │   ├── +layout.ts                # レイアウト設定（SSR無効化）
│   │   ├── +page.ts                  # ページ設定（データローダー）
│   │   └── +page.svelte              # メインページ
│   └── app.html                      # HTMLテンプレート
├── .env                              # 環境変数（gitignore対象）
├── .env.example                      # 環境変数サンプル
├── .gitignore                        # Git除外設定
├── svelte.config.js                  # Svelte設定
├── vite.config.ts                    # Vite設定
├── tsconfig.json                     # TypeScript設定
└── package.json                      # 依存関係
```

## 起動方法

```bash
npm run dev
```

ブラウザで `http://localhost:5173/` にアクセス

## コンポーネント設計

### CalendarEvents.svelte

カレンダーイベントを表示するコンポーネント。

#### Props

- `onMoveToTodo`: イベント → タスク移動ハンドラ
- `targetSections`: 移動先セクション配列（重複チェック用）

#### 機能

- カレンダー API からイベントを取得
- 日時昇順でソート
- 本日のイベントを強調表示
- 1 日 1 回の自動取得制限
- タブアクティブ時の自動チェック
- イベントデータをキャッシュして高速表示
- 🔄 ボタンで手動更新機能

### TodoPanel.svelte

再利用可能なパネルコンポーネント。本日のタスクとタスクのメモの両方で使用。

#### Props

- `title`: パネルタイトル
- `sections`: 表示するセクション配列
- `inputText`: 編集用テキスト（bindable）
- `isEditing`: 編集モード状態
- `enableCheckbox`: チェックボックス表示フラグ
- `placeholder`: テキストエリアのプレースホルダー
- `onToggleEdit`: 編集モード切り替えハンドラ
- `onToggleItem`: チェックボックス切り替えハンドラ（本日のタスク用）
- `onRemoveChecked`: チェック済み削除ハンドラ（本日のタスク用）
- `onMoveToTodo`: メモ → タスク移動ハンドラ（タスクのメモ用）
- `onRemoveItem`: アイテム削除ハンドラ
- `targetSections`: 移動先セクション配列（重複チェック用）

## 環境変数設定

### 必須（CalDAV API 使用時）

```bash
ICAL_USERNAME=your-apple-id@icloud.com
ICAL_PASSWORD=xxxx-xxxx-xxxx-xxxx  # iCloud App専用パスワード
```

### オプション

```bash
CALENDAR_API_TYPE=caldav              # caldav（デフォルト）または applescript
ICAL_CALENDAR_NAMES=--,職場,日本の祝日  # 取得対象カレンダー名
```

### iCloud App 専用パスワードの取得方法

1. https://appleid.apple.com にアクセス
2. 「サインイン」→「App 用パスワード」
3. 新しいパスワードを生成
4. 生成されたパスワード（xxxx-xxxx-xxxx-xxxx 形式）を `.env` に設定

### Cloudflare へのデプロイ

#### 1. 環境変数設定

Cloudflare Pages/Workers の環境変数設定画面で以下を設定：

- `ICAL_USERNAME`: Apple ID（メールアドレス）
- `ICAL_PASSWORD`: iCloud App 専用パスワード
- `ICAL_CALENDAR_NAMES`: 取得対象カレンダー名（オプション）

#### 2. KV Namespace 作成

1. Cloudflare ダッシュボードで KV Namespace を作成
2. 名前: `dashboard-kv`（任意）
3. Workers & Pages → Settings → Bindings で KV を追加
4. Variable name: `KV`（コード内で参照される名前）
5. KV namespace: 作成した Namespace を選択

#### 3. デプロイ

```bash
npm run build
# Cloudflare Pages に自動デプロイ
```

## 制約事項

### AppleScript モード使用時

- macOS 専用（他の OS では動作しない）
- 実行に時間がかかる（28 秒程度）
- クラウド環境にデプロイ不可

### CalDAV API モード使用時

- iCloud App 専用パスワードが必要
- ネットワーク接続必須

### Cloudflare Workers KV 使用時

- 開発環境では KV が利用不可（エラーにはならない）
- 本番環境で KV Namespace バインディングが必要
- データ同期は無料枠内で運用可能

## 今後の拡張予定

- ユーザー認証機能
- カレンダー選択 UI（複数カレンダーの動的選択）
- ダークモード対応
