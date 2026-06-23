CREATE UNIQUE INDEX "clients_phone_normalized_provisional_uq" ON "clients" USING btree ("phone_normalized") WHERE "servicem8_company_uuid" IS NULL;
