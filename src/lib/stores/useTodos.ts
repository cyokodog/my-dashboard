import { writable } from 'svelte/store';
import type { TodoSection, TodoState } from '../types';
import { syncWithKV, debouncedSaveToKV } from './syncManager';
import { parseTodos, sectionsToText } from './todoParser';

const STORAGE_KEY = 'todo-dashboard-data';

export const useTodos = () => {
	const initialState: TodoState = {
		sections: [],
		inputText: '',
		isEditing: false,
		updatedAt: Date.now()
	};

	const { subscribe, set, update } = writable<TodoState>(initialState);

	// LocalStorageから読み込み & KVと同期
	const loadFromStorage = async () => {
		if (typeof window === 'undefined') return;

		const saved = localStorage.getItem(STORAGE_KEY);
		let localData: TodoState;

		if (saved) {
			try {
				const data = JSON.parse(saved);
				localData = {
					sections: data.sections || [],
					inputText: data.inputText || '',
					isEditing: data.isEditing !== undefined ? data.isEditing : false,
					updatedAt: data.updatedAt || Date.now()
				};
			} catch (e) {
				console.error('Failed to load data from localStorage', e);
				localData = initialState;
			}
		} else {
			localData = initialState;
		}

		// KVと同期
		const syncResult = await syncWithKV(STORAGE_KEY, localData);
		if (syncResult.shouldUpdateLocal && syncResult.data) {
			// KVが新しい → LocalStorageとStoreを更新
			localStorage.setItem(STORAGE_KEY, JSON.stringify(syncResult.data));
			set(syncResult.data);
		} else {
			// Localが新しいまたは同じ → そのまま使う
			set(localData);
		}
	};

	// LocalStorageに保存 & KVに自動同期
	const saveToStorage = (state: TodoState) => {
		if (typeof window === 'undefined') return;

		// 新しいデータが空でない場合のみ、現在のデータをバックアップ
		const isNewDataEmpty = state.sections.length === 0;
		if (!isNewDataEmpty) {
			const currentData = localStorage.getItem(STORAGE_KEY);
			if (currentData) {
				try {
					const parsed = JSON.parse(currentData);
					// 現在のデータも空でない場合のみバックアップ
					if (parsed.sections && parsed.sections.length > 0) {
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

	// 内部用：低レベルな更新メソッド
	const updateSections = (sections: TodoSection[]) => {
		update(state => {
			const newState = { ...state, sections, updatedAt: Date.now() };
			saveToStorage(newState);
			return newState;
		});
	};

	const updateInputText = (inputText: string) => {
		update(state => {
			const newState = { ...state, inputText, updatedAt: Date.now() };
			saveToStorage(newState);
			return newState;
		});
	};

	// 公開API：高レベルなビジネスロジック
	return {
		subscribe,
		loadFromStorage,

		// 編集モード切り替え（パース/シリアライズを含む）
		toggleEdit: () => {
			update(state => {
				let newState: TodoState;
				if (state.isEditing) {
					// 確定：テキストをパースしてセクションに反映
					const newSections = parseTodos(state.inputText);
					newState = { ...state, sections: newSections, isEditing: false, updatedAt: Date.now() };
				} else {
					// 編集開始：セクションをテキストに変換
					const text = sectionsToText(state.sections);
					newState = { ...state, inputText: text, isEditing: true, updatedAt: Date.now() };
				}
				saveToStorage(newState);
				return newState;
			});
		},

		// アイテムのチェック切り替え
		toggleItem: (sectionIndex: number, itemIndex: number) => {
			update(state => {
				const newSections = state.sections.map((section, si) => {
					if (si === sectionIndex) {
						return {
							...section,
							items: section.items.map((item, ii) => {
								if (ii === itemIndex) {
									return { ...item, checked: !item.checked };
								}
								return item;
							})
						};
					}
					return section;
				});
				const newState = { ...state, sections: newSections, updatedAt: Date.now() };
				saveToStorage(newState);
				return newState;
			});
		},

		// チェック済みアイテムの削除
		removeCheckedItems: () => {
			update(state => {
				const newSections = state.sections.map(section => ({
					...section,
					items: section.items.filter(item => !item.checked)
				}));
				const newState = { ...state, sections: newSections, updatedAt: Date.now() };
				saveToStorage(newState);
				return newState;
			});
		},

		// アイテムの削除
		removeItem: (sectionIndex: number, itemIndex: number) => {
			update(state => {
				const newSections = state.sections
					.map((section, si) => {
						if (si === sectionIndex) {
							return {
								...section,
								items: section.items.filter((_, ii) => ii !== itemIndex)
							};
						}
						return section;
					})
					.filter(section => section.items.length > 0);
				const newState = { ...state, sections: newSections, updatedAt: Date.now() };
				saveToStorage(newState);
				return newState;
			});
		},

		// カレンダーイベントやメモからアイテムを追加
		addItem: (text: string) => {
			update(state => {
				let newSections = [...state.sections];
				const noHeadingSectionIndex = newSections.findIndex(s => s.heading === '');

				const id = `${Date.now()}-${Math.random()}`;
				const newItem = { text, id, checked: false };

				if (noHeadingSectionIndex === -1) {
					newSections.unshift({
						heading: '',
						items: [newItem]
					});
				} else {
					newSections[noHeadingSectionIndex] = {
						...newSections[noHeadingSectionIndex],
						items: [...newSections[noHeadingSectionIndex].items, newItem]
					};
				}

				const newState = { ...state, sections: newSections, updatedAt: Date.now() };
				saveToStorage(newState);
				return newState;
			});
		}
	};
};
