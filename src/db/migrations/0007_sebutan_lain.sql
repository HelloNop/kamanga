-- Sebutan kategori, kebutuhan, dan lokasi dipindah ke "sebutan lain" masing-masing.
-- Kamus menjadi daftar kata beserta arti (tanpa tujuan).
ALTER TABLE "categories" ADD COLUMN "aliases" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "aliases" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Salin tujuan lama sebelum kolomnya dihapus. Barisnya tetap di kamus sebagai kata beserta arti.
UPDATE "categories" c SET "aliases" = (
  SELECT coalesce(array_agg(DISTINCT g."term" ORDER BY g."term"), '{}')
  FROM "glossary_terms" g WHERE g."category_id" = c."id"
) WHERE EXISTS (SELECT 1 FROM "glossary_terms" g WHERE g."category_id" = c."id");--> statement-breakpoint
UPDATE "needs" n SET "aliases" = (
  SELECT coalesce(array_agg(DISTINCT g."term" ORDER BY g."term"), '{}')
  FROM "glossary_terms" g WHERE g."need_id" = n."id"
) WHERE EXISTS (SELECT 1 FROM "glossary_terms" g WHERE g."need_id" = n."id");--> statement-breakpoint
INSERT INTO "location_aliases" ("location_id", "alias")
SELECT g."location_id", g."term" FROM "glossary_terms" g WHERE g."location_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "glossary_terms" DROP CONSTRAINT "glossary_terms_single_target";--> statement-breakpoint
ALTER TABLE "glossary_terms" DROP CONSTRAINT "glossary_terms_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "glossary_terms" DROP CONSTRAINT "glossary_terms_need_id_needs_id_fk";
--> statement-breakpoint
ALTER TABLE "glossary_terms" DROP CONSTRAINT "glossary_terms_location_id_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "glossary_terms" DROP COLUMN "category_id";--> statement-breakpoint
ALTER TABLE "glossary_terms" DROP COLUMN "need_id";--> statement-breakpoint
ALTER TABLE "glossary_terms" DROP COLUMN "location_id";
