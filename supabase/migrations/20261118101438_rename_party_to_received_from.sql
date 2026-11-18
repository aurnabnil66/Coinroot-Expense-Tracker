-- "Received from" (who paid, on income) was stored as `party`; the name now matches the app's
-- label and the phone's column (`received_from`, `receivedFrom` in code). A rename keeps the
-- data, the row-level security policies and the grants (they're per table, not per column).
alter table public.transactions rename column party to received_from;
