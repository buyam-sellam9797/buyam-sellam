-- Security hardening after the Sept 2026 audit.

-- 1. A suspended shop stays suspended: only the server (admin) can
--    change is_active. One shop per owner.
create or replace function public.protect_shop_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_service_request() then return new; end if;
  if tg_op = 'INSERT' then
    new.is_verified := false;
    new.identity_verification_status := 'none';
    new.identity_verification_session_id := null;
    new.identity_verified_at := null;
    new.verification_rejected_reason := null;
    new.view_count := 0;
    new.signature_status := 'none';
    new.signature_kind := null;
    new.signature_story := null;
    new.signature_founder := null;
    new.signature_founded_year := null;
    new.signature_audience := null;
    new.signature_proof_url := null;
    new.made_in_cameroon := false;
    new.signature_applied_at := null;
    new.signature_reviewed_at := null;
    new.signature_note := null;
  else
    new.owner_id := old.owner_id;
    new.is_active := old.is_active;
    new.is_verified := old.is_verified;
    new.identity_verification_status := old.identity_verification_status;
    new.identity_verification_session_id := old.identity_verification_session_id;
    new.identity_verified_at := old.identity_verified_at;
    new.verification_rejected_reason := old.verification_rejected_reason;
    new.view_count := old.view_count;
    new.last_drop_email_at := old.last_drop_email_at;
    new.signature_status := old.signature_status;
    new.signature_kind := old.signature_kind;
    new.signature_story := old.signature_story;
    new.signature_founder := old.signature_founder;
    new.signature_founded_year := old.signature_founded_year;
    new.signature_audience := old.signature_audience;
    new.signature_proof_url := old.signature_proof_url;
    new.made_in_cameroon := old.made_in_cameroon;
    new.signature_applied_at := old.signature_applied_at;
    new.signature_reviewed_at := old.signature_reviewed_at;
    new.signature_note := old.signature_note;
  end if;
  return new;
end $$;

create unique index if not exists shops_one_per_owner on public.shops(owner_id);

alter function public.protect_profile_role() set search_path = public;
alter function public.is_service_request() set search_path = public;

-- 2. Reviews are only written by the server (after a completed order).
--    Sellers may only add their reply, never change ratings.
drop policy if exists "Buyers write reviews on their own completed orders" on public.reviews;

create or replace function public.protect_review_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_service_request() then return new; end if;
  if new.seller_reply is distinct from old.seller_reply then
    new.seller_reply_at := now();
  else
    new.seller_reply_at := old.seller_reply_at;
  end if;
  new.order_id := old.order_id;
  new.shop_id := old.shop_id;
  new.buyer_id := old.buyer_id;
  new.buyer_phone := old.buyer_phone;
  new.rating := old.rating;
  new.product_rating := old.product_rating;
  new.seller_rating := old.seller_rating;
  new.delivery_rating := old.delivery_rating;
  new.comment := old.comment;
  new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists protect_review_columns on public.reviews;
create trigger protect_review_columns before update on public.reviews
  for each row execute function public.protect_review_columns();

-- 3. Chat threads: participants can only reset their unread counters.
create or replace function public.protect_conversation_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_service_request() or current_user <> 'authenticated' then return new; end if;
  new.shop_id := old.shop_id;
  new.buyer_id := old.buyer_id;
  new.product_id := old.product_id;
  new.last_message_at := old.last_message_at;
  new.last_message_preview := old.last_message_preview;
  new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists protect_conversation_columns on public.conversations;
create trigger protect_conversation_columns before update on public.conversations
  for each row execute function public.protect_conversation_columns();

-- 4. Seller notifications: only "read" can change.
create or replace function public.protect_notification_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_service_request() then return new; end if;
  new.shop_id := old.shop_id;
  new.type := old.type;
  new.title := old.title;
  new.body := old.body;
  new.order_id := old.order_id;
  new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists protect_notification_columns on public.notifications;
create trigger protect_notification_columns before update on public.notifications
  for each row execute function public.protect_notification_columns();

-- 5. Uploads: only real images (and voice notes / PDFs where used).
update storage.buckets set
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac','audio/x-m4a','audio/wav'],
  file_size_limit = 15728640
where id = 'product-images';
update storage.buckets set
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'],
  file_size_limit = 10485760
where id = 'dispute-evidence';
update storage.buckets set
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'],
  file_size_limit = 15728640
where id = 'verification-documents';

-- 6. Take stock atomically (no overselling under concurrent payments).
create or replace function public.take_stock(p_product uuid, p_qty int)
returns table(before_qty int, after_qty int)
language plpgsql security definer set search_path = public as $$
declare v_before int;
begin
  select stock_quantity into v_before from products where id = p_product for update;
  if not found then return; end if;
  update products set stock_quantity = greatest(v_before - p_qty, 0) where id = p_product;
  return query select v_before, greatest(v_before - p_qty, 0);
end $$;
revoke execute on function public.take_stock(uuid, int) from public, anon, authenticated;

-- 7. Delivery-code check with a locked attempt counter (no brute force
--    by firing many requests at once).
create or replace function public.check_handover_code(p_order uuid, p_code text, p_max int)
returns text language plpgsql security definer set search_path = public as $$
declare v order_secrets%rowtype;
begin
  select * into v from order_secrets where order_id = p_order for update;
  if not found then return 'missing'; end if;
  if v.handover_attempts >= p_max then return 'locked'; end if;
  if v.delivery_code = p_code then return 'ok'; end if;
  update order_secrets set handover_attempts = handover_attempts + 1 where order_id = p_order;
  if v.handover_attempts + 1 >= p_max then return 'locked'; end if;
  return 'wrong:' || (p_max - v.handover_attempts - 1)::text;
end $$;
revoke execute on function public.check_handover_code(uuid, text, int) from public, anon, authenticated;
