<script lang="ts">
	import type { TodoSection } from '$lib/types';

	interface Props {
		title: string;
		sections: TodoSection[];
		inputText: string;
		isEditing: boolean;
		enableCheckbox?: boolean;
		placeholder?: string;
		onToggleEdit: () => void;
		onToggleItem?: (sectionIndex: number, itemIndex: number) => void;
		onRemoveChecked?: () => void;
		onMoveToTodo?: (text: string) => void;
		onRemoveItem?: (sectionIndex: number, itemIndex: number) => void;
		targetSections?: TodoSection[];
	}

	let {
		title,
		sections,
		inputText = $bindable(),
		isEditing,
		enableCheckbox = false,
		placeholder = '',
		onToggleEdit,
		onToggleItem,
		onRemoveChecked,
		onMoveToTodo,
		onRemoveItem,
		targetSections = []
	}: Props = $props();

	const isItemInTarget = (text: string): boolean => {
		return targetSections.some((section: TodoSection) => section.items.some((item: { text: string }) => item.text === text));
	};

	const isUrl = (text: string): boolean => {
		return text.startsWith('http://') || text.startsWith('https://');
	};

	const parseTextWithLinks = (text: string): { type: 'text' | 'link'; content: string }[] => {
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const parts: { type: 'text' | 'link'; content: string }[] = [];
		let lastIndex = 0;
		let match;

		while ((match = urlRegex.exec(text)) !== null) {
			// URLの前のテキスト
			if (match.index > lastIndex) {
				parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
			}
			// URL部分
			parts.push({ type: 'link', content: match[0] });
			lastIndex = match.index + match[0].length;
		}

		// 残りのテキスト
		if (lastIndex < text.length) {
			parts.push({ type: 'text', content: text.slice(lastIndex) });
		}

		return parts.length > 0 ? parts : [{ type: 'text', content: text }];
	};
</script>

<div class="panel">
	<h2>{title}</h2>
	<div class="button-area">
		<button onclick={onToggleEdit}>{isEditing ? '確定' : '編集'}</button>
		{#if !isEditing && enableCheckbox && onRemoveChecked}
			<button onclick={onRemoveChecked} class="remove-button">チェック済みを削除</button>
		{/if}
	</div>

	{#if isEditing}
		<div class="input-area">
			<textarea bind:value={inputText} {placeholder} rows="30"></textarea>
		</div>
	{:else}
		<div class="todos">
			{#each sections as section, sectionIndex}
				<div class="section">
					{#if section.heading}
						<h3>{section.heading}</h3>
					{/if}
					<ul>
						{#each section.items as item, itemIndex (item.id)}
							<li>
								{#if enableCheckbox && onToggleItem}
									<label>
										<input
											type="checkbox"
											checked={item.checked}
											onclick={() => onToggleItem?.(sectionIndex, itemIndex)}
										/>
										<span class="item-text">
											{#each parseTextWithLinks(item.text) as part}
												{#if part.type === 'link'}
													<a href={part.content} target="_blank" rel="noopener noreferrer" class="inline-link">
														{part.content}
													</a>
												{:else}
													{part.content}
												{/if}
											{/each}
										</span>
										{#if onRemoveItem}
											<button
												class="remove-item-button"
												onclick={(e) => {
													e.preventDefault();
													onRemoveItem?.(sectionIndex, itemIndex);
												}}
												title="削除"
											>
												×
											</button>
										{/if}
									</label>
								{:else}
									<div class="item-row">
										{#if onMoveToTodo}
											<button
												class="move-button"
												onclick={() => onMoveToTodo?.(item.text)}
												disabled={isItemInTarget(item.text)}
												title="TODOに追加"
											>
												+
											</button>
										{/if}
										<span class="item-text">
											{#each parseTextWithLinks(item.text) as part}
												{#if part.type === 'link'}
													<a href={part.content} target="_blank" rel="noopener noreferrer" class="inline-link">
														{part.content}
													</a>
												{:else}
													{part.content}
												{/if}
											{/each}
										</span>
										{#if onRemoveItem}
											<button
												class="remove-item-button"
												onclick={() => onRemoveItem?.(sectionIndex, itemIndex)}
												title="削除"
											>
												×
											</button>
										{/if}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
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

	button:hover:not(.remove-item-button) {
		background-color: #0052a3;
	}

	.remove-button {
		background-color: #dc3545;
		margin-left: 0.5rem;
	}

	.remove-button:hover {
		background-color: #c82333;
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

	.todos {
		/* margin-top: 0.5rem; */
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
	}

	.section {
		margin-bottom: 0;
	}

	.section h3 {
		margin-bottom: 0.5rem;
		color: #333;
	}

	.section ul {
		list-style: none;
		padding: 0;
	}

	.section li {
		padding: 0.5rem 0;
	}

	.section label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		width: 100%;
	}

	.section input[type='checkbox'] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.item-text {
		flex: 1;
		word-break: break-all;
	}

	.inline-link {
		color: #0066cc;
		text-decoration: underline;
	}

	.inline-link:hover {
		color: #0052a3;
	}

	.item-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	.move-button {
		margin: 0;
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;
		min-width: 32px;
		flex-shrink: 0;
	}

	.move-button:disabled {
		background-color: #ccc;
		cursor: not-allowed;
		opacity: 0.5;
	}

	.remove-item-button {
		margin: 0;
		margin-left: auto;
		padding: 0.125rem 0.5rem;
		font-size: 1rem;
		min-width: 24px;
		background-color: transparent;
		color: #ffb3b3;
		border: none;
		cursor: pointer;
		flex-shrink: 0;
		transition: all 0.2s ease;
	}

	.remove-item-button:hover {
		color: #ff8080;
		transform: scale(1.2);
		background-color: transparent;
	}
</style>
