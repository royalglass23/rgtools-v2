ALTER TABLE "work_order_events"
  ADD COLUMN IF NOT EXISTS "work_order_item_id" uuid;

DO $$ BEGIN
  ALTER TABLE "work_order_events"
    ADD CONSTRAINT "work_order_events_work_order_item_id_work_order_items_id_fk"
    FOREIGN KEY ("work_order_item_id") REFERENCES "public"."work_order_items"("id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "work_order_events_work_order_item_idx"
  ON "work_order_events" USING btree ("work_order_item_id");
