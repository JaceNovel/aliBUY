INSERT INTO sourcing_settings (
  id,
  currency_code,
  air_rate_per_kg_fcfa,
  air_estimated_days,
  sea_real_cost_per_cbm_fcfa,
  sea_sell_rate_per_cbm_fcfa,
  sea_estimated_days,
  free_air_threshold_fcfa,
  free_air_enabled,
  air_weight_threshold_kg,
  container_target_cbm,
  default_margin_mode,
  default_margin_value
) VALUES (
  'seed_sourcing_settings',
  'XOF',
  10000,
  '5-10 jours',
  180000,
  210000,
  '20-40 jours',
  15000,
  1,
  1.000,
  1.0000,
  'percent',
  10.00
);

INSERT INTO sourcing_sea_containers (
  id,
  code,
  target_cbm,
  current_cbm,
  fill_percent,
  status,
  order_count
) VALUES (
  'seed_container_pending',
  'SEA-20260323-001',
  1.0000,
  0.3800,
  38,
  'pending',
  2
);