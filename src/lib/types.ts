export interface TodoSection {
	heading: string;
	items: TodoItem[];
}

export interface TodoItem {
	text: string;
	id: string;
	checked: boolean;
}

export interface TodoState {
	sections: TodoSection[];
	inputText: string;
	isEditing: boolean;
	updatedAt: number;
}

export interface NoteArea {
	sections: TodoSection[];
	inputText: string;
	isEditing: boolean;
	updatedAt: number;
	filterText?: string; // フィルター機能用（オプション）
}

export interface CustomNote {
	id: string; // URL用のID（例: 'footer', 'task-below'）
	title: string; // Markdownから抽出されたタイトル
	content: string; // Markdown本文（タイトル除く）
	updatedAt: number;
}

export interface CustomList {
	id: string; // URL用のID（例: 'filterable-list'）
	name: string; // リスト名（例: '買い物リスト'）
	sections: TodoSection[]; // アイテムデータ
	updatedAt: number;
}

export interface CustomListsState {
	customLists: { [id: string]: CustomList }; // 個別アイテム一覧
}

export interface NotesState {
	taskBelow: NoteArea;
	footer: NoteArea;
	filterableList: NoteArea; // フィルター付きノート
	customNotes: { [id: string]: CustomNote }; // 個別ノート
}
