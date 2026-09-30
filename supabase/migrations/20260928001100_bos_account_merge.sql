-- Account merge (§26/§67): moves every record that references the source
-- account onto the target in one transaction, then archives the source.
-- FK columns are discovered from the catalog so tables added later are
-- covered automatically.

create or replace function public.bos_merge_accounts(p_source uuid, p_target uuid, p_actor uuid)
returns jsonb
language plpgsql
as $$
declare
  r record;
  v_count integer;
  v_moved jsonb := '{}'::jsonb;
  v_source clients%rowtype;
begin
  if p_source = p_target then
    raise exception 'Cannot merge an account into itself' using errcode = 'P0001';
  end if;
  select * into v_source from clients where id = p_source for update;
  if not found then
    raise exception 'Source account not found' using errcode = 'P0002';
  end if;
  perform 1 from clients where id = p_target and archived_at is null for update;
  if not found then
    raise exception 'Target account not found or archived' using errcode = 'P0002';
  end if;

  for r in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.confrelid = 'public.clients'::regclass and c.contype = 'f' and array_length(c.conkey, 1) = 1
  loop
    execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using p_target, p_source;
    get diagnostics v_count = row_count;
    if v_count > 0 then
      v_moved := v_moved || jsonb_build_object(r.tbl::text || '.' || r.col, v_count);
    end if;
  end loop;

  -- Polymorphic references (files, comments, timeline links).
  update files set entity_id = p_target where entity_type = 'client' and entity_id = p_source;
  get diagnostics v_count = row_count;
  if v_count > 0 then v_moved := v_moved || jsonb_build_object('files', v_count); end if;
  update comments set entity_id = p_target where entity_type = 'client' and entity_id = p_source;
  insert into activity_event_links (event_id, entity_type, entity_id)
  select event_id, 'client', p_target from activity_event_links where entity_type = 'client' and entity_id = p_source
  on conflict do nothing;

  update clients
     set archived_at = now(), archived_by = p_actor, account_status = 'inactive', primary_contact_id = null,
         notes = concat_ws(E'\n', notes, 'Merged into account ' || p_target::text || ' on ' || now()::date)
   where id = p_source;

  perform bos_audit(p_actor, 'client.merged', 'client', p_target,
    jsonb_build_object('source_id', p_source, 'source_name', v_source.name, 'source_email', v_source.email),
    v_moved, null);
  perform bos_emit('client.merged', 'client', p_target, p_actor, 'Account merged: ' || v_source.name,
    jsonb_build_object('source_id', p_source, 'moved', v_moved), '[]'::jsonb, 'user', 'internal', null);
  return v_moved;
end;
$$;

revoke all on function public.bos_merge_accounts(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.bos_merge_accounts(uuid, uuid, uuid) to service_role;
