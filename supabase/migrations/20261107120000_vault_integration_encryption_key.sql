-- Generate and store the AES-256-GCM root key in Supabase Vault, not in source or browser config.
do $$
begin
 if not exists(select 1 from vault.decrypted_secrets where name='kanawa_integration_encryption_key') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'base64'),'kanawa_integration_encryption_key','Kanawa Soft company integration credential encryption key');
 end if;
end $$;

create or replace function private.ks_get_integration_encryption_key()
returns text language sql stable security definer set search_path = '' as $$
 select decrypted_secret from vault.decrypted_secrets where name='kanawa_integration_encryption_key' limit 1;
$$;
revoke all on function private.ks_get_integration_encryption_key() from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.ks_get_integration_encryption_key() to service_role;

create or replace function public.ks_get_integration_encryption_key()
returns text language sql stable security invoker set search_path = '' as $$
 select private.ks_get_integration_encryption_key();
$$;
revoke all on function public.ks_get_integration_encryption_key() from public,anon,authenticated;
grant execute on function public.ks_get_integration_encryption_key() to service_role;
