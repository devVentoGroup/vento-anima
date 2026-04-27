-- Ops V2 - Auditoria operacional integrada
-- NEXO + ORIGO + FOGO
-- Solo lectura. Ejecutar en SQL Editor.

-- 1) Readiness general por sede
select *
from public.v_ops_site_readiness
order by site_type, site_name;

-- 2) Brechas producto -> sede -> area para remision
select *
from public.v_ops_restock_product_gaps
order by site_name, product_name;

-- 3) Cobertura minima de LOC por sede activa
select
  s.name as site_name,
  s.site_type,
  count(*) filter (where l.is_active = true) as loc_total,
  count(*) filter (where l.is_active = true and l.location_type = 'receiving') as loc_receiving,
  count(*) filter (where l.is_active = true and l.location_type = 'storage') as loc_storage,
  count(*) filter (where l.is_active = true and l.location_type = 'picking') as loc_picking,
  count(*) filter (where l.is_active = true and l.location_type = 'staging') as loc_staging,
  count(*) filter (where l.is_active = true and l.location_type = 'production') as loc_production
from public.sites s
left join public.inventory_locations l on l.site_id = s.id
where s.is_active = true
  and s.site_type in ('production_center', 'satellite')
group by s.name, s.site_type
order by s.site_type, s.name;

-- 4) ORIGO: compras/recepciones/entradas con impacto en inventario
select
  s.name as site_name,
  count(distinct po.id) as purchase_orders_30d,
  count(distinct pr.id) as receptions_30d,
  count(distinct ie.id) as inventory_entries_30d,
  count(*) filter (where ie.source_app = 'origo' and ie.entry_mode = 'normal') as origo_normal_entries_30d,
  count(*) filter (where ie.source_app = 'nexo' and ie.entry_mode = 'emergency') as nexo_emergency_entries_30d
from public.sites s
left join public.purchase_orders po
  on po.site_id = s.id
 and po.created_at >= now() - interval '30 day'
left join public.procurement_receptions pr
  on pr.site_id = s.id
 and pr.created_at >= now() - interval '30 day'
left join public.inventory_entries ie
  on ie.site_id = s.id
 and ie.created_at >= now() - interval '30 day'
where s.is_active = true
  and s.site_type in ('production_center', 'satellite')
group by s.name
order by s.name;

-- 5) NEXO: remisiones E2E centro -> satelites
with rr as (
  select
    r.id,
    r.request_code,
    r.status,
    r.created_at,
    fs.name as from_site,
    ts.name as to_site
  from public.restock_requests r
  join public.sites fs on fs.id = r.from_site_id
  join public.sites ts on ts.id = r.to_site_id
  where fs.name = 'Centro de Producción'
    and ts.name in ('Vento Café', 'Saudo', 'Molka Principal')
),
item_stats as (
  select
    i.request_id,
    count(*) as line_count,
    sum(coalesce(i.quantity, 0)) as qty_requested,
    sum(coalesce(i.prepared_quantity, 0)) as qty_prepared,
    sum(coalesce(i.shipped_quantity, 0)) as qty_shipped,
    sum(coalesce(i.received_quantity, 0)) as qty_received,
    sum(coalesce(i.shortage_quantity, 0)) as qty_shortage
  from public.restock_request_items i
  group by i.request_id
),
mov_stats as (
  select
    m.related_restock_request_id as request_id,
    count(*) filter (where m.movement_type = 'transfer_out') as transfer_out_count,
    count(*) filter (where m.movement_type = 'transfer_in') as transfer_in_count
  from public.inventory_movements m
  where m.related_restock_request_id is not null
  group by m.related_restock_request_id
)
select
  rr.request_code,
  rr.status,
  rr.created_at,
  rr.from_site,
  rr.to_site,
  coalesce(isx.line_count, 0) as line_count,
  coalesce(isx.qty_requested, 0) as qty_requested,
  coalesce(isx.qty_prepared, 0) as qty_prepared,
  coalesce(isx.qty_shipped, 0) as qty_shipped,
  coalesce(isx.qty_received, 0) as qty_received,
  coalesce(isx.qty_shortage, 0) as qty_shortage,
  coalesce(ms.transfer_out_count, 0) as transfer_out_count,
  coalesce(ms.transfer_in_count, 0) as transfer_in_count,
  case
    when coalesce(isx.line_count, 0) = 0 then 'invalid_no_items'
    when coalesce(isx.qty_requested, 0) <= 0 then 'invalid_zero_requested_qty'
    when coalesce(ms.transfer_out_count, 0) = 0 then 'missing_transfer_out'
    when coalesce(ms.transfer_in_count, 0) = 0 then 'missing_transfer_in'
    else 'ok_e2e'
  end as trace_status
from rr
left join item_stats isx on isx.request_id = rr.id
left join mov_stats ms on ms.request_id = rr.id
order by rr.created_at desc;

-- 6) NEXO: traslados internos por sede
select
  s.name as site_name,
  count(distinct t.id) as transfers_30d,
  count(ti.id) as transfer_lines_30d
from public.sites s
left join public.inventory_transfers t
  on t.site_id = s.id
 and t.created_at >= now() - interval '30 day'
left join public.inventory_transfer_items ti
  on ti.transfer_id = t.id
where s.is_active = true
  and s.site_type in ('production_center', 'satellite')
group by s.name
order by s.name;

-- 7) NEXO: retiros/consumos desde bodega o produccion
select
  s.name as site_name,
  p.sku,
  p.name as product_name,
  count(*) as consumption_moves_30d,
  sum(abs(coalesce(m.quantity, 0))) as consumed_qty_30d
from public.inventory_movements m
join public.sites s on s.id = m.site_id
join public.products p on p.id = m.product_id
where m.created_at >= now() - interval '30 day'
  and m.movement_type = 'consumption'
group by s.name, p.sku, p.name
order by consumption_moves_30d desc, consumed_qty_30d desc
limit 100;

-- 8) FOGO: lotes con receta publicada y trazabilidad de movimientos
select
  s.name as site_name,
  pb.batch_code,
  p.sku,
  p.name as product_name,
  rc.status as recipe_status,
  pb.created_at,
  count(m.id) as linked_movements
from public.production_batches pb
join public.sites s on s.id = pb.site_id
join public.products p on p.id = pb.product_id
left join public.recipe_cards rc on rc.id = pb.recipe_card_id
left join public.inventory_movements m on m.related_production_batch_id = pb.id
where pb.created_at >= now() - interval '30 day'
group by s.name, pb.batch_code, p.sku, p.name, rc.status, pb.created_at
order by pb.created_at desc;
