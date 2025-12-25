<script lang="ts">
	import type { TodoSection } from '$lib/types';

	interface Props {
		title: string;
		sections: TodoSection[];
		inputText: string;
		isEditing: boolean;
		filterText: string;
		placeholder?: string;
		onToggleEdit: () => void;
		onUpdateText: (text: string) => void;
		onUpdateFilterText: (text: string) => void;
		onMigrateToPage?: () => void;
		migrationError?: string;
	}

	let {
		title,
		sections,
		inputText,
		isEditing,
		filterText = '',
		placeholder = '',
		onToggleEdit,
		onUpdateText,
		onUpdateFilterText,
		onMigrateToPage,
		migrationError = ''
	}: Props = $props();

	// フィルター処理：各アイテムが入力文字列を含むかチェック
	const filteredSections = $derived.by(() => {
		if (!filterText.trim()) return sections;

		return sections
			.map((section: TodoSection) => ({
				...section,
				items: section.items.filter((item) =>
					item.text.toLowerCase().includes(filterText.toLowerCase())
				)
			}))
			.filter((section) => section.items.length > 0);
	});
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
		<div class="filter-area">
			<input
				type="text"
				value={filterText}
				oninput={(e) => onUpdateFilterText(e.currentTarget.value)}
				placeholder="フィルター（部分一致）..."
			/>
		</div>
		<div class="notes">
			{#each filteredSections as section}
				<div class="section">
					{#if section.heading}
						<h3>{section.heading}</h3>
					{/if}
					<ul>
						{#each section.items as item}
							<li>{item.text}</li>
						{/each}
					</ul>
				</div>
			{/each}
			{#if filteredSections.length === 0}
				<p class="no-results">該当するアイテムがありません</p>
			{/if}
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

	.filter-area {
		margin-bottom: 1rem;
	}

	input[type='text'] {
		width: 100%;
		padding: 0.5rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-sizing: border-box;
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

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		padding: 0.5rem 0;
		border-bottom: 1px solid #eee;
		line-height: 1.6;
	}

	li:last-child {
		border-bottom: none;
	}

	.no-results {
		color: #999;
		font-style: italic;
		text-align: center;
		padding: 2rem;
	}
</style>
