-- Private shared workspace files for normal company members, separate from sensitive HR/legal documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ks-shared-files','ks-shared-files',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy ks_shared_files_storage_read on storage.objects for select to authenticated
 using(bucket_id='ks-shared-files' and private.ks_has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]));
create policy ks_shared_files_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='ks-shared-files' and private.ks_has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[]));
drop policy if exists ks_shared_files_manager_insert on public.ks_shared_files;
create policy ks_shared_files_member_insert on public.ks_shared_files for insert to authenticated
 with check(private.ks_has_company_role(company_id,array['owner','admin','manager','gerente','cashier','caixa','operator','operador']::text[])
 and (shared_by is null or shared_by=(select auth.uid())));
