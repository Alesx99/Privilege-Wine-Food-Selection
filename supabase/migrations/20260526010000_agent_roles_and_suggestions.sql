-- Migration: Agent roles password and product suggestions

-- 1. Add password column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Create product suggestions table
CREATE TABLE IF NOT EXISTS product_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  winery TEXT NOT NULL,
  price_list TEXT NOT NULL,
  recommended_price NUMERIC(10,2) NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
