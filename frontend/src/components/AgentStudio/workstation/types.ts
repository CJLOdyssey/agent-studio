export interface VersionEntry {
  version: string;
  date: string;
  author: string;
  changes: string;
  content?: string;
}

export type SortDir = 'asc' | 'desc';
