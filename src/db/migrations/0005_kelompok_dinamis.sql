ALTER TABLE "categories" ADD COLUMN "group_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "needs_location" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "info_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_group_id_category_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."category_groups"("id") ON DELETE restrict ON UPDATE no action;