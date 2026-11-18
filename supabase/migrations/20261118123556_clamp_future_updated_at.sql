-- Last write wins by `updated_at`, which each phone stamps with its own clock. A phone whose
-- clock runs ahead would otherwise win every conflict until real time caught up, and block
-- newer edits from other phones meanwhile. So an `updated_at` more than a minute in the
-- server's future is replaced with the server's time before the comparison.
--
-- The app reads back the stored `updated_at` of each row it uploads (upsert ... returning) and
-- adopts it, so a clamped row isn't uploaded again. Rows skipped as stale (`return null`)
-- aren't returned, so the app knows they lost and the next pull brings the winning version.
--
-- Still a trade-off: a phone whose clock runs slow loses ties, since its edits look older.
create or replace function public.sync_row_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at > clock_timestamp() + interval '1 minute' then
    new.updated_at := clock_timestamp();
  end if;
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- older edit: keep the stored row
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- `create or replace` keeps the grants, but restate them so the function stays uncallable.
revoke execute on function public.sync_row_write() from public, anon, authenticated;
