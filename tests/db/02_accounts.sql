-- Accounts: email dedupe, merge moves every related record, portal/contact
-- edge cases (docs/bos/11-clients.md testing requirements).
-- Runs inside a transaction that is always rolled back.
\set ON_ERROR_STOP on
begin;

do $$
declare
  v_a uuid;
  v_b uuid;
  v_ct_a uuid;
  v_ct_b uuid;
  v_deal uuid;
  v_moved jsonb;
  v_dup_blocked boolean := false;
begin
  insert into clients (name, company_name, email) values ('Merge Source', 'Acme Dup', 'SOURCE@merge.test') returning id into v_a;
  insert into clients (name, company_name, email) values ('Merge Target', 'Acme', 'target@merge.test') returning id into v_b;

  -- Normalized email uniqueness (case/whitespace-insensitive).
  begin
    insert into clients (name, email) values ('Dup', '  source@MERGE.test ');
  exception when unique_violation then
    v_dup_blocked := true;
  end;
  assert v_dup_blocked, 'duplicate account email must be rejected';

  insert into contacts (client_id, full_name, email) values (v_a, 'Src Person', 'p1@merge.test') returning id into v_ct_a;
  insert into contacts (client_id, full_name, email) values (v_b, 'Tgt Person', 'p2@merge.test') returning id into v_ct_b;
  update clients set primary_contact_id = v_ct_a where id = v_a;

  insert into deals (name, client_id, contact_id, pipeline_id, stage_id, value, currency)
  select 'Merge deal', v_a, v_ct_a, p.id, s.id, 1000, 'USD'
  from pipelines p join pipeline_stages s on s.pipeline_id = p.id and s.category = 'open'
  where p.entity = 'deal' order by s.sort_order limit 1
  returning id into v_deal;
  insert into activities (type, title, client_id) values ('note', 'Source note', v_a);
  insert into files (storage_path, name, entity_type, entity_id) values ('test/merge-' || v_a || '.txt', 'merge.txt', 'client', v_a);
  perform bos_emit('test.event', 'client', v_a, null, 'Event on source');

  v_moved := bos_merge_accounts(v_a, v_b, null);

  assert (select count(*) from contacts where client_id = v_b) = 2, 'contacts moved';
  assert (select client_id from deals where id = v_deal) = v_b, 'deal moved';
  assert (select count(*) from activities where client_id = v_b and title = 'Source note') = 1, 'activity moved';
  assert (select entity_id from files where name = 'merge.txt') = v_b, 'file moved';
  assert exists (select 1 from activity_event_links l join activity_events e on e.id = l.event_id where l.entity_type = 'client' and l.entity_id = v_b and e.summary = 'Event on source'), 'timeline links copied';
  assert (select archived_at is not null and primary_contact_id is null from clients where id = v_a), 'source archived';
  assert (v_moved ->> 'deals.client_id')::int = 1, format('moved summary: %s', v_moved);
  assert exists (select 1 from audit_logs where action = 'client.merged' and entity_id = v_b), 'merge audited';

  -- Self-merge and merging into an archived account are refused.
  begin
    perform bos_merge_accounts(v_b, v_b, null);
    assert false, 'self merge must fail';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform bos_merge_accounts(v_b, v_a, null);
    assert false, 'merge into archived must fail';
  exception when sqlstate 'P0002' then null;
  end;

  -- Once the source is archived its email can be reused by a new account.
  insert into clients (name, email) values ('Reuse', 'source@merge.test');

  raise notice 'accounts merge: OK';
end;
$$;

rollback;
