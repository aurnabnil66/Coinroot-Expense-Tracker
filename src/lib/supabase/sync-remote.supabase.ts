import type { RemoteRow, SyncRemote } from '@/lib/db';

import type { CoinrootSupabase } from './client.supabase';

/** A value inside a PostgREST `or=(…)` filter, quoted so `:`, `+`, `,` and `.` stay literal. */
const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * The cloud tables as a `SyncRemote` for `syncLedger`. Row Level Security limits every
 * request to the signed-in user's rows; uploads are upserts on `(user_id, id)`, and the
 * server keeps the newer row (the `sync_row_write` trigger).
 */
export function supabaseSyncRemote(supabase: CoinrootSupabase): SyncRemote {
  return {
    async pull(table, after, limit) {
      let query = supabase
        .from(table)
        .select('*')
        .order('server_updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);
      if (after) {
        // Keyset paging: strictly after (server_updated_at, id).
        query = query.or(
          `server_updated_at.gt.${quoted(after.at)},and(server_updated_at.eq.${quoted(after.at)},id.gt.${quoted(after.id)})`
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RemoteRow[];
    },

    async fetch(table, ids) {
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from(table).select('*').in('id', ids);
      if (error) throw error;
      return (data ?? []) as RemoteRow[];
    },

    async push(table, rows) {
      const { error } = await supabase.from(table).upsert(rows as never, { onConflict: 'user_id,id' });
      if (error) throw error;
    },
  };
}
