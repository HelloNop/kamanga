ALTER TABLE "wa_otps" ADD COLUMN "ip_hash" text;--> statement-breakpoint
CREATE INDEX "wa_otps_ip_hash_idx" ON "wa_otps" USING btree ("ip_hash","created_at");