CREATE TABLE "category_extra_groups" (
	"category_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	CONSTRAINT "category_extra_groups_category_id_group_id_pk" PRIMARY KEY("category_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "category_groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "category_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_groups_slug_unique" UNIQUE("slug"),
	CONSTRAINT "category_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "category_extra_groups" ADD CONSTRAINT "category_extra_groups_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_extra_groups" ADD CONSTRAINT "category_extra_groups_group_id_category_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."category_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_extra_groups_group_idx" ON "category_extra_groups" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "group";--> statement-breakpoint
DROP TYPE "public"."category_group";