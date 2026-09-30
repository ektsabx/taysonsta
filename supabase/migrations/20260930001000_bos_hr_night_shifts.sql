-- Night shifts cross midnight (end < start). Only night schedules may do so;
-- start and end can never be equal (docs/bos/28 §12).
alter table work_schedules drop constraint work_schedules_check;
alter table work_schedules add constraint work_schedules_check
  check (end_time <> start_time and (end_time > start_time or schedule_type = 'night'));
