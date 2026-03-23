CREATE TABLE sourcing_settings (
  id VARCHAR(191) PRIMARY KEY,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'XOF',
  air_rate_per_kg_fcfa INT NOT NULL,
  air_estimated_days VARCHAR(64) NOT NULL,
  sea_real_cost_per_cbm_fcfa INT NOT NULL,
  sea_sell_rate_per_cbm_fcfa INT NOT NULL,
  sea_estimated_days VARCHAR(64) NOT NULL,
  free_air_threshold_fcfa INT NOT NULL,
  free_air_enabled TINYINT(1) NOT NULL DEFAULT 1,
  air_weight_threshold_kg DECIMAL(10,3) NOT NULL,
  container_target_cbm DECIMAL(10,4) NOT NULL,
  default_margin_mode VARCHAR(32) NOT NULL,
  default_margin_value DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE sourcing_sea_containers (
  id VARCHAR(191) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  target_cbm DECIMAL(10,4) NOT NULL,
  current_cbm DECIMAL(10,4) NOT NULL,
  fill_percent INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  order_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ready_to_ship_at DATETIME NULL,
  shipment_triggered_at DATETIME NULL
);

CREATE TABLE sourcing_orders (
  id VARCHAR(191) PRIMARY KEY,
  order_number VARCHAR(64) NOT NULL UNIQUE,
  customer_name VARCHAR(191) NOT NULL,
  customer_email VARCHAR(191) NOT NULL,
  customer_phone VARCHAR(64) NOT NULL,
  address_line_1 VARCHAR(191) NOT NULL,
  address_line_2 VARCHAR(191) NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(120) NOT NULL,
  postal_code VARCHAR(64) NULL,
  country_code VARCHAR(8) NOT NULL,
  shipping_method VARCHAR(16) NOT NULL,
  shipping_cost_fcfa INT NOT NULL,
  cart_products_total_fcfa INT NOT NULL,
  total_price_fcfa INT NOT NULL,
  total_weight_kg DECIMAL(10,3) NOT NULL,
  total_volume_cbm DECIMAL(10,4) NOT NULL,
  status VARCHAR(32) NOT NULL,
  freight_status VARCHAR(32) NOT NULL,
  supplier_order_status VARCHAR(32) NOT NULL,
  alibaba_trade_ids JSON NULL,
  freight_payload JSON NULL,
  supplier_order_payload JSON NULL,
  notes TEXT NULL,
  container_id VARCHAR(191) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sourcing_orders_created_at (created_at),
  INDEX idx_sourcing_orders_status (status),
  INDEX idx_sourcing_orders_shipping_method (shipping_method),
  CONSTRAINT fk_sourcing_orders_container FOREIGN KEY (container_id) REFERENCES sourcing_sea_containers(id)
);

CREATE TABLE sourcing_order_items (
  id VARCHAR(191) PRIMARY KEY,
  order_id VARCHAR(191) NOT NULL,
  product_slug VARCHAR(191) NOT NULL,
  product_name VARCHAR(191) NOT NULL,
  quantity INT NOT NULL,
  supplier_price_fcfa INT NOT NULL,
  margin_mode VARCHAR(32) NOT NULL,
  margin_value DECIMAL(12,2) NOT NULL,
  margin_amount_fcfa INT NOT NULL,
  final_unit_price_fcfa INT NOT NULL,
  final_line_price_fcfa INT NOT NULL,
  weight_kg DECIMAL(10,3) NOT NULL,
  volume_cbm DECIMAL(10,4) NOT NULL,
  image VARCHAR(512) NOT NULL,
  CONSTRAINT fk_sourcing_order_items_order FOREIGN KEY (order_id) REFERENCES sourcing_orders(id) ON DELETE CASCADE
);

CREATE TABLE alibaba_integration_logs (
  id VARCHAR(191) PRIMARY KEY,
  order_id VARCHAR(191) NULL,
  action VARCHAR(64) NOT NULL,
  endpoint VARCHAR(191) NOT NULL,
  status VARCHAR(32) NOT NULL,
  request_body JSON NULL,
  response_body JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alibaba_logs_created_at (created_at),
  INDEX idx_alibaba_logs_status (status),
  CONSTRAINT fk_alibaba_logs_order FOREIGN KEY (order_id) REFERENCES sourcing_orders(id) ON DELETE SET NULL
);