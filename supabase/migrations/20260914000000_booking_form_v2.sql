alter table booking_answers drop constraint booking_answers_investment_readiness_check;
alter table booking_answers add constraint booking_answers_investment_readiness_check
  check (investment_readiness in ('ready', 'need_details', 'no_capital'));

alter table booking_answers add column project_type text;
alter table booking_answers add column idea_clarity text;
alter table booking_answers add column validation_stage text;
