-- Create table for storing product prices
CREATE TABLE prices (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    ean TEXT NOT NULL,
    nombre TEXT,
    precio NUMERIC,
    precio_oferta NUMERIC,
    imagen_url TEXT,
    cadena TEXT NOT NULL,
    url_producto TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    error TEXT
);

-- Create index for faster EAN queries
CREATE INDEX idx_prices_ean ON prices(ean);
CREATE INDEX idx_prices_timestamp ON prices(timestamp);

-- Enable RLS
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

-- Allow public read access (if you want everyone to be able to read)
CREATE POLICY "Public read access" ON prices FOR SELECT USING (true);

-- Allow authenticated or service role write access
CREATE POLICY "Service role write access" ON prices FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role update access" ON prices FOR UPDATE USING (true);
