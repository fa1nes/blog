import { getCollection, type CollectionEntry } from 'astro:content';
import { getYear } from '~/lib/format';

export type Note = CollectionEntry<'notes'>;

/** 全部动态，按时间倒序；草稿只在开发模式可见 */
export async function getNotes(): Promise<Note[]> {
  const notes = await getCollection('notes', ({ data }) => import.meta.env.DEV || !data.draft);
  return notes.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export interface NoteYearGroup {
  year: number;
  notes: Note[];
}

export function groupNotesByYear(notes: Note[]): NoteYearGroup[] {
  const map = new Map<number, Note[]>();
  for (const note of notes) {
    const year = getYear(note.data.pubDate);
    const bucket = map.get(year);
    if (bucket) bucket.push(note);
    else map.set(year, [note]);
  }
  return [...map.entries()]
    .map(([year, list]) => ({ year, notes: list }))
    .sort((a, b) => b.year - a.year);
}
