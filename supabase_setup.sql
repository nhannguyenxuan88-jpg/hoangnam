-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parts table
CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  stock JSONB DEFAULT '{}',
  retailPrice JSONB DEFAULT '{}',
  wholesalePrice JSONB DEFAULT '{}',
  category TEXT,
  description TEXT,
  warrantyPeriod TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  creationDate TIMESTAMPTZ NOT NULL,
  customerName TEXT NOT NULL,
  customerPhone TEXT,
  vehicleModel TEXT,
  licensePlate TEXT,
  issueDescription TEXT,
  technicianName TEXT,
  status TEXT NOT NULL DEFAULT 'Tiếp nhận',
  laborCost NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  partsUsed JSONB DEFAULT '[]',
  notes TEXT,
  total NUMERIC DEFAULT 0,
  branchId TEXT NOT NULL,
  
  -- Deposit fields
  depositAmount NUMERIC,
  depositDate TIMESTAMPTZ,
  depositTransactionId TEXT,
  
  -- Payment fields
  paymentStatus TEXT DEFAULT 'unpaid',
  paymentMethod TEXT,
  additionalPayment NUMERIC,
  totalPaid NUMERIC,
  remainingAmount NUMERIC,
  paymentDate TIMESTAMPTZ,
  cashTransactionId TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  customer JSONB NOT NULL DEFAULT '{}',
  paymentMethod TEXT NOT NULL,
  userId TEXT NOT NULL,
  userName TEXT NOT NULL,
  branchId TEXT NOT NULL,
  cashTransactionId TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash Transactions table
CREATE TABLE IF NOT EXISTS cash_transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT,
  branchId TEXT NOT NULL,
  paymentSource TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Sources table
CREATE TABLE IF NOT EXISTS payment_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  balance JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  partId TEXT NOT NULL,
  partName TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  unitPrice NUMERIC,
  totalPrice NUMERIC NOT NULL,
  branchId TEXT NOT NULL,
  notes TEXT,
  saleId TEXT,
  workOrderId TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_parts_sku ON parts(sku);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_branchId ON work_orders(branchId);
CREATE INDEX IF NOT EXISTS idx_work_orders_date ON work_orders(creationDate DESC);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_branchId ON sales(branchId);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON cash_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_branchId ON cash_transactions(branchId);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow all for now - adjust based on your auth needs)
CREATE POLICY "Allow all operations on customers" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all operations on parts" ON parts FOR ALL USING (true);
CREATE POLICY "Allow all operations on work_orders" ON work_orders FOR ALL USING (true);
CREATE POLICY "Allow all operations on sales" ON sales FOR ALL USING (true);
CREATE POLICY "Allow all operations on cash_transactions" ON cash_transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations on payment_sources" ON payment_sources FOR ALL USING (true);
CREATE POLICY "Allow all operations on inventory_transactions" ON inventory_transactions FOR ALL USING (true);

-- Insert default payment sources
INSERT INTO payment_sources (id, name, balance) VALUES
  ('cash', 'Tiền mặt', '{"CN1": 0}'),
  ('bank', 'Chuyển khoản', '{"CN1": 0}')
ON CONFLICT (id) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for work_orders
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
