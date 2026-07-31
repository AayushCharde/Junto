/**
 * Render user-authored task descriptions as sanitized HTML. Markdown → HTML via
 * `marked`, then scrubbed with DOMPurify. DOMPurify needs a DOM, so on the server
 * we fall back to escaped plain text — the detail view renders client-side, where
 * the real markdown takes over on hydration.
 */
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { browser } from '$app/environment';

marked.setOptions({ gfm: true, breaks: true });

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\n/g, '<br>');
}

export function renderMarkdown(src: string | null | undefined): string {
	const text = (src ?? '').trim();
	if (!text) return '';
	if (!browser) return escapeHtml(text);
	const html = marked.parse(text, { async: false }) as string;
	return DOMPurify.sanitize(html, {
		USE_PROFILES: { html: true },
		ADD_ATTR: ['target', 'rel']
	});
}
