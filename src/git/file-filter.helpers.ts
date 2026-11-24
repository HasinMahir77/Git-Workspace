export function filterByPath<T extends { path: string }>(files: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return files;
  return files.filter((file) => words.every((word) => file.path.toLowerCase().includes(word)));
}
