CREATE TYPE "public"."category_group" AS ENUM('service', 'place', 'attraction', 'freelance', 'product');--> statement-breakpoint
CREATE TYPE "public"."listing_source" AS ENUM('team', 'vendor', 'import');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'published', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."location_level" AS ENUM('province', 'city', 'district', 'village', 'landmark');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('per_event', 'per_hour', 'per_day', 'per_visit', 'per_person', 'per_item', 'per_project', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."service_mode" AS ENUM('on_site', 'on_call', 'online');--> statement-breakpoint
CREATE TYPE "public"."verification_level" AS ENUM('unverified', 'contact_checked', 'visited');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"group" "category_group" NOT NULL,
	"description" text,
	"attribute_schema" jsonb,
	"slots" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "glossary_terms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "glossary_terms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"term" text NOT NULL,
	"meaning" text NOT NULL,
	"category_id" integer,
	"need_id" integer,
	"location_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "glossary_terms_term_unique" UNIQUE("term"),
	CONSTRAINT "glossary_terms_single_target" CHECK (num_nonnulls("glossary_terms"."category_id", "glossary_terms"."need_id", "glossary_terms"."location_id") <= 1)
);
--> statement-breakpoint
CREATE TABLE "listing_areas" (
	"listing_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	CONSTRAINT "listing_areas_listing_id_location_id_pk" PRIMARY KEY("listing_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "listing_categories" (
	"listing_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "listing_categories_listing_id_category_id_pk" PRIMARY KEY("listing_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "listing_claims" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "listing_claims_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"listing_id" integer NOT NULL,
	"claimant_id" text NOT NULL,
	"evidence" text,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_media" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "listing_media_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"listing_id" integer NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_revisions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "listing_revisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"listing_id" integer NOT NULL,
	"changes" jsonb NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"submitted_by" text,
	"reviewed_by" text,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "listings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"description" text,
	"address" text,
	"location_id" integer,
	"lat" double precision,
	"lng" double precision,
	"service_modes" "service_mode"[] DEFAULT '{"on_site"}' NOT NULL,
	"whatsapp" text,
	"phone" text,
	"instagram" text,
	"website" text,
	"maps_url" text,
	"price_min" integer,
	"price_max" integer,
	"price_unit" "price_unit",
	"price_note" text,
	"opening_hours" jsonb,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"review_note" text,
	"verification_level" "verification_level" DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"published_at" timestamp with time zone,
	"owner_id" text,
	"created_by" text,
	"source" "listing_source" DEFAULT 'team' NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_slug_unique" UNIQUE("slug"),
	CONSTRAINT "listings_lat_lng_pair" CHECK (("listings"."lat" is null) = ("listings"."lng" is null)),
	CONSTRAINT "listings_price_range" CHECK ("listings"."price_min" is null or "listings"."price_max" is null or "listings"."price_min" <= "listings"."price_max")
);
--> statement-breakpoint
CREATE TABLE "location_aliases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "location_aliases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"location_id" integer NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "locations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"parent_id" integer,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"level" "location_level" NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "locations_lat_lng_pair" CHECK (("locations"."lat" is null) = ("locations"."lng" is null))
);
--> statement-breakpoint
CREATE TABLE "need_categories" (
	"need_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "need_categories_need_id_category_id_pk" PRIMARY KEY("need_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "needs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "needs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slots" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "needs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "glossary_terms" ADD CONSTRAINT "glossary_terms_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glossary_terms" ADD CONSTRAINT "glossary_terms_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glossary_terms" ADD CONSTRAINT "glossary_terms_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_areas" ADD CONSTRAINT "listing_areas_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_areas" ADD CONSTRAINT "listing_areas_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_categories" ADD CONSTRAINT "listing_categories_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_categories" ADD CONSTRAINT "listing_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_claims" ADD CONSTRAINT "listing_claims_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_aliases" ADD CONSTRAINT "location_aliases_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_categories" ADD CONSTRAINT "need_categories_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_categories" ADD CONSTRAINT "need_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "glossary_terms_term_trgm_idx" ON "glossary_terms" USING gin ("term" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "listing_areas_location_idx" ON "listing_areas" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "listing_categories_category_idx" ON "listing_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_categories_one_primary" ON "listing_categories" USING btree ("listing_id") WHERE "listing_categories"."is_primary";--> statement-breakpoint
CREATE INDEX "listing_claims_listing_status_idx" ON "listing_claims" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "listing_media_listing_idx" ON "listing_media" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_revisions_listing_status_idx" ON "listing_revisions" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_location_idx" ON "listings" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "listings_owner_idx" ON "listings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "listings_name_trgm_idx" ON "listings" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "listings_keywords_idx" ON "listings" USING gin ("keywords");--> statement-breakpoint
CREATE INDEX "listings_attributes_idx" ON "listings" USING gin ("attributes");--> statement-breakpoint
CREATE INDEX "listings_earth_idx" ON "listings" USING gist (ll_to_earth(lat, lng));--> statement-breakpoint
CREATE UNIQUE INDEX "location_aliases_unique" ON "location_aliases" USING btree ("location_id","alias");--> statement-breakpoint
CREATE INDEX "location_aliases_alias_trgm_idx" ON "location_aliases" USING gin ("alias" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "locations_parent_idx" ON "locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "locations_name_trgm_idx" ON "locations" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "need_categories_category_idx" ON "need_categories" USING btree ("category_id");