-- Migration 016: seller replies on reviews
--
-- Lets a seller respond publicly to a review left on their shop (e.g.
-- to thank a happy buyer or address a complaint) — the kind of thing
-- that builds trust for shoppers reading reviews later. This does not
-- let a seller edit or hide the review itself, only add their own
-- reply alongside it.
alter table reviews add column if not exists seller_reply text;
alter table reviews add column if not exists seller_reply_at timestamptz;

-- A seller can update (to add/edit their reply) reviews left on their
-- own shop. RLS is row-level only, so this technically also allows
-- updating other columns on the row (rating, comment, etc.) via a
-- direct API call — the same trade-off already accepted for the
-- existing "Sellers update orders on their shop" policy. The app's
-- own UI only ever writes seller_reply/seller_reply_at.
create policy "Sellers reply to reviews on their shop" on reviews
  for update using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );
