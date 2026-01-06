import { writable } from 'svelte/store';
import type { NoteArea, NotesState, CustomNote } from '../types';
import { syncWithKV, debouncedSaveToKV } from './syncManager';
import { parseTodos, sectionsToText } from './todoParser';
import { extractTitle, removeTitle } from '../noteUtils';

const STORAGE_KEY = 'dashboard-notes';

const initialState: NotesState = {
  taskBelow: {
    sections: [],
    inputText: '',
    isEditing: false,
    updatedAt: Date.now(),
  },
  footer: {
    sections: [],
    inputText: '',
    isEditing: false,
    updatedAt: Date.now(),
  },
  filterableList: {
    sections: [],
    inputText: '',
    isEditing: false,
    filterText: '',
    updatedAt: Date.now(),
  },
  customNotes: {},
};

export const useNotes = () => {
  const { subscribe, set, update } = writable<NotesState>(initialState);

  // LocalStorageに保存 & KVに自動同期
  const saveToStorage = (state: NotesState) => {
    if (typeof window === 'undefined') return;

    // 新しいデータが空でない場合のみ、現在のデータをバックアップ
    const isNewDataEmpty =
      state.taskBelow.sections.length === 0 &&
      state.footer.sections.length === 0 &&
      state.filterableList.sections.length === 0 &&
      Object.keys(state.customNotes).length === 0;
    if (!isNewDataEmpty) {
      const currentData = localStorage.getItem(STORAGE_KEY);
      if (currentData) {
        try {
          const parsed = JSON.parse(currentData);
          // 現在のデータも空でない場合のみバックアップ
          const isCurrentDataEmpty =
            (!parsed.taskBelow?.sections || parsed.taskBelow.sections.length === 0) &&
            (!parsed.footer?.sections || parsed.footer.sections.length === 0) &&
            (!parsed.filterableList?.sections || parsed.filterableList.sections.length === 0) &&
            (!parsed.customNotes || Object.keys(parsed.customNotes).length === 0);
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
      let localData: NotesState;

      if (stored) {
        try {
          const data = JSON.parse(stored);
          // 既存データにupdatedAtがない場合は追加
          localData = {
            taskBelow: {
              ...data.taskBelow,
              updatedAt: data.taskBelow?.updatedAt || Date.now(),
            },
            footer: {
              ...data.footer,
              updatedAt: data.footer?.updatedAt || Date.now(),
            },
            filterableList: data.filterableList
              ? {
                  ...data.filterableList,
                  filterText: data.filterableList.filterText || '',
                  updatedAt: data.filterableList.updatedAt || Date.now(),
                }
              : initialState.filterableList,
            customNotes: data.customNotes || {},
          };
        } catch (e) {
          console.error('Failed to parse notes from storage:', e);
          localData = initialState;
        }
      } else {
        localData = initialState;
      }

      // KVと同期（NotesStateは3つのエリアを持つため、全体で比較）
      const taskBelowUpdatedAt = localData.taskBelow.updatedAt;
      const footerUpdatedAt = localData.footer.updatedAt;
      const filterableListUpdatedAt = localData.filterableList.updatedAt;
      const overallUpdatedAt = Math.max(taskBelowUpdatedAt, footerUpdatedAt, filterableListUpdatedAt);

      // 同期用の一時的なupdatedAtを追加
      const syncData = { ...localData, updatedAt: overallUpdatedAt };
      const syncResult = await syncWithKV(STORAGE_KEY, syncData);

      if (syncResult.shouldUpdateLocal && syncResult.data) {
        // KVが新しい → 復元
        const kvData = syncResult.data as any;
        delete kvData.updatedAt; // 一時的なupdatedAtを削除

        // customNotesがない場合は空オブジェクトで初期化（後方互換性）
        if (!kvData.customNotes) {
          kvData.customNotes = {};
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(kvData));
        set(kvData);
      } else {
        set(localData);
      }
    },
    // 編集モード切り替え（パース/シリアライズを含む）
    toggleEdit: (area: 'taskBelow' | 'footer' | 'filterableList') => {
      update((state) => {
        const currentArea = state[area];
        let newArea: NoteArea;

        if (currentArea.isEditing) {
          // 確定：テキストをパースしてセクションに反映
          // filterableListは1行1アイテム（本日のタスクと同じ）、他はマルチライン可
          const multilineItems = area !== 'filterableList';
          const newSections = parseTodos(currentArea.inputText, multilineItems);
          newArea = {
            ...currentArea,
            sections: newSections,
            isEditing: false,
            updatedAt: Date.now(),
          };
        } else {
          // 編集開始：セクションをテキストに変換
          const text = sectionsToText(currentArea.sections);
          newArea = {
            ...currentArea,
            inputText: text,
            isEditing: true,
            updatedAt: Date.now(),
          };
        }

        const newState = { ...state, [area]: newArea };
        saveToStorage(newState);
        return newState;
      });
    },

    // テキスト更新（編集中のテキスト変更）
    updateText: (area: 'taskBelow' | 'footer' | 'filterableList', text: string) => {
      update((state) => {
        const newState = {
          ...state,
          [area]: { ...state[area], inputText: text, updatedAt: Date.now() },
        };
        saveToStorage(newState);
        return newState;
      });
    },

    // フィルターテキスト更新
    updateFilterText: (filterText: string) => {
      update((state) => {
        const newState = {
          ...state,
          filterableList: { ...state.filterableList, filterText, updatedAt: Date.now() },
        };
        saveToStorage(newState);
        return newState;
      });
    },

    // 個別ノートとして移行
    migrateToCustomNote: (
      area: 'taskBelow' | 'footer' | 'filterableList',
      noteId: string
    ): { success: boolean; error?: string } => {
      let result = { success: false, error: '' };

      update((state) => {
        const currentArea = state[area];
        const text = currentArea.isEditing
          ? currentArea.inputText
          : sectionsToText(currentArea.sections);

        // タイトルを抽出
        const title = extractTitle(text);
        if (!title) {
          result.error = 'タイトルが見つかりません。先頭に「# タイトル」を追加してください。';
          return state;
        }

        // タイトルを除去した本文を取得
        const content = removeTitle(text);

        // 個別ノートとして保存
        const customNote: CustomNote = {
          id: noteId,
          title,
          content,
          updatedAt: Date.now(),
        };

        // 元のエリアを空にする
        const emptyArea: NoteArea = {
          sections: [],
          inputText: '',
          isEditing: false,
          updatedAt: Date.now(),
          ...(area === 'filterableList' ? { filterText: '' } : {}),
        };

        const newState = {
          ...state,
          [area]: emptyArea,
          customNotes: {
            ...state.customNotes,
            [noteId]: customNote,
          },
        };

        saveToStorage(newState);
        result.success = true;
        return newState;
      });

      return result;
    },

    // 個別ノート一覧を取得
    getCustomNotes: (state: NotesState): CustomNote[] => {
      if (!state.customNotes) {
        return [];
      }
      return Object.values(state.customNotes).sort(
        (a: CustomNote, b: CustomNote) => b.updatedAt - a.updatedAt
      );
    },

    // 個別ノートを削除
    deleteCustomNote: (noteId: string) => {
      update((state) => {
        const { [noteId]: _, ...remainingNotes } = state.customNotes;
        const newState = {
          ...state,
          customNotes: remainingNotes,
        };
        saveToStorage(newState);
        return newState;
      });
    },

    // 個別ノートを更新
    updateCustomNote: (noteId: string, text: string): { success: boolean; error?: string } => {
      let result = { success: false, error: '' };

      update((state) => {
        // タイトルを抽出
        const title = extractTitle(text);
        if (!title) {
          result.error = 'タイトルが見つかりません。先頭に「# タイトル」を追加してください。';
          return state;
        }

        // タイトルを除去した本文を取得
        const content = removeTitle(text);

        // 個別ノートを更新
        const updatedNote: CustomNote = {
          id: noteId,
          title,
          content,
          updatedAt: Date.now(),
        };

        const newState = {
          ...state,
          customNotes: {
            ...state.customNotes,
            [noteId]: updatedNote,
          },
        };

        saveToStorage(newState);
        result.success = true;
        return newState;
      });

      return result;
    },
  };
};
