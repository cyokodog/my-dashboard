import type { TodoSection } from '../types';

export const parseTodos = (text: string, multilineItems = false): TodoSection[] => {
	if (multilineItems) {
		// ノート用：見出しで区切り、各セクションのテキストを1つのアイテムとして扱う
		const sections: TodoSection[] = [];
		const parts = text.split(/^(?=\^)/m); // ^で始まる行で分割

		for (const part of parts) {
			if (!part.trim()) continue;

			const lines = part.split('\n');
			const firstLine = lines[0].trim();

			if (firstLine.startsWith('^')) {
				// 見出しあり
				const heading = firstLine.slice(1).trim();
				const content = lines.slice(1).join('\n').trim();
				if (content) {
					sections.push({
						heading,
						items: [{ text: content, id: `${Date.now()}-${Math.random()}`, checked: false }]
					});
				}
			} else {
				// 見出しなし
				const content = part.trim();
				if (content) {
					sections.push({
						heading: '',
						items: [{ text: content, id: `${Date.now()}-${Math.random()}`, checked: false }]
					});
				}
			}
		}
		return sections;
	}

	// タスク用：1行=1アイテム
	const lines = text.split('\n');
	const result: TodoSection[] = [];
	let currentSection: TodoSection | null = null;
	let hasDefaultSection = false;

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.startsWith('^')) {
			// 新しいセクション開始
			if (currentSection) {
				result.push(currentSection);
			}
			currentSection = {
				heading: trimmed.slice(1).trim(),
				items: []
			};
		} else if (trimmed) {
			// 見出しがない場合はデフォルトセクションを作成
			if (!currentSection) {
				if (!hasDefaultSection) {
					currentSection = {
						heading: '',
						items: []
					};
					hasDefaultSection = true;
				}
			}

			if (currentSection) {
				// アイテム追加
				const checked = trimmed.startsWith('v');
				const text = checked ? trimmed.slice(1).trim() : trimmed;
				const id = `${Date.now()}-${Math.random()}`;
				currentSection.items.push({ text, id, checked });
			}
		}
	}

	// 最後のセクションを追加
	if (currentSection) {
		result.push(currentSection);
	}

	return result;
};

export const sectionsToText = (sections: TodoSection[]): string => {
	let result = '';
	for (const section of sections) {
		if (section.heading) {
			result += `^${section.heading}\n`;
		}
		for (const item of section.items) {
			const prefix = item.checked ? 'v' : '';
			result += `${prefix}${item.text}\n`;
		}
		if (section.heading) {
			result += '\n';
		}
	}
	return result.trim();
};
