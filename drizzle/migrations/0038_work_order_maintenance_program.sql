ALTER TABLE "work_orders"
  ADD COLUMN IF NOT EXISTS "maintenance_program" boolean DEFAULT false NOT NULL;
