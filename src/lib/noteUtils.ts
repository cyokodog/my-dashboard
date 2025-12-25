/**
 * Markdownテキストから先頭のH1タイトルを抽出
 * @param markdown Markdownテキスト
 * @returns タイトル文字列、見つからない場合はnull
 */
export function extractTitle(markdown: string): string | null {
	const lines = markdown.trim().split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith('# ')) {
			return trimmed.substring(2).trim();
		}
	}
	return null;
}

/**
 * テキストからH1タイトルを除去
 * @param markdown Markdownテキスト
 * @returns タイトル行を除去したテキスト
 */
export function removeTitle(markdown: string): string {
	const lines = markdown.split('\n');
	let titleIndex = -1;

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (trimmed.startsWith('# ')) {
			titleIndex = i;
			break;
		}
	}

	if (titleIndex === -1) {
		return markdown;
	}

	// タイトル行を除去
	lines.splice(titleIndex, 1);
	return lines.join('\n').trim();
}
