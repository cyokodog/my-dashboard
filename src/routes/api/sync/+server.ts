import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Cloudflare Workers KV binding (デプロイ時に自動バインド)
interface Env {
	KV: KVNamespace;
}

const KV_KEYS = {
	TODOS: 'todo-dashboard-data',
	MEMOS: 'memo-dashboard-data',
	NOTES: 'dashboard-notes'
} as const;

// GET: KVからデータを取得
export const GET: RequestHandler = async ({ platform, url }) => {
	const key = url.searchParams.get('key');

	if (!key || !Object.values(KV_KEYS).includes(key)) {
		return json({ error: 'Invalid key parameter' }, { status: 400 });
	}

	try {
		// 開発環境: ダミーデータを返す（KVが使えない）
		if (!platform?.env?.KV) {
			console.log('[DEV] KV not available, returning null');
			return json({ data: null });
		}

		const env = platform.env as Env;
		const data = await env.KV.get(key, 'json');
		return json({ data });
	} catch (error) {
		console.error('Failed to get data from KV:', error);
		return json({ error: 'Failed to get data' }, { status: 500 });
	}
};

// PUT: KVにデータを保存
export const PUT: RequestHandler = async ({ platform, request, url }) => {
	const key = url.searchParams.get('key');

	if (!key || !Object.values(KV_KEYS).includes(key)) {
		return json({ error: 'Invalid key parameter' }, { status: 400 });
	}

	try {
		const body = await request.json();

		// 開発環境: 保存処理をスキップ
		if (!platform?.env?.KV) {
			console.log('[DEV] KV not available, skipping save');
			return json({ success: true });
		}

		const env = platform.env as Env;
		await env.KV.put(key, JSON.stringify(body));
		return json({ success: true });
	} catch (error) {
		console.error('Failed to save data to KV:', error);
		return json({ error: 'Failed to save data' }, { status: 500 });
	}
};
