<script lang="ts">
	import { onMount } from 'svelte';

	interface CalendarEvent {
		summary: string;
		startDate: string;
		endDate: string;
		calendar: string;
	}

	interface TodoSection {
		heading: string;
		items: TodoItem[];
	}

	interface TodoItem {
		text: string;
		id: string;
		checked: boolean;
	}

	interface Props {
		onMoveToTodo?: (text: string) => void;
		targetSections?: TodoSection[];
	}

	let { onMoveToTodo, targetSections = [] }: Props = $props();

	let events: CalendarEvent[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let alreadyFetched = $state(false);

	const parseDate = (dateStr: string): Date | null => {
		// 時刻付き: "2025年10月17日 金曜日 12:00:00"
		const matchWithTime = dateStr.match(/(\d+)年(\d+)月(\d+)日 .曜日 (\d+):(\d+):(\d+)/);
		if (matchWithTime) {
			const [, year, month, day, hour, minute, second] = matchWithTime;
			return new Date(
				parseInt(year),
				parseInt(month) - 1,
				parseInt(day),
				parseInt(hour),
				parseInt(minute),
				parseInt(second)
			);
		}

		// 終日イベント: "2025年10月20日 月曜日"
		const matchNoTime = dateStr.match(/(\d+)年(\d+)月(\d+)日 .曜日/);
		if (matchNoTime) {
			const [, year, month, day] = matchNoTime;
			return new Date(
				parseInt(year),
				parseInt(month) - 1,
				parseInt(day)
			);
		}

		return null;
	};

	const formatDate = (dateStr: string): string => {
		// "2025年10月17日 金曜日 12:00:00" または "2025年10月20日 月曜日"（終日イベント）
		const matchWithTime = dateStr.match(/(\d+)年(\d+)月(\d+)日 (.曜日) (\d+):(\d+):\d+/);
		if (matchWithTime) {
			const [, , month, day, weekday, hour, minute] = matchWithTime;
			const weekdayShort = weekday.charAt(0); // 金曜日 -> 金
			return `${month}/${day}${weekdayShort}${hour}:${minute}`;
		}

		// 終日イベント（時刻なし）
		const matchNoTime = dateStr.match(/(\d+)年(\d+)月(\d+)日 (.曜日)/);
		if (matchNoTime) {
			const [, , month, day, weekday] = matchNoTime;
			const weekdayShort = weekday.charAt(0); // 月曜日 -> 月
			return `${month}/${day}${weekdayShort}`;
		}

		return dateStr;
	};

	const formatEventWithDate = (event: CalendarEvent): string => {
		return `${formatDate(event.startDate)}${event.summary}`;
	};

	const isToday = (dateStr: string): boolean => {
		const eventDate = parseDate(dateStr);
		if (!eventDate) return false;

		const today = new Date();
		return (
			eventDate.getFullYear() === today.getFullYear() &&
			eventDate.getMonth() === today.getMonth() &&
			eventDate.getDate() === today.getDate()
		);
	};

	const isItemInTarget = (text: string): boolean => {
		return targetSections.some((section: TodoSection) => section.items.some((item: TodoItem) => item.text === text));
	};

	const STORAGE_KEY_DATE = 'calendar-last-fetch';
	const STORAGE_KEY_EVENTS = 'calendar-events-cache';

	const getTodayKey = (): string => {
		const today = new Date();
		return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
	};

	const shouldFetch = (): boolean => {
		if (typeof window === 'undefined') return true;
		const lastFetch = localStorage.getItem(STORAGE_KEY_DATE);
		return lastFetch !== getTodayKey();
	};

	const markFetched = () => {
		if (typeof window === 'undefined') return;
		localStorage.setItem(STORAGE_KEY_DATE, getTodayKey());
	};

	const loadCachedEvents = (): CalendarEvent[] | null => {
		if (typeof window === 'undefined') return null;
		const cached = localStorage.getItem(STORAGE_KEY_EVENTS);
		if (!cached) return null;
		try {
			return JSON.parse(cached);
		} catch {
			return null;
		}
	};

	const saveCachedEvents = (event: CalendarEvent[]) => {
		if (typeof window === 'undefined') return;
		localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(event));
	};

	const fetchCalendarEvents = async (forceUpdate = false) => {
		try {
			loading = true;
			alreadyFetched = false;
			const response = await fetch('/api/calendar');
			const data = await response.json();

			if (data.error) {
				error = data.error;
			} else {
				// 日付の昇順（古い順）にソート
				const sortedEvents = (data.events || []).sort((a: CalendarEvent, b: CalendarEvent) => {
					const dateA = parseDate(a.startDate);
					const dateB = parseDate(b.startDate);
					if (!dateA || !dateB) return 0;
					return dateA.getTime() - dateB.getTime();
				});
				events = sortedEvents;
				saveCachedEvents(sortedEvents);
				markFetched();
			}
		} catch (err) {
			error = 'カレンダーイベントの取得に失敗しました';
			console.error(err);
		} finally {
			loading = false;
		}
	};

	const handleRefresh = () => {
		fetchCalendarEvents(true);
	};

	const handleVisibilityChange = () => {
		if (!document.hidden && shouldFetch()) {
			fetchCalendarEvents();
		}
	};

	onMount(() => {
		// キャッシュがあればまず表示
		const cached = loadCachedEvents();
		if (cached) {
			events = cached;
			loading = false;
		}

		// 初回読み込み時に取得するかチェック
		if (shouldFetch()) {
			// 当日まだ取得していないので取得
			fetchCalendarEvents();
		} else {
			// 当日既に取得済み
			alreadyFetched = true;
			loading = false;
		}

		// タブがアクティブになったときの処理
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});
</script>

