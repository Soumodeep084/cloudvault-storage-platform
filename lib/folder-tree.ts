export function buildChildrenMap(
  folders: Array<{ id: string; parentId: string | null }>,
) {
  const map = new Map<string | null, string[]>();
  for (const folder of folders) {
    const key = folder.parentId ?? null;
    const entry = map.get(key) ?? [];
    entry.push(folder.id);
    map.set(key, entry);
  }
  return map;
}

export function collectDescendants(
  rootId: string,
  childrenMap: Map<string | null, string[]>,
) {
  const stack = [rootId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const children = childrenMap.get(current) ?? [];
    for (const child of children) {
      if (!visited.has(child)) {
        stack.push(child);
      }
    }
  }

  return Array.from(visited);
}

export function isDescendantFolder(
  folderId: string | null,
  rootId: string,
  parentMap: Map<string, string | null>,
) {
  let current = folderId;
  const visited = new Set<string>();

  while (current) {
    if (current === rootId) return true;
    if (visited.has(current)) break;
    visited.add(current);
    current = parentMap.get(current) ?? null;
  }

  return false;
}

export function buildFolderPathMap(
  folders: Array<{ id: string; parentId: string | null; name: string }>,
  rootId: string,
) {
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const resolved = new Map<string, string>();
  const resolving = new Set<string>();
  const rootName = folderMap.get(rootId)?.name ?? "folder";

  const resolve = (folderId: string): string => {
    if (resolved.has(folderId)) return resolved.get(folderId) as string;
    if (resolving.has(folderId)) return rootName;
    const folder = folderMap.get(folderId);
    if (!folder) return rootName;
    resolving.add(folderId);
    const parentPath = folder.parentId ? resolve(folder.parentId) : rootName;
    const nextPath = folder.parentId ? `${parentPath}/${folder.name}` : rootName;
    resolving.delete(folderId);
    resolved.set(folderId, nextPath);
    return nextPath;
  };

  for (const folder of folders) {
    if (!resolved.has(folder.id)) {
      resolve(folder.id);
    }
  }

  return resolved;
}
