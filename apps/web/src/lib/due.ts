/** Helpers for the `due_date` (YYYY-MM-DD) field. */

function atMidnight(dateStr: string): Date {
	return new Date(`${dateStr}T00:00:00`);
}

function today(): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}

export function isOverdue(due: string | null): boolean {
	if (!due) return false;
	return atMidnight(due) < today();
}

export function formatDue(due: string): string {
	const d = atMidnight(due);
	const diff = Math.round((d.getTime() - today().getTime()) / 86_400_000);
	if (diff === 0) return 'Today';
	if (diff === 1) return 'Tomorrow';
	if (diff === -1) return 'Yesterday';
	return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
