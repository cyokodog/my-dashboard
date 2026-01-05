import type { TodoState, NotesState } from '../types';

const SYNC_ENDPOINT = '/api/sync';

export interface SyncResult<T> {
	shouldUpdateLocal: boolean;
	data: T | null;
}

/**
 * データが空かどうかを判定
 */
function isEmptyData(data: TodoState | NotesState | any): boolean {
	// TodoStateの場合
	if ('sections' in data && Array.isArray(data.sections)) {
		return data.sections.length === 0;
	}
	// NotesStateの場合
	if ('taskBelow' in data && 'footer' in data) {
		return (
			data.taskBelow.sections.length === 0 &&
			data.footer.sections.length === 0 &&
			(!data.customNotes || Object.keys(data.customNotes).length === 0)
		);
	}
	return false;
}

/**
 * KVからデータを取得し、タイムスタンプで比較してマージ戦略を決定
 * 空データ保護：空データは同期しない（データ消失を防ぐ）
 */
export async function syncWithKV<T extends { updatedAt: number }>(
	key: string,
	localData: T
): Promise<SyncResult<T>> {
	try {
		// KVからデータ取得
		const response = await fetch(`${SYNC_ENDPOINT}?key=${key}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch from KV: ${response.statusText}`);
		}

		const { data: kvData } = (await response.json()) as { data: T | null };

		const localIsEmpty = isEmptyData(localData);
		const kvIsEmpty = kvData ? isEmptyData(kvData) : true;

		// KVにデータがない場合
		if (!kvData) {
			// ローカルが空でなければKVに保存
			if (!localIsEmpty) {
				await saveToKV(key, localData);
			}
			return { shouldUpdateLocal: false, data: null };
		}

		// ローカルが空でKVが空でない → KVを優先（復元）
		if (localIsEmpty && !kvIsEmpty) {
			console.log(`[Sync] ローカルが空なのでKVから復元: ${key}`);
			return { shouldUpdateLocal: true, data: kvData };
		}

		// KVが空でローカルが空でない → ローカルを優先（KVに保存）
		if (kvIsEmpty && !localIsEmpty) {
			console.log(`[Sync] KVが空なのでローカルを保存: ${key}`);
			await saveToKV(key, localData);
			return { shouldUpdateLocal: false, data: null };
		}

		// 両方空 → 何もしない
		if (localIsEmpty && kvIsEmpty) {
			return { shouldUpdateLocal: false, data: null };
		}

		// 両方空でない → タイムスタンプ比較
		if (kvData.updatedAt > localData.updatedAt) {
			// KVが新しい → LocalStorageを上書き
			return { shouldUpdateLocal: true, data: kvData };
		} else if (localData.updatedAt > kvData.updatedAt) {
			// Localが新しい → KVに保存
			await saveToKV(key, localData);
			return { shouldUpdateLocal: false, data: null };
		}

		// 同じタイムスタンプ → 何もしない
		return { shouldUpdateLocal: false, data: null };
	} catch (error) {
		console.error('Sync error:', error);
		// エラー時はローカルデータを優先
		return { shouldUpdateLocal: false, data: null };
	}
}

/**
 * KVにデータを保存
 */
export async function saveToKV<T>(key: string, data: T): Promise<void> {
	try {
		const response = await fetch(`${SYNC_ENDPOINT}?key=${key}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error(`Failed to save to KV: ${response.statusText}`);
		}
	} catch (error) {
		console.error('Failed to save to KV:', error);
		// エラーは無視（ローカルには保存済み）
	}
}

/**
 * Debounce用のタイマーを管理するマップ
 */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * 5秒のdebounce付き自動保存
 * 空データ保護：空データは保存しない（データ消失を防ぐ）
 */
export function debouncedSaveToKV<T>(key: string, data: T, delayMs = 5000): void {
	// 既存のタイマーをクリア
	const existingTimer = debounceTimers.get(key);
	if (existingTimer) {
		clearTimeout(existingTimer);
	}

	// 空データは保存しない
	if (isEmptyData(data)) {
		console.log(`[Sync] 空データのため保存をスキップ: ${key}`);
		return;
	}

	// 新しいタイマーをセット
	const timer = setTimeout(() => {
		saveToKV(key, data);
		debounceTimers.delete(key);
	}, delayMs);

	debounceTimers.set(key, timer);
}
