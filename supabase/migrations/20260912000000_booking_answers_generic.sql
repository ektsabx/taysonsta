alter table booking_answers
  alter column gcc_resident drop not null,
  alter column need drop not null,
  alter column revenue_goal drop not null,
  alter column start_timing drop not null,
  alter column decision_maker drop not null,
  alter column investment_readiness drop not null,
  alter column source drop not null,
  add column answers jsonb;
