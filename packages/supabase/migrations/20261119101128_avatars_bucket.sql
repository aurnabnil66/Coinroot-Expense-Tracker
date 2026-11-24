-- Profile photos in Supabase Storage.
--
-- The app crops and shrinks every photo on the phone to a 512 px JPEG (typically 30–80 KB)
-- before uploading, so this stays tiny on the free plan. The server enforces the limits too:
-- * the bucket is private, accepts only JPEG, and refuses files over 1 MB;
-- * each signed-in user can only reach one exact file, `<their user id>/avatar.jpg`, so an
--   account can never store more than one photo (uploads overwrite it).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- `(select auth.uid())` is evaluated once per query instead of once per row.
create policy "Read own profile photo" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.jpg');

create policy "Add own profile photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.jpg');

create policy "Replace own profile photo" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.jpg')
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.jpg');

create policy "Delete own profile photo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar.jpg');
