-- Waitlist entries may now be identified by an email alone (guests who
-- leave only an email get the automatic back-in-stock email).
alter table public.restock_requests drop constraint if exists restock_requests_identifiable;
alter table public.restock_requests add constraint restock_requests_identifiable
  check (buyer_id is not null or contact_phone is not null or contact_email is not null);
