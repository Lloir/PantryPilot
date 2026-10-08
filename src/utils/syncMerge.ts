// Everyone in the household edits the same pantry. When two people save at the same
// time, this merges their changes instead of letting the later save wipe the earlier one.

export interface SyncedState {
  inventory: any[];
  recipes: any[];
  plannedMeals: any[];
  cookedLogs: any[];
  shoppingList: any[];
  purchaseLogs: any[];
  rewards: any[];
  settings: Record<string, any>;
}

const LIST_KEYS = ['inventory', 'recipes', 'plannedMeals', 'cookedLogs', 'shoppingList', 'purchaseLogs', 'rewards'] as const;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Three-way merge by item id.
 *  base   = what this device last saw on the server
 *  local  = what this device has now
 *  server = what the server has now
 * Rule of thumb: if only one side touched an item, that change wins. If both touched
 * the same item, the server (the other person) wins.
 */
function mergeList(base: any[], local: any[], server: any[]): any[] {
  const baseById = new Map(base.map(i => [i.id, i]));
  const serverById = new Map(server.map(i => [i.id, i]));
  const localById = new Map(local.map(i => [i.id, i]));
  const result: any[] = [];

  // Start from the server's list (their order), applying our edits where they didn't touch the item
  for (const s of server) {
    const b = baseById.get(s.id);
    const l = localById.get(s.id);
    if (!b) { result.push(s); continue; } // added by them
    if (!l) {
      // we deleted it: honor that unless they changed it meanwhile
      if (!same(s, b)) result.push(s);
      continue;
    }
    result.push(same(s, b) ? l : s); // only we changed it -> ours; they changed it -> theirs
  }
  // Items we added that the server doesn't know about yet
  for (const l of local) {
    if (!serverById.has(l.id) && !baseById.has(l.id)) result.push(l);
  }
  return result;
}

export function mergeStates(base: SyncedState, local: SyncedState, server: SyncedState): SyncedState {
  const merged: any = {};
  for (const key of LIST_KEYS) {
    merged[key] = mergeList(base[key] ?? [], local[key] ?? [], server[key] ?? []);
  }
  // Settings: keep the server's, plus any key only we changed
  const settings = { ...(server.settings ?? {}) };
  for (const k of Object.keys(local.settings ?? {})) {
    if (!same(local.settings[k], base.settings?.[k]) && same(server.settings?.[k], base.settings?.[k])) {
      settings[k] = local.settings[k];
    }
  }
  merged.settings = settings;
  return merged as SyncedState;
}
