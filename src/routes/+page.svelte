<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { useTodos } from '$lib/stores/useTodos';
	import { useTodoMemos } from '$lib/stores/useTodoMemos';
	import { useNotes } from '$lib/stores/useNotes';
	import { useCustomLists } from '$lib/stores/useCustomLists';
	import TodoPanel from '$lib/components/TodoPanel.svelte';
	import NotePanel from '$lib/components/NotePanel.svelte';
	import FilterableNotePanel from '$lib/components/FilterableNotePanel.svelte';
	import CalendarEvents from '$lib/components/CalendarEvents.svelte';

	const todosCtx = useTodos();
	const memosCtx = useTodoMemos();
	const notesCtx = useNotes();
	const listsCtx = useCustomLists();

	let taskBelowError = '';
	let footerError = '';
	let filterableListError = '';
	let filterableListName = '';

	onMount(() => {
		todosCtx.loadFromStorage();
		memosCtx.loadFromStorage();
		notesCtx.loadFromStorage();
		listsCtx.loadFromStorage();
	});

	function handleMigrateTaskBelow() {
		const result = notesCtx.migrateToCustomNote('taskBelow', 'task-below');
		if (result.success) {
			goto('/notes/task-below');
		} else {
			taskBelowError = result.error || '';
		}
	}

	function handleMigrateFooter() {
		const result = notesCtx.migrateToCustomNote('footer', 'footer');
		if (result.success) {
			goto('/notes/footer');
		} else {
			footerError = result.error || '';
		}
	}

	function handleMigrateFilterableList() {
		// リスト名を入力してもらう
		const listName = prompt('リスト名を入力してください:', '一覧');
		if (!listName) {
			return; // キャンセルされた
		}

		const result = listsCtx.migrateFromNoteArea(
			$notesCtx.filterableList,
			'filterable-list',
			listName
		);
		if (result.success) {
			// 移行成功したら元のエリアを空にする
			notesCtx.toggleEdit('filterableList'); // 編集モードに
			notesCtx.updateText('filterableList', ''); // 空にする
			notesCtx.toggleEdit('filterableList'); // 確定
			goto('/lists/filterable-list');
		} else {
			filterableListError = result.error || '';
		}
	}

	$: customNotes = notesCtx.getCustomNotes($notesCtx);
	$: customLists = listsCtx.getCustomLists($listsCtx);
</script>

