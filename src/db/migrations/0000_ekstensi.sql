-- Ekstensi yang dipakai direktori Kamanga.
-- vector       : pencarian semantik (embedding)
-- pg_trgm      : pencarian teks mirip / typo ("Bukiktinggi")
-- unaccent     : abaikan aksen saat mencari
-- cube + earthdistance : jarak antar titik lat/lng (pengganti PostGIS untuk awal)
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS cube;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS earthdistance;
