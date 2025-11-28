-- Migration: Add currentKm column to work_orders table
-- Date: 2025-11-28
-- Purpose: Track vehicle mileage (km) at time of service for maintenance reminders
--          - Oil change reminder: every 1,000-1,500 km
--          - Gearbox oil change: every 5,000 km
--          - Throttle/injector cleaning: every 20,000 km

-- Add currentKm column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'work_orders' 
    AND column_name = 'currentkm'
  ) THEN
    ALTER TABLE public.work_orders ADD COLUMN currentKm INTEGER;
    RAISE NOTICE 'Column currentKm added to work_orders table';
  ELSE
    RAISE NOTICE 'Column currentKm already exists in work_orders table';
  END IF;
END $$;

-- Add vehicleId column if not exists (to link work order to specific vehicle in customer.vehicles[])
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'work_orders' 
    AND column_name = 'vehicleid'
  ) THEN
    ALTER TABLE public.work_orders ADD COLUMN vehicleId TEXT;
    RAISE NOTICE 'Column vehicleId added to work_orders table';
  ELSE
    RAISE NOTICE 'Column vehicleId already exists in work_orders table';
  END IF;
END $$;

-- Create index on vehicleId for faster lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_vehicleid ON public.work_orders(vehicleId);

-- Comment for documentation
COMMENT ON COLUMN public.work_orders.currentKm IS 'Vehicle mileage (km) at time of service - used for maintenance tracking';
COMMENT ON COLUMN public.work_orders.vehicleId IS 'Link to specific vehicle in customer.vehicles[] array';
