import { writable } from 'svelte/store';
import type { CustomList, CustomListsState, NoteArea, TodoSection } from '../types';
import { syncWithKV, debouncedSaveToKV } from './syncManager';
import { sectionsToText } from './todoParser';

const STORAGE_KEY = 'dashboard-custom-lists';

const initialState: CustomListsState = {
	customLists: {}
};

export const useCustomLists = () => {
	const { subscribe, set, update } = writable<CustomListsState>(initialState);

	// LocalStorageに保存 & KVに自動同期
	const saveToStorage = (state: CustomListsState) => {
		if (typeof window === 'undefined') return;

		// 新しいデータが空でない場合のみ、現在のデータをバックアップ
		const isNewDataEmpty = Object.keys(state.customLists).length === 0;
		if (!isNewDataEmpty) {
			const currentData = localStorage.getItem(STORAGE_KEY);
			if (currentData) {
				try {
					const parsed = JSON.parse(currentData);
					// 現在のデータも空でない場合のみバックアップ
					const isCurrentDataEmpty =
						!parsed.customLists || Object.keys(parsed.customLists).length === 0;
					if (!isCurrentDataEmpty) {
						localStorage.setItem(`${STORAGE_KEY}-backup`, currentData);
					}
				} catch (e) {
					console.error('Failed to backup data', e);
				}
			}
		}

		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		debouncedSaveToKV(STORAGE_KEY, state);
	};

	return {
		subscribe,
		loadFromStorage: async () => {
			if (typeof window === 'undefined') return;
			const stored = localStorage.getItem(STORAGE_KEY);
			let localData: CustomListsState;

			if (stored) {
				try {
					const data = JSON.parse(stored);
					localData = {
						customLists: data.customLists || {}
					};
				} catch (e) {
					console.error('Failed to parse custom lists from storage:', e);
					localData = initialState;
				}
			} else {
				localData = initialState;
			}

			// KVと同期
			const customListsUpdatedAt =
				Object.values(localData.customLists).reduce(
					(max: number, list: CustomList) => Math.max(max, list.updatedAt),
					0
				) || Date.now();

			const syncData = { ...localData, updatedAt: customListsUpdatedAt };
			const syncResult = await syncWithKV(STORAGE_KEY, syncData);

			if (syncResult.shouldUpdateLocal && syncResult.data) {
				// KVが新しい → 復元
				const kvData = syncResult.data as any;
				delete kvData.updatedAt;

				// customListsがない場合は空オブジェクトで初期化（後方互換性）
				if (!kvData.customLists) {
					kvData.customLists = {};
				}

				localStorage.setItem(STORAGE_KEY, JSON.stringify(kvData));
				set(kvData);
			} else {
				set(localData);
			}
		},

		// NoteAreaから個別アイテム一覧に移行
		migrateFromNoteArea: (
			area: NoteArea,
			listId: string,
			listName: string
		): { success: boolean; error?: string } => {
			let result = { success: false, error: '' };

			update((state) => {
				// リスト名が必要
				if (!listName.trim()) {
					result.error = 'リスト名を入力してください';
					return state;
				}

				// 個別リストとして保存
				const customList: CustomList = {
					id: listId,
					name: listName,
					sections: area.sections,
					updatedAt: Date.now()
				};

				const newState = {
					...state,
					customLists: {
						...state.customLists,
						[listId]: customList
					}
				};

				saveToStorage(newState);
				result.success = true;
				return newState;
			});

			return result;
		},

		// 個別リスト一覧を取得
		getCustomLists: (state: CustomListsState): CustomList[] => {
			if (!state.customLists) {
				return [];
			}
			return Object.values(state.customLists).sort(
				(a: CustomList, b: CustomList) => b.updatedAt - a.updatedAt
			);
		},

		// 個別リストを取得
		getCustomList: (state: CustomListsState, listId: string): CustomList | null => {
			return state.customLists[listId] || null;
		},

		// 個別リストを更新
		updateCustomList: (listId: string, sections: TodoSection[]) => {
			update((state) => {
				const list = state.customLists[listId];
				if (!list) return state;

				const newState = {
					...state,
					customLists: {
						...state.customLists,
						[listId]: {
							...list,
							sections,
							updatedAt: Date.now()
						}
					}
				};

				saveToStorage(newState);
				return newState;
			});
		},

		// 個別リストを削除
		deleteCustomList: (listId: string) => {
			update((state) => {
				const { [listId]: _, ...remainingLists } = state.customLists;
				const newState = {
					...state,
					customLists: remainingLists
				};
				saveToStorage(newState);
				return newState;
			});
		}
	};
};