<main>
	<div style="background-color: lime; padding: 10px; text-align: center; font-weight: bold;">
		✅ wrangler.toml修正後のテスト - 2025-12-26 15:00
	</div>

	<CalendarEvents onMoveToTodo={(text) => todosCtx.addItem(text)} targetSections={$todosCtx.sections} />

	<div class="container">
		<div class="column left-column">
			<TodoPanel
				title="本日のタスク"
				sections={$todosCtx.sections}
				bind:inputText={$todosCtx.inputText}
				isEditing={$todosCtx.isEditing}
				enableCheckbox={true}
				placeholder="^買い物&#10;野菜を買う&#10;牛乳を買う&#10;&#10;^勉強&#10;JSの勉強をする&#10;AIの勉強をする"
				onToggleEdit={() => todosCtx.toggleEdit()}
				onToggleItem={(si, ii) => todosCtx.toggleItem(si, ii)}
				onRemoveChecked={() => todosCtx.removeCheckedItems()}
				onRemoveItem={(si, ii) => todosCtx.removeItem(si, ii)}
			/>

			<div class="note-section">
				<NotePanel
					title="ノート"
					sections={$notesCtx.taskBelow.sections}
					inputText={$notesCtx.taskBelow.inputText}
					isEditing={$notesCtx.taskBelow.isEditing}
					placeholder="ノートを入力してください"
					onToggleEdit={() => notesCtx.toggleEdit('taskBelow')}
					onUpdateText={(text) => notesCtx.updateText('taskBelow', text)}
					onMigrateToPage={handleMigrateTaskBelow}
					migrationError={taskBelowError}
				/>
			</div>
		</div>

		<div class="column">
			<TodoPanel
				title="タスクのメモ"
				sections={$memosCtx.sections}
				bind:inputText={$memosCtx.inputText}
				isEditing={$memosCtx.isEditing}
				enableCheckbox={false}
				placeholder="^アイデア&#10;新しい機能のアイデア&#10;&#10;^参考リンク&#10;https://example.com"
				onToggleEdit={() => memosCtx.toggleEdit()}
				onMoveToTodo={(text) => todosCtx.addItem(text)}
				onRemoveItem={(si, ii) => memosCtx.removeItem(si, ii)}
				targetSections={$todosCtx.sections}
			/>
		</div>
	</div>

	<footer>
		<div class="footer-columns">
			<div class="footer-left">
				<FilterableNotePanel
					title="一覧ノート"
					sections={$notesCtx.filterableList.sections}
					inputText={$notesCtx.filterableList.inputText}
					isEditing={$notesCtx.filterableList.isEditing}
					filterText={$notesCtx.filterableList.filterText || ''}
					placeholder="アイテムを入力してください"
					onToggleEdit={() => notesCtx.toggleEdit('filterableList')}
					onUpdateText={(text) => notesCtx.updateText('filterableList', text)}
					onUpdateFilterText={(text) => notesCtx.updateFilterText(text)}
					onMigrateToPage={handleMigrateFilterableList}
					migrationError={filterableListError}
				/>
			</div>
			<div class="footer-right">
				<NotePanel
					title="フッターノート"
					sections={$notesCtx.footer.sections}
					inputText={$notesCtx.footer.inputText}
					isEditing={$notesCtx.footer.isEditing}
					placeholder="フッターノートを入力してください"
					onToggleEdit={() => notesCtx.toggleEdit('footer')}
					onUpdateText={(text) => notesCtx.updateText('footer', text)}
					onMigrateToPage={handleMigrateFooter}
					migrationError={footerError}
				/>
			</div>
		</div>

		<!-- 個別ノート一覧（全幅） -->
		<div class="custom-notes-list">
			<h2>個別ノート</h2>
			{#if customNotes.length === 0}
				<p class="no-notes">個別ノートはまだありません</p>
			{:else}
				<div class="notes-grid">
					{#each customNotes as note}
						<a href="/notes/{note.id}" class="note-link">
							<span class="note-title">{note.title}</span>
							<span class="note-date">{new Date(note.updatedAt).toLocaleDateString('ja-JP')}</span>
						</a>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 個別アイテム一覧（全幅） -->
		<div class="custom-lists-section">
			<h2>個別アイテム一覧</h2>
			{#if customLists.length === 0}
				<p class="no-notes">個別アイテム一覧はまだありません</p>
			{:else}
				<div class="notes-grid">
					{#each customLists as list}
						<a href="/lists/{list.id}" class="note-link">
							<span class="note-title">📋 {list.name}</span>
							<span class="note-date">{new Date(list.updatedAt).toLocaleDateString('ja-JP')}</span>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</footer>
</main>

<style>
	main {
		max-width: 1600px;
		margin: 0 auto;
		padding: 2rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.container {
		display: grid;
		grid-template-columns: 3fr 7fr;
		gap: 2rem;
		align-items: start;
		margin-bottom: 2rem;
	}

	.column {
		min-width: 0;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		background-color: #fff;
	}

	.left-column {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.note-section {
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		background-color: #fff;
	}

	footer {
		margin-top: 2rem;
	}

	.footer-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		margin-bottom: 2rem;
	}

	.footer-left,
	.footer-right {
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		background-color: #fff;
	}

	.custom-notes-list,
	.custom-lists-section {
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		background-color: #fff;
		margin-bottom: 2rem;
	}

	.custom-lists-section:last-child {
		margin-bottom: 0;
	}

	.custom-notes-list h2,
	.custom-lists-section h2 {
		margin-top: 0;
		margin-bottom: 1rem;
		color: #333;
		font-size: 1.2rem;
	}

	.no-notes {
		color: #999;
		font-style: italic;
		text-align: center;
		padding: 2rem;
		margin: 0;
	}

	.notes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
	}

	.note-link {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background-color: #f9f9f9;
		text-decoration: none;
		color: #333;
		transition: all 0.2s;
	}

	.note-link:hover {
		background-color: #e8f4ff;
		border-color: #007bff;
		transform: translateY(-2px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.note-title {
		font-weight: 600;
		color: #007bff;
	}

	.note-date {
		font-size: 0.85rem;
		color: #666;
	}

	@media (max-width: 1024px) {
		main {
			padding: 1rem;
		}

		.container {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.column {
			padding: 1rem;
		}

		.note-section {
			padding: 1rem;
		}

		.footer-columns {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.footer-left,
		.footer-right {
			padding: 1rem;
		}

		.custom-notes-list,
		.custom-lists-section {
			padding: 1rem;
		}

		.notes-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
