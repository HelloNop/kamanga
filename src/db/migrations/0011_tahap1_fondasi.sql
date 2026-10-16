CREATE TYPE "public"."booking_actor" AS ENUM('citizen', 'provider', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('sent', 'accepted', 'in_progress', 'completed', 'rejected', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."door_kind" AS ENUM('single', 'plan', 'guide');--> statement-breakpoint
CREATE TYPE "public"."door_status" AS ENUM('active', 'soon', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."listing_kind" AS ENUM('provider', 'place');--> statement-breakpoint
CREATE TYPE "public"."qa_source" AS ENUM('provider', 'citizen');--> statement-breakpoint
CREATE TYPE "public"."schedule_kind" AS ENUM('slot', 'seat', 'date_stock', 'survey', 'none');--> statement-breakpoint
CREATE TYPE "public"."slot_block_reason" AS ENUM('walk_in', 'whatsapp', 'other');--> statement-breakpoint
CREATE TYPE "public"."wa_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."wa_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'link');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_contacts" (
	"booking_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booking_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"booking_id" integer NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"actor" "booking_actor" NOT NULL,
	"actor_user_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bookings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"citizen_id" text,
	"listing_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"unit_id" integer,
	"status" "booking_status" DEFAULT 'sent' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"seats" integer DEFAULT 1 NOT NULL,
	"exclusive" boolean DEFAULT true NOT NULL,
	"district_id" integer,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rules_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price" integer,
	"respond_by" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"provider_reminded_at" timestamp with time zone,
	"review_requested_at" timestamp with time zone,
	"admin_note" text,
	"provider_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_code_unique" UNIQUE("code"),
	CONSTRAINT "bookings_providerTokenHash_unique" UNIQUE("provider_token_hash"),
	CONSTRAINT "bookings_time_pair" CHECK (("bookings"."starts_at" is null) = ("bookings"."ends_at" is null)),
	CONSTRAINT "bookings_time_range" CHECK ("bookings"."starts_at" is null or "bookings"."starts_at" < "bookings"."ends_at"),
	CONSTRAINT "bookings_seats" CHECK ("bookings"."seats" >= 1),
	CONSTRAINT "bookings_unit_has_time" CHECK ("bookings"."unit_id" is null or "bookings"."starts_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "doors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"description" text,
	"rotating_text" text,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "door_status" DEFAULT 'hidden' NOT NULL,
	"kind" "door_kind" DEFAULT 'single' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "listing_daily_stats" (
	"listing_id" integer NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"wa_clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "listing_daily_stats_listing_id_day_pk" PRIMARY KEY("listing_id","day")
);
--> statement-breakpoint
CREATE TABLE "listing_qa" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "listing_qa_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"listing_id" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"source" "qa_source" DEFAULT 'provider' NOT NULL,
	"asked_by" text,
	"chat_session_id" uuid,
	"answered_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"booking_id" integer NOT NULL,
	"listing_id" integer NOT NULL,
	"citizen_id" text,
	"satisfied" boolean NOT NULL,
	"stars" smallint,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_bookingId_unique" UNIQUE("booking_id"),
	CONSTRAINT "reviews_stars" CHECK ("reviews"."stars" is null or "reviews"."stars" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "saved_addresses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "saved_addresses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"location_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_addresses_lat_lng_pair" CHECK (("saved_addresses"."lat" is null) = ("saved_addresses"."lng" is null))
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "schedule_exceptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"listing_id" integer NOT NULL,
	"unit_id" integer,
	"date" date NOT NULL,
	"is_closed" boolean DEFAULT true NOT NULL,
	"start_time" time,
	"end_time" time,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_exceptions_hours" CHECK ("schedule_exceptions"."is_closed" or ("schedule_exceptions"."start_time" is not null and "schedule_exceptions"."end_time" is not null))
);
--> statement-breakpoint
CREATE TABLE "schedule_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "schedule_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"unit_id" integer NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"slot_minutes" integer DEFAULT 60 NOT NULL,
	"gap_minutes" integer DEFAULT 0 NOT NULL,
	"min_minutes" integer,
	"price" integer,
	"peak_price" integer,
	"peak_start" time,
	"peak_end" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_rules_weekday" CHECK ("schedule_rules"."weekday" between 0 and 6),
	CONSTRAINT "schedule_rules_slot" CHECK ("schedule_rules"."slot_minutes" > 0 and "schedule_rules"."gap_minutes" >= 0),
	CONSTRAINT "schedule_rules_peak_pair" CHECK (("schedule_rules"."peak_start" is null) = ("schedule_rules"."peak_end" is null))
);
--> statement-breakpoint
CREATE TABLE "slot_blocks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "slot_blocks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"unit_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" "slot_block_reason" DEFAULT 'other' NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_blocks_range" CHECK ("slot_blocks"."starts_at" < "slot_blocks"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "units_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"listing_id" integer NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"origin_location_id" integer,
	"destination_location_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_capacity" CHECK ("units"."capacity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "wa_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wa_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"direction" "wa_direction" NOT NULL,
	"template" text,
	"phone" text NOT NULL,
	"status" "wa_status" DEFAULT 'queued' NOT NULL,
	"mode" text NOT NULL,
	"booking_id" integer,
	"provider_message_id" text,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_messages_providerMessageId_unique" UNIQUE("provider_message_id")
);
--> statement-breakpoint
CREATE TABLE "wa_otps" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wa_otps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "door_id" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "schedule_kind" "schedule_kind" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "response_minutes" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "kind" "listing_kind" DEFAULT 'provider' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "point" geography(Point, 4326) GENERATED ALWAYS AS (case when lat is not null and lng is not null then st_setsrid(st_makepoint(lng, lat), 4326)::geography end) STORED;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "point_is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "service_radius_km" double precision;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "official_code" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "center" geography(Point, 4326) GENERATED ALWAYS AS (case when lat is not null and lng is not null then st_setsrid(st_makepoint(lng, lat), 4326)::geography end) STORED;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "boundary" geography(MultiPolygon, 4326);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone_number_verified" boolean;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "privacy_consent_at" timestamp;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_contacts" ADD CONSTRAINT "booking_contacts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_citizen_id_user_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_district_id_locations_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_daily_stats" ADD CONSTRAINT "listing_daily_stats_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_qa" ADD CONSTRAINT "listing_qa_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_qa" ADD CONSTRAINT "listing_qa_asked_by_user_id_fk" FOREIGN KEY ("asked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_qa" ADD CONSTRAINT "listing_qa_chat_session_id_chat_sessions_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_citizen_id_user_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_addresses" ADD CONSTRAINT "saved_addresses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_addresses" ADD CONSTRAINT "saved_addresses_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_blocks" ADD CONSTRAINT "slot_blocks_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_blocks" ADD CONSTRAINT "slot_blocks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_origin_location_id_locations_id_fk" FOREIGN KEY ("origin_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_destination_location_id_locations_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_listing_status_idx" ON "bookings" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "bookings_citizen_idx" ON "bookings" USING btree ("citizen_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_status_respond_idx" ON "bookings" USING btree ("status","respond_by");--> statement-breakpoint
CREATE INDEX "bookings_unit_time_idx" ON "bookings" USING btree ("unit_id","starts_at");--> statement-breakpoint
CREATE INDEX "listing_qa_listing_idx" ON "listing_qa" USING btree ("listing_id","sort_order");--> statement-breakpoint
CREATE INDEX "reviews_listing_idx" ON "reviews" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_addresses_user_idx" ON "saved_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "schedule_exceptions_listing_date_idx" ON "schedule_exceptions" USING btree ("listing_id","date");--> statement-breakpoint
CREATE INDEX "schedule_rules_unit_idx" ON "schedule_rules" USING btree ("unit_id","weekday");--> statement-breakpoint
CREATE INDEX "slot_blocks_unit_idx" ON "slot_blocks" USING btree ("unit_id","starts_at");--> statement-breakpoint
CREATE INDEX "units_listing_idx" ON "units" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "wa_messages_booking_idx" ON "wa_messages" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "wa_messages_phone_idx" ON "wa_messages" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "wa_otps_phone_idx" ON "wa_otps" USING btree ("phone","created_at");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_door_id_doors_id_fk" FOREIGN KEY ("door_id") REFERENCES "public"."doors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_point_idx" ON "listings" USING gist ("point");--> statement-breakpoint
CREATE INDEX "locations_center_idx" ON "locations" USING gist ("center");--> statement-breakpoint
CREATE INDEX "locations_boundary_idx" ON "locations" USING gist ("boundary");--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_officialCode_unique" UNIQUE("official_code");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_phone_number_unique" UNIQUE("phone_number");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_service_radius" CHECK ("listings"."service_radius_km" is null or "listings"."service_radius_km" > 0);--> statement-breakpoint
-- Anti-tumpang-tindih per unit (PRD 8.4, dijamin database). Pesanan exclusive (slot jam) yang masih
-- menahan slot tidak boleh beririsan waktunya pada unit yang sama. Kursi travel (exclusive = false)
-- dihitung mesin Jadwal di bawah kunci baris unit.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist (
  "unit_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("exclusive" AND "unit_id" IS NOT NULL AND "status" IN ('sent', 'accepted', 'in_progress'));--> statement-breakpoint
-- Blokir manual tidak boleh beririsan dengan blokir lain di unit yang sama.
ALTER TABLE "slot_blocks" ADD CONSTRAINT "slot_blocks_no_overlap" EXCLUDE USING gist (
  "unit_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
);
