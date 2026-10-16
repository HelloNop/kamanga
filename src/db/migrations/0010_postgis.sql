-- Ekstensi tahap 1.
-- postgis    : titik usaha, poligon wilayah, area layanan, jarak garis lurus (PRD 8.15)
-- btree_gist : constraint anti-tumpang-tindih jadwal per unit (exclusion constraint) (PRD 8.4)
-- cube + earthdistance tetap aktif sampai pencarian lama pindah ke PostGIS.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
