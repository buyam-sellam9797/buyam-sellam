-- The seller dashboard now shows exactly what was ordered (which
-- product, how many) instead of just an amount and a phone number.
-- That data lives in order_items, which had row-level security turned
-- on but no policy letting a seller read it — so without this, every
-- seller's order list would silently show zero items. This mirrors
-- the existing "Sellers view orders on their shop" policy on orders.
create policy "Sellers view order items for their own orders" on order_items
  for select using (
    order_id in (
      select id from orders where shop_id in (
        select id from shops where owner_id = auth.uid()
      )
    )
  );
