// What a client user may do inside their own site. The server is the source of
// truth: the UI only hides what the API refuses.
export const permissions = {
  content: 'Editează conținutul site-ului',
  media: 'Bibliotecă media (încărcare și ștergere)',
  stats: 'Statistici și rapoarte',
  notes: 'Notițe către echipă',
  access: 'Accesul contului (recuperare, deconectare)',
} as const;
export type Permission = keyof typeof permissions;
export const permissionIds = Object.keys(permissions) as Permission[];

// A preset fills the checkboxes; the admin can still change any of them.
export const presets = {
  admin: {
    label: 'Administrator',
    description: 'Poate face tot în site-ul lui.',
    permissions: ['content', 'media', 'stats', 'notes', 'access'],
  },
  editor: {
    label: 'Editor',
    description: 'Publică texte, poze și vede rezultatele.',
    permissions: ['content', 'media', 'stats'],
  },
  viewer: {
    label: 'Doar citire',
    description: 'Vede statisticile, fără să modifice nimic.',
    permissions: ['stats'],
  },
} as const;
export type PresetId = keyof typeof presets;
export const presetIds = Object.keys(presets) as PresetId[];

export const allPermissions = permissionIds;

// Unknown or missing values fall back to the preset that matches the role, so an
// existing account keeps working exactly as before the permissions existed.
export function storedPermissions(value: unknown): Permission[] {
  if (typeof value !== 'string' || !value) return [...allPermissions];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [...allPermissions];
    const kept = permissionIds.filter((id) => parsed.includes(id));
    return kept;
  } catch {
    return [...allPermissions];
  }
}

// The API accepts an array; anything unknown is dropped instead of trusted.
export function readPermissions(
  value: unknown,
  fallback: readonly Permission[],
): Permission[] {
  if (!Array.isArray(value)) return [...fallback];
  return permissionIds.filter((id) => value.includes(id));
}

export function presetFor(value: readonly Permission[]): PresetId | 'custom' {
  const key = [...value].sort().join(',');
  for (const id of presetIds)
    if ([...presets[id].permissions].sort().join(',') === key) return id;
  return 'custom';
}

export const can = (granted: readonly Permission[], id: Permission) =>
  granted.includes(id);
