<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { useNotes } from '$lib/stores/useNotes';
	import { marked } from 'marked';
	import type { CustomNote } from '$lib/types';

	const notesCtx = useNotes();
	let customNote: CustomNote | null = null;
	let isEditing = false;
	let editText = '';
	let errorMessage = '';

	$: noteId = $page.params.id;

	onMount(async () => {
		await notesCtx.loadFromStorage();
		loadNote();
	});

	function loadNote() {
		customNote = $notesCtx.customNotes[noteId] || null;
		if (customNote) {
			editText = `# ${customNote.title}\n\n${customNote.content}`;
			errorMessage = '';
		} else {
			errorMessage = 'ノートが見つかりません';
		}
	}

	function toggleEdit() {
		if (isEditing) {
			// 確定: データを保存
			const result = notesCtx.updateCustomNote(noteId, editText);
			if (result.success) {
				isEditing = false;
				loadNote(); // 更新されたデータを再読み込み
				errorMessage = '';
			} else {
				errorMessage = result.error || '更新に失敗しました';
			}
		} else {
			isEditing = true;
		}
	}

	function goBack() {
		goto('/');
	}

	function handleDelete() {
		if (confirm(`「${customNote?.title}」を削除してもよろしいですか？`)) {
			notesCtx.deleteCustomNote(noteId);
			goto('/');
		}
	}

	$: renderedHtml = customNote && !isEditing ? marked(customNote.content, { breaks: true }) : '';
</script>

<main>
	<div class="header">
		<button class="back-button" on:click={goBack}>← トップに戻る</button>
	</div>

	{#if errorMessage}
		<div class="error">{errorMessage}</div>
	{:else if customNote}
		<div class="note-container">
			<div class="title-bar">
				<h1>{customNote.title}</h1>
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
				<div class="markdown-content">
					{@html renderedHtml}
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

	.note-container {
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
	}

	.markdown-content {
		line-height: 1.6;
		color: #333;
	}

	.markdown-content :global(h1),
	.markdown-content :global(h2),
	.markdown-content :global(h3) {
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}

	.markdown-content :global(p) {
		margin-bottom: 1rem;
	}

	.markdown-content :global(a) {
		color: #007bff;
		text-decoration: none;
	}

	.markdown-content :global(a:hover) {
		text-decoration: underline;
	}

	.markdown-content :global(code) {
		background-color: #f5f5f5;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-family: monospace;
	}

	.markdown-content :global(pre) {
		background-color: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
	}

	.markdown-content :global(pre code) {
		background-color: transparent;
		padding: 0;
	}
</style>
