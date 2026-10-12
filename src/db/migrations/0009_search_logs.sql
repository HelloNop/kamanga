CREATE TABLE "search_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "search_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_id" uuid,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"query" text,
	"need_key" text NOT NULL,
	"label" text NOT NULL,
	"location_id" integer,
	"location_name" text,
	"result_count" integer DEFAULT 0 NOT NULL,
	"alt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_logs_created_idx" ON "search_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "search_logs_need_idx" ON "search_logs" USING btree ("need_key","created_at");