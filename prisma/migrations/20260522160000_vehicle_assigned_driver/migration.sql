ALTER TABLE driver_vehicles
  ADD COLUMN IF NOT EXISTS assigned_driver_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_driver_vehicles_assigned_driver
  ON driver_vehicles (assigned_driver_user_id);
