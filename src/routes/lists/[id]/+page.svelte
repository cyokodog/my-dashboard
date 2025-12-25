<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { useCustomLists } from '$lib/stores/useCustomLists';
	import { parseTodos } from '$lib/stores/todoParser';
	import type { CustomList, TodoSection } from '$lib/types';

	const listsCtx = useCustomLists();
	let customList: CustomList | null = null;
	let isEditing = false;
	let editText = '';
	let filterText = '';
	let errorMessage = '';

	$: listId = $page.params.id;

	onMount(async () => {
		await listsCtx.loadFromStorage();
		loadList();
	});

	function loadList() {
		customList = listsCtx.getCustomList($listsCtx, listId);
		if (customList) {
			editText = sectionsToEditText(customList.sections);
			errorMessage = '';
		} else {
			errorMessage = 'リストが見つかりません';
		}
	}

	function sectionsToEditText(sections: TodoSection[]): string {
		let result = '';
		for (const section of sections) {
			if (section.heading) {
				result += `^${section.heading}\n`;
			}
			for (const item of section.items) {
				result += `${item.text}\n`;
			}
			result += '\n';
		}
		return result.trim();
	}

	function toggleEdit() {
		if (isEditing) {
			// 確定: テキストをパースして保存
			const newSections = parseTodos(editText, false); // 1行1アイテム
			listsCtx.updateCustomList(listId, newSections);
			customList = listsCtx.getCustomList($listsCtx, listId);
			isEditing = false;
		} else {
			isEditing = true;
		}
	}

	function goBack() {
		goto('/');
	}

	function handleDelete() {
		if (confirm(`「${customList?.name}」を削除してもよろしいですか？`)) {
			listsCtx.deleteCustomList(listId);
			goto('/');
		}
	}

	// フィルター処理
	$: filteredSections = customList
		? filterText.trim()
			? customList.sections
					.map((section: TodoSection) => ({
						...section,
						items: section.items.filter((item) =>
							item.text.toLowerCase().includes(filterText.toLowerCase())
						)
					}))
					.filter((section) => section.items.length > 0)
			: customList.sections
		: [];
</script>

<main>
	<div class="header">
		<button class="back-button" on:click={goBack}>← トップに戻る</button>
	</div>

	{#if errorMessage}
		<div class="error">{errorMessage}</div>
	{:else if customList}
		<div class="list-container">
			<div class="title-bar">
				<h1>{customList.name}</h1>
				<div class="button-group">
					<button class="edit-button" on:click={toggleEdit}>
						{isEditing ? '確定' : '編集'}
					</button>
					<button class="delete-button" on:click={handleDelete}>
						削除
					</button>
				</div>
			</div>

			{#if isEditing}
				<textarea class="edit-textarea" bind:value={editText} />
			{:else}
				<div class="filter-area">
					<input
						type="text"
						bind:value={filterText}
						placeholder="フィルター（部分一致）..."
					/>
				</div>
				<div class="items-list">
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
	{/if}
</main>

<style>
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.header {
		margin-bottom: 2rem;
	}

	.back-button {
		padding: 0.5rem 1rem;
		background-color: #f0f0f0;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.back-button:hover {
		background-color: #e0e0e0;
	}

	.error {
		padding: 1rem;
		background-color: #fee;
		border: 1px solid #fcc;
		border-radius: 4px;
		color: #c00;
	}

	.list-container {
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 2rem;
		background-color: #fff;
	}

	.title-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid #eee;
		padding-bottom: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 2rem;
		color: #333;
	}

	.button-group {
		display: flex;
		gap: 0.5rem;
	}

	.edit-button {
		padding: 0.5rem 1rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.edit-button:hover {
		background-color: #0056b3;
	}

	.delete-button {
		padding: 0.5rem 1rem;
		background-color: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.delete-button:hover {
		background-color: #c82333;
	}

	.edit-textarea {
		width: 100%;
		min-height: 400px;
		padding: 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.95rem;
		resize: vertical;
		box-sizing: border-box;
	}

	.filter-area {
		margin-bottom: 1.5rem;
	}

	.filter-area input {
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		box-sizing: border-box;
	}

	.items-list {
		margin-top: 1rem;
	}

	.section {
		margin-bottom: 2rem;
	}

	.section h3 {
		margin-bottom: 0.75rem;
		color: #333;
		font-size: 1.3rem;
		border-bottom: 1px solid #eee;
		padding-bottom: 0.5rem;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		padding: 0.75rem 0;
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
		padding: 3rem;
		margin: 0;
	}
</style>