<div class="calendar-events">
	<div class="header">
		<h2>直近のイベント</h2>
		<button class="refresh-button" onclick={handleRefresh} disabled={loading} title="更新">
			🔄
		</button>
	</div>

	{#if loading}
		<p class="loading">読み込み中...</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else if events.length === 0}
		<p class="empty">今後1ヶ月のイベントはありません</p>
	{:else}
		<div class="events-list">
			{#each events as event}
				<div class="event-item" class:today={isToday(event.startDate)}>
					{#if onMoveToTodo}
						<button
							class="move-button"
							onclick={() => onMoveToTodo?.(formatEventWithDate(event))}
							disabled={isItemInTarget(formatEventWithDate(event))}
							title="本日のタスクに追加"
						>
							+
						</button>
					{/if}
					<span class="event-text">
						{formatDate(event.startDate)}{event.summary}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.calendar-events {
		padding: 1.5rem;
		background-color: #fff;
		border: 1px solid #ddd;
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	h2 {
		margin: 0;
		color: #333;
		font-size: 1.2rem;
	}

	.refresh-button {
		margin: 0;
		padding: 0.25rem 0.5rem;
		font-size: 1rem;
		min-width: 32px;
		background-color: transparent;
		color: #666;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.refresh-button:hover:not(:disabled) {
		color: #333;
		transform: rotate(180deg);
	}

	.refresh-button:disabled {
		color: #ccc;
		cursor: not-allowed;
		opacity: 0.5;
	}

	.loading,
	.error,
	.empty {
		color: #666;
		font-size: 0.9rem;
	}

	.error {
		color: #dc3545;
	}

	.events-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: stretch;
	}

	.event-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.9rem;
		color: #333;
		white-space: nowrap;
		min-width: 250px;
	}

	.event-item.today {
		font-weight: bold;
		color: #0066cc;
	}

	.event-text {
		flex: 1;
	}

	.move-button {
		margin: 0;
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;
		min-width: 32px;
		flex-shrink: 0;
		background-color: #0066cc;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.move-button:hover:not(:disabled) {
		background-color: #0052a3;
	}

	.move-button:disabled {
		background-color: #ccc;
		cursor: not-allowed;
		opacity: 0.5;
	}
</style>
