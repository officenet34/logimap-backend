-- Nakliye rota mesafe önbelleği
CREATE TABLE IF NOT EXISTS "route_distance_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_key" TEXT NOT NULL,
    "start_province" TEXT NOT NULL,
    "start_district" TEXT NOT NULL,
    "end_province" TEXT NOT NULL,
    "end_district" TEXT NOT NULL,
    "origin_address" TEXT NOT NULL,
    "destination_address" TEXT NOT NULL,
    "distance_meters" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "encoded_polyline" TEXT,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_distance_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "route_distance_cache_route_key_key" ON "route_distance_cache"("route_key");
CREATE INDEX IF NOT EXISTS "idx_route_cache_places" ON "route_distance_cache"("start_province", "start_district", "end_province", "end_district");
