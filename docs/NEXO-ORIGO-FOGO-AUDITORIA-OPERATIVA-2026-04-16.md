# NEXO + ORIGO + FOGO - Auditoria Operativa

Fecha: 2026-04-16
Estado: Auditoria de preparacion para salida operativa

## 1. Criterio de ownership por app

### ORIGO
- Compras.
- Ordenes de compra.
- Recepciones de compra.
- Entradas normales a inventario derivadas de recepcion.

### NEXO
- Maestros operativos de inventario por sede.
- LOC, stock, movimientos, conteos, ajustes.
- Remisiones, traslados internos y retiros/consumo.
- Entradas de emergencia solo cuando ORIGO no puede ejecutar recepcion normal.

### FOGO
- Recetas.
- Lotes de produccion.
- Consumo automatico de insumos y entrada de producto terminado.
- Costeo operativo por lote/porcion.

## 2. Flujos que deben quedar cerrados

### Flujo 1. Compra -> recepcion -> stock
1. La compra nace en `purchase_orders`.
2. La recepcion fisica nace en `procurement_receptions`.
3. La entrada a inventario queda en `inventory_entries` con `source_app = 'origo'` y `entry_mode = 'normal'`.
4. La evidencia minima por item debe incluir cantidad, unidad, lote y vencimiento cuando aplique.

### Flujo 2. Remision centro -> satelite
1. La solicitud nace en `restock_requests` + `restock_request_items`.
2. Bodega selecciona LOC origen y prepara.
3. Despacho genera `transfer_out`.
4. Recepcion satelite genera `transfer_in`.
5. La remision solo cuenta como valida si queda `ok_e2e`.

### Flujo 3. Traslado interno
1. El traslado queda en `inventory_transfers`.
2. El movimiento no cambia stock total del sitio; solo redistribuye por LOC.
3. El origen y destino deben existir y estar activos.

### Flujo 4. Retiro bodega -> produccion / operacion
1. El retiro debe quedar como `inventory_movements.movement_type = 'consumption'`.
2. Debe bajar stock del LOC/sede real de salida.
3. No se debe reemplazar este flujo con ajustes manuales salvo contingencia controlada.

### Flujo 5. Produccion FOGO
1. El lote nace en `production_batches`.
2. La receta debe estar `published`.
3. Deben quedar movimientos asociados al lote para consumo de insumos y entrada del producto final.
4. Si el producto es critico, el lote debe soportar trazabilidad de lote/vencimiento.

## 3. Hallazgos concretos

### Hallazgo A. El dominio ya esta bastante separado
- `20260218000006_app_split_permissions_and_entries_audit.sql` ya separa ownership entre ORIGO, NEXO y FOGO.
- Hay permisos dedicados para `procurement.receipts`, `inventory.entries_emergency`, `production.batches` y `production.recipes`.

### Hallazgo B. Ya existe readiness operativo por sede
- `20260414143000_ops_v2_readiness_views.sql` crea `v_ops_site_readiness` y `v_ops_restock_product_gaps`.
- Eso permite medir LOC, areas, cobertura catalogo-area, recetas publicadas y movimientos recientes.

### Hallazgo C. La brecha mas clara era remisiones vacias
- Ya existia trazabilidad por items y movimientos, pero no una barrera explicita para impedir avance operativo de una remision sin lineas validas.
- Se agrega migracion `20260416113000_ops_v2_restock_execution_guardrails.sql` para bloquear estados operativos sin lineas o sin cantidad solicitada.

### Hallazgo D. El E2E real aun depende de datos operativos validos
- La auditoria existente de piloto detecto requests sin items ni movimientos.
- Conclusión: el problema principal no es ausencia de modelo, sino falta de ejecucion limpia y evidencia consistente.

## 4. Checklists de auditoria por flujo

### Compras / recepciones
- [ ] Cada recepcion real genera `inventory_entries`.
- [ ] `source_app = 'origo'` para recepciones normales.
- [ ] Lote y vencimiento presentes para categorias criticas.
- [ ] No usar `inventory.entries_emergency` como flujo normal.

### Remisiones
- [ ] Ninguna remision piloto queda con `line_count = 0`.
- [ ] Ninguna remision piloto queda con `qty_requested = 0`.
- [ ] Cada remision con despacho tiene `transfer_out`.
- [ ] Cada remision recibida tiene `transfer_in`.
- [ ] Repetir auditoria hasta lograr 3 requests `ok_e2e`.

### Inventario / stock / LOC
- [ ] Cada sede activa tiene LOC minimo operativo.
- [ ] Cada producto satelite tiene `default_area_kind`.
- [ ] No hay huecos en `v_ops_restock_product_gaps`.
- [ ] Conteo inicial y ajustes quedan diferenciados de consumo real.

### Traslados y retiros
- [ ] Traslado interno usa `inventory_transfers`, no remision.
- [ ] Retiro a produccion/operacion usa `consumption`, no ajuste.
- [ ] Ajustes manuales se usan solo para conciliacion controlada.

### Produccion
- [ ] Cada producto piloto tiene receta publicada.
- [ ] Cada lote deja movimientos vinculados.
- [ ] El costo por lote y por porcion es trazable.

## 5. Artefactos para ejecutar ya

### SQL
1. `supabase/ops_v2_readiness_check.sql`
2. `supabase/ops_v2_day1_product_area_loc_matrix_check.sql`
3. `supabase/ops_v2_restock_traceability_audit.sql`
4. `supabase/ops_v2_operational_audit.sql`

### Migraciones base
1. `20260414143000_ops_v2_readiness_views.sql`
2. `20260414152000_ops_v2_bootstrap_locations_and_defaults.sql`
3. `20260414164000_ops_v2_cleanup_test_orders_stock_movements.sql`
4. `20260416113000_ops_v2_restock_execution_guardrails.sql`

## 6. Orden de ejecucion recomendado

1. Ejecutar `ops_v2_readiness_check.sql`.
2. Ejecutar `ops_v2_day1_product_area_loc_matrix_check.sql`.
3. Cerrar todas las brechas de producto -> area -> LOC por sede.
4. Ejecutar conteo inicial y congelar stock base.
5. Correr 3 remisiones reales E2E.
6. Ejecutar `ops_v2_restock_traceability_audit.sql`.
7. Ejecutar `ops_v2_operational_audit.sql`.
8. Publicar recetas piloto y cerrar lotes reales en FOGO.

## 7. Regla operativa final

No aceptar salida a operacion por percepcion visual de que "la pantalla ya sirve".
Solo aceptar salida cuando compras, recepciones, remisiones, traslados, retiros y produccion dejen evidencia canonica en tablas y movimientos auditables.
