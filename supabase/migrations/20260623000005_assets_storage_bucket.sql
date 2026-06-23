-- Phase 5: storage bucket for generated assets (images, videos, storyboards).
-- Idempotent. Files are stored under <user_id>/<asset_id>.<ext> so RLS can match the prefix.

insert into storage.buckets (id, name, public)
values ('architecta-assets', 'architecta-assets', false)
on conflict (id) do nothing;

-- Owner-scoped policies on storage.objects for this bucket.
-- We match on the first path segment (folder) equalling auth.uid().

drop policy if exists "architecta_assets_owner_select" on storage.objects;
create policy "architecta_assets_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'architecta-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "architecta_assets_owner_insert" on storage.objects;
create policy "architecta_assets_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'architecta-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "architecta_assets_owner_update" on storage.objects;
create policy "architecta_assets_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'architecta-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'architecta-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "architecta_assets_owner_delete" on storage.objects;
create policy "architecta_assets_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'architecta-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
