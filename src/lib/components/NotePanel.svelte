<script lang="ts">
	import type { TodoSection } from '$lib/types';
	import { marked } from 'marked';

	interface Props {
		title: string;
		sections: TodoSection[];
		inputText: string;
		isEditing: boolean;
		placeholder?: string;
		onToggleEdit: () => void;
		onUpdateText: (text: string) => void;
		onMigrateToPage?: () => void;
		migrationError?: string;
	}

	let {
		title,
		sections,
		inputText,
		isEditing,
		placeholder = '',
		onToggleEdit,
		onUpdateText,
		onMigrateToPage,
		migrationError = ''
	}: Props = $props();

	// Markedの設定
	marked.setOptions({
		breaks: true, // 改行を<br>に変換
		gfm: true // GitHub Flavored Markdown
	});

	// マークダウンをHTMLに変換
	const parseMarkdown = (text: string): string => {
		return marked.parse(text) as string;
	};
</script>

<div class="panel">
	<h2>{title}</h2>
	<div class="button-area">
		<button onclick={onToggleEdit}>{isEditing ? '確定' : '編集'}</button>
		{#if onMigrateToPage}
			<button class="migrate-button" onclick={onMigrateToPage}>📄 個別ページとして移動</button>
		{/if}
	</div>
	{#if migrationError}
		<div class="error-message">{migrationError}</div>
	{/if}

	{#if isEditing}
		<div class="input-area">
			<textarea value={inputText} oninput={(e) => onUpdateText(e.currentTarget.value)} {placeholder} rows="10"></textarea>
		</div>
	{:else}
		<div class="notes">
			{#each sections as section}
				<div class="section">
					{#if section.heading}
						<h3>{section.heading}</h3>
					{/if}
					{#each section.items as item}
						<div class="note-content markdown-body">
							{@html parseMarkdown(item.text)}
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	h2 {
		margin-bottom: 1rem;
		color: #333;
		font-size: 1.2rem;
	}

	.button-area {
		margin-bottom: 0.5rem;
	}

	button {
		margin-top: 0.5rem;
		padding: 0.5rem 1.5rem;
		font-size: 1rem;
		background-color: #0066cc;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #0052a3;
	}

	.migrate-button {
		margin-left: 0.5rem;
		background-color: #28a745;
	}

	.migrate-button:hover {
		background-color: #218838;
	}

	.error-message {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background-color: #fee;
		border: 1px solid #fcc;
		border-radius: 4px;
		color: #c00;
		font-size: 0.9rem;
	}

	textarea {
		width: 100%;
		padding: 1rem;
		font-size: 1rem;
		font-family: monospace;
		border: 1px solid #ccc;
		border-radius: 4px;
		resize: vertical;
		box-sizing: border-box;
		line-height: 1.8;
	}

	.notes {
		margin-top: 0.5rem;
	}

	.section {
		margin-bottom: 1.5rem;
	}

	.section h3 {
		margin-bottom: 0.5rem;
		color: #333;
		font-size: 1.1rem;
	}

	.note-content {
		line-height: 1.6;
		margin-bottom: 1rem;
	}
</style>
