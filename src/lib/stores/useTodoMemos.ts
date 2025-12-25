import { writable } from 'svelte/store';
import type { TodoSection, TodoState } from '../types';
import { syncWithKV, debouncedSaveToKV } from './syncManager';
import { parseTodos, sectionsToText } from './todoParser';

const STORAGE_KEY = 'memo-dashboard-data';

export const useTodoMemos = () => {
	const initialState: TodoState = {
		sections: [],
		inputText: '',
		isEditing: false,
		updatedAt: Date.now()
	};

	const { subscribe, set, update } = writable<TodoState>(initialState);

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
				console.error('Failed to load memo data from localStorage', e);
				localData = initialState;
			}
		} else {
			localData = initialState;
		}

		// KVと同期
		const syncResult = await syncWithKV(STORAGE_KEY, localData);
		if (syncResult.shouldUpdateLocal && syncResult.data) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(syncResult.data));
			set(syncResult.data);
		} else {
			set(localData);
		}
	};

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

	return {
		subscribe,
		loadFromStorage,

		// 編集モード切り替え
		toggleEdit: () => {
			update(state => {
				let newState: TodoState;
				if (state.isEditing) {
					const newSections = parseTodos(state.inputText);
					newState = { ...state, sections: newSections, isEditing: false, updatedAt: Date.now() };
				} else {
					const text = sectionsToText(state.sections);
					newState = { ...state, inputText: text, isEditing: true, updatedAt: Date.now() };
				}
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
		}
	};
};
