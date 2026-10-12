ALTER TABLE "listings" ADD COLUMN "photos" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "pending_photos" text[] DEFAULT '{}' NOT NULL;