-- CreateEnum
CREATE TYPE "freight_shipment_status" AS ENUM ('draft', 'active', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "freight_shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "status" "freight_shipment_status" NOT NULL DEFAULT 'active',
    "start_province" TEXT NOT NULL,
    "start_district" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "start_break_minutes" INTEGER NOT NULL DEFAULT 0,
    "end_province" TEXT NOT NULL,
    "end_district" TEXT NOT NULL,
    "vehicle_return_at" TIMESTAMPTZ(6) NOT NULL,
    "end_rest_minutes" INTEGER NOT NULL DEFAULT 0,
    "estimated_distance_km" DOUBLE PRECISION,
    "estimated_duration_seconds" INTEGER,
    "estimated_route_from_label" TEXT,
    "estimated_route_to_label" TEXT,
    "route_legs_json" JSONB,
    "outbound_has_load" TEXT,
    "outbound_load_status" TEXT,
    "outbound_can_take_extra_load" TEXT,
    "outbound_load_description" TEXT,
    "outbound_fill_percent" TEXT,
    "outbound_tonnage_fullness" TEXT,
    "outbound_cargo_space_empty" TEXT,
    "outbound_tonnage_empty" TEXT,
    "outbound_load_criteria" TEXT,
    "return_has_load" TEXT,
    "return_load_status" TEXT,
    "return_load_description" TEXT,
    "return_can_take_extra_load" TEXT,
    "return_fill_percent" TEXT,
    "return_tonnage_fullness" TEXT,
    "return_cargo_space_empty" TEXT,
    "return_tonnage_empty" TEXT,
    "return_only_same_direction" TEXT,
    "return_load_criteria" TEXT,
    "accepted_terms_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freight_shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "freight_shipment_route_stops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "freight_shipment_route_stops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "freight_shipment_load_at_stops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "route_stop_index" INTEGER NOT NULL,
    "fill_percent" TEXT,
    "tonnage_kg" TEXT,
    "cargo_m3" TEXT,
    "load_criteria" TEXT,

    CONSTRAINT "freight_shipment_load_at_stops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "freight_shipment_surrounding_loads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,

    CONSTRAINT "freight_shipment_surrounding_loads_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "freight_shipments" ADD CONSTRAINT "freight_shipments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "freight_shipment_route_stops" ADD CONSTRAINT "freight_shipment_route_stops_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "freight_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "freight_shipment_load_at_stops" ADD CONSTRAINT "freight_shipment_load_at_stops_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "freight_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "freight_shipment_surrounding_loads" ADD CONSTRAINT "freight_shipment_surrounding_loads_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "freight_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_freight_shipments_user_created" ON "freight_shipments"("user_id", "created_at" DESC);
CREATE INDEX "idx_freight_shipments_org_created" ON "freight_shipments"("organization_id", "created_at" DESC);
CREATE INDEX "idx_freight_route_stops_shipment" ON "freight_shipment_route_stops"("shipment_id", "sort_order");
CREATE INDEX "idx_freight_load_stops_shipment" ON "freight_shipment_load_at_stops"("shipment_id", "direction");
CREATE INDEX "idx_freight_surrounding_shipment" ON "freight_shipment_surrounding_loads"("shipment_id", "sort_order");
