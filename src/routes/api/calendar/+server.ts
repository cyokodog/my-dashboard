import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDAVClient } from 'tsdav';
import { env } from '$env/dynamic/private';

interface CalendarEvent {
	summary: string;
	startDate: string;
	endDate: string;
	calendar: string;
}

// CalDAV経由でiCloudカレンダーから取得
async function fetchEventsViaCalDAV(): Promise<CalendarEvent[]> {
	const username = env.ICAL_USERNAME;
	const password = env.ICAL_PASSWORD;
	// ICAL_CALENDAR_NAMESが未設定または空文字列の場合は全カレンダーを対象にする
	const calendarNamesRaw = env.ICAL_CALENDAR_NAMES?.trim();
	const calendarNames = calendarNamesRaw && calendarNamesRaw.length > 0
		? calendarNamesRaw.split(',').map((name: string) => name.trim())
		: [];

	if (!username || !password) {
		throw new Error('ICAL_USERNAME and ICAL_PASSWORD must be set in environment variables');
	}

	const client = await createDAVClient({
		serverUrl: 'https://caldav.icloud.com',
		credentials: {
			username,
			password
		},
		authMethod: 'Basic',
		defaultAccountType: 'caldav'
	});

	// カレンダー一覧を取得
	const calendars = await client.fetchCalendars();
	console.log('All calendars:', calendars.map((cal) => cal.displayName));

	// フィルタ設定がある場合のみフィルタリング
	const targetCalendars = calendarNames.length > 0
		? calendars.filter((cal) =>
				calendarNames.some((name: string) => cal.displayName === name)
		  )
		: calendars;

	console.log('Target calendar names:', calendarNames);
	console.log('Matched calendars:', targetCalendars.map((cal) => cal.displayName));

	const events: CalendarEvent[] = [];
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const endDate = new Date(today);
	endDate.setDate(endDate.getDate() + 30);

	console.log('Today:', today.toISOString());
	console.log('End date:', endDate.toISOString());
	console.log('Target calendars found:', targetCalendars.length);

	for (const calendar of targetCalendars) {
		console.log('Fetching calendar:', calendar.displayName);
		const calendarObjects = await client.fetchCalendarObjects({
			calendar
			// timeRangeは使わず、取得後にフィルタリング
		});

		console.log('Calendar objects found:', calendarObjects.length);

		for (const obj of calendarObjects) {
			if (!obj.data) continue;

			// iCalデータをパース（VEVENTブロックのみ）
			const lines = obj.data.split('\n');
			let summary = '';
			let dtstart = '';
			let dtend = '';
			let inVEvent = false;

			for (const line of lines) {
				const trimmedLine = line.trim();

				if (trimmedLine === 'BEGIN:VEVENT') {
					inVEvent = true;
					summary = '';
					dtstart = '';
					dtend = '';
				} else if (trimmedLine === 'END:VEVENT') {
					inVEvent = false;
					break; // 最初のイベントのみ処理
				} else if (inVEvent) {
					if (trimmedLine.startsWith('SUMMARY:')) {
						summary = trimmedLine.replace('SUMMARY:', '').trim();
					} else if (trimmedLine.startsWith('DTSTART')) {
						// DTSTART;VALUE=DATE:20251024 または DTSTART:20251024T090000Z
						const parts = trimmedLine.split(':');
						dtstart = parts[parts.length - 1]?.trim() || '';
					} else if (trimmedLine.startsWith('DTEND')) {
						const parts = trimmedLine.split(':');
						dtend = parts[parts.length - 1]?.trim() || '';
					}
				}
			}

			console.log('Event found:', summary, dtstart);

			if (summary && dtstart) {
				// 日付フィルタリング（今日から30日以内）
				const eventDate = parseICalDate(dtstart);
				console.log('Event date:', eventDate, 'In range:', eventDate >= today && eventDate <= endDate);
				if (eventDate >= today && eventDate <= endDate) {
					events.push({
						summary,
						startDate: formatICalDate(dtstart),
						endDate: formatICalDate(dtend || dtstart),
						calendar: calendar.displayName || '',
						_sortKey: dtstart // ソート用の元データ
					} as any);
				}
			}
		}
	}

	console.log('Total events after filtering:', events.length);

	// 日時でソート（昇順）
	events.sort((a: any, b: any) => {
		return a._sortKey.localeCompare(b._sortKey);
	});

	// ソート用キーを削除
	events.forEach((event: any) => delete event._sortKey);

	return events;
}

// iCal形式の日付をDateオブジェクトに変換
function parseICalDate(icalDate: string): Date {
	// 20251017T120000Z または 20251017
	if (icalDate.includes('T')) {
		const year = icalDate.slice(0, 4);
		const month = icalDate.slice(4, 6);
		const day = icalDate.slice(6, 8);
		const hour = icalDate.slice(9, 11);
		const minute = icalDate.slice(11, 13);
		const second = icalDate.slice(13, 15);
		return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
	} else {
		const year = icalDate.slice(0, 4);
		const month = icalDate.slice(4, 6);
		const day = icalDate.slice(6, 8);
		return new Date(`${year}-${month}-${day}`);
	}
}

// iCal形式の日付を日本語形式に変換
function formatICalDate(icalDate: string): string {
	// 20251017T120000Z または 20251017T090000（ローカル時刻）または 20251017（終日イベント）
	const year = icalDate.slice(0, 4);
	const month = icalDate.slice(4, 6);
	const day = icalDate.slice(6, 8);

	// 終日イベント（時刻なし）の場合
	if (!icalDate.includes('T')) {
		const date = new Date(`${year}-${month}-${day}`);
		const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
		const weekday = weekdays[date.getDay()];
		return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`;
	}

	// 時刻あり
	const hour = parseInt(icalDate.slice(9, 11));
	const minute = parseInt(icalDate.slice(11, 13));
	const second = parseInt(icalDate.slice(13, 15));

	// Zで終わる場合はUTC、そうでない場合はローカル時刻（Asia/Tokyo）として扱う
	let date: Date;
	if (icalDate.endsWith('Z')) {
		date = new Date(`${year}-${month}-${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`);
	} else {
		// ローカル時刻（Asia/Tokyo）として扱う
		date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour, minute, second);
	}

	const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
	const weekday = weekdays[date.getDay()];

	return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}


export const GET: RequestHandler = async () => {
	console.log('Calendar API called (CalDAV only)');

	try {
		const events = await fetchEventsViaCalDAV();
		return json({ events });
	} catch (error) {
		console.error('Error fetching calendar events:', error);
		return json({ error: 'Failed to fetch calendar events', events: [] }, { status: 500 });
	}
};
