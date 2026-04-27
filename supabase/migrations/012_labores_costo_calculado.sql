-- Agrega el costo calculado al momento de registro a la tabla labores
ALTER TABLE labores ADD COLUMN costo_total_calculado NUMERIC(14, 2) NOT NULL DEFAULT 0;
