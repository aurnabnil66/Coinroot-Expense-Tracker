-- `public.rls_auto_enable()` was created by Supabase's "Enable automatic RLS" project option:
-- the `ensure_rls` event trigger runs it after every DDL command to turn on Row Level Security
-- for new tables in `public`. It's SECURITY DEFINER and, by default, executable by everyone,
-- so the security advisor flags it as callable through the API (`/rest/v1/rpc/rls_auto_enable`).
--
-- Only the event trigger needs it, and Postgres doesn't check EXECUTE when an event trigger
-- fires, so nobody needs to be able to call it directly.
-- Guarded, so a fresh project created without that option still runs this migration.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
