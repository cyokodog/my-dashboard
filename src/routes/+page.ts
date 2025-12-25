// SSR 制御は +layout.ts で設定済み（ssr = false）
// このファイルでも設定可能：
// export const ssr = false;

// 必要に応じて load 関数でデータを取得可能
export async function load({ fetch }) {
  // 例：初回表示時にカレンダーデータをプリロード
  // const events = await fetch('/api/calendar').then(r => r.json());
  // return { events };

  return {};
}
