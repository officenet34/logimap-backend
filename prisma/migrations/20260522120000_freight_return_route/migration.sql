-- Dönüş güzergahı (ayrı rota, duraklar ve tahminler)
ALTER TABLE "freight_shipments"
  ADD COLUMN "return_start_province" TEXT,
  ADD COLUMN "return_start_district" TEXT,
  ADD COLUMN "return_end_province" TEXT,
  ADD COLUMN "return_end_district" TEXT,
  ADD COLUMN "return_start_break_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "return_estimated_distance_km" DOUBLE PRECISION,
  ADD COLUMN "return_estimated_duration_seconds" INTEGER,
  ADD COLUMN "return_estimated_route_from_label" TEXT,
  ADD COLUMN "return_estimated_route_to_label" TEXT,
  ADD COLUMN "return_route_legs_json" JSONB;

CREATE TABLE "freight_shipment_return_route_stops" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shipment_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "province" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "freight_shipment_return_route_stops_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "freight_shipment_return_route_stops"
  ADD CONSTRAINT "freight_shipment_return_route_stops_shipment_id_fkey"
  FOREIGN KEY ("shipment_id") REFERENCES "freight_shipments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_freight_return_route_stops_shipment"
  ON "freight_shipment_return_route_stops"("shipment_id", "sort_order");
