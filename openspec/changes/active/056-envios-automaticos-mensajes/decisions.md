SDD: 17tnjra7awa · v4 · 2026-10-10

# Decisiones — 056 Envíos automáticos de WhatsApp/SMS

## 2026-10-10 · Planeación (Oscar)

### Aceptadas
- Los comercios legacy sin `TenantSubscription` reciben automáticos (mismo guardián actual).
- Un contacto `NOT_DELIVERED` o `CANCELLED` no cuenta para los topes.
- El throughput del worker (`BATCH_SIZE`, frecuencia del cron `send-whatsapp`) queda fuera del change; Oscar lo ajusta por operación.
- La maqueta `revision-funcional.html` está aprobada por funcional.
- Todos los supuestos de v1 se confirman:
  - PLATFORM fuera de los topes.
  - Un `NOT_DELIVERED` automático borra avisos y `dedupeKey` para reintentar.
  - Un cumpleaños con regalo solo de SMS sale por SMS aunque haya cupo de WhatsApp.
  - Días de antelación 1–30; regalo de 1–60 caracteres.
  - Los topes cuentan desde el despliegue.
  - `maxDuration=300`.
  - El botón dinámico va en el índice 1.
- **SDD aprobado** (v2).

### Sigue abierto
- ~~T-00: nombres finales, categoría y forma de la variable del botón~~ → resuelto (ver T-00 abajo).
- Jurídica: horario de contacto y baja solo en la billetera.

## 2026-10-10 · Validación del plan de implementación de rulett-app

### Aceptadas (propuestas por el implementador, validadas)
- Orden: T-08 se ejecuta en la Fase 1 antes de T-06; T-14 antes de T-12 sin stub. El SDD v2 tenía dependencias contradictorias con su propio orden.
- T-05 integra el gate; T-14 inserta el resolver de plantilla en los manuales; commits separados sobre `actions/whatsapp.ts`.
- La pastilla «Cancelado» se adelanta a T-04, porque la baja genera `CANCELLED` desde la Fase 1.
- `timeout` explícito en las transacciones interactivas y medición en lab; el corte por tiempo ya cubre el exceso.
- Un contacto cancelado por baja conserva `dedupeKey` y avisos: tras reactivar no se reenvía ese saludo ni esos cupones.
- Faltantes que se agregan: `/c/*` público en el proxy (T-14), `/billetera/mensajes` protegida (T-07), gate manual de activación de v2 (T-14), filtros de estado con `CANCELLED` (T-15), AGENTS.md y CLAUDE.md (T-18).
- T-00 queda como gate de activación, no como task de código.

## 2026-10-10 · Validación del plan de implementación del worker

### Aceptadas
- Variable opcional `WHATSAPP_V2_BUTTON_PARAM_NAME`. Sin definir, el botón va posicional (default). Definida, se envía `parameter_name` con ese valor. Se ajusta según cómo registre Meta la variable en T-00.
- Las v2 exigen params no vacíos y `boton_comercio` con UUID 8-4-4-4-12; las v1 siguen siendo permisivas.
- Un `WHATSAPP_V2_BUTTON_INDEX` inválido hace fallar el arranque, igual que `BATCH_SIZE`.
- `QueueStatus` del worker no incorpora `CANCELLED`: el worker nunca ve esas filas.
- Faltantes que se agregan:
  - Fixture de contrato compartido con el JSON de design §3.1, en W-03 y como espejo en T-14.
  - `docs/DEPLOYMENT.md` en W-04.
  - Envío de prueba desde Meta al aprobar cada plantilla.
- Las 4 tasks del worker se hacen de corrido. El despliegue en Cloud Run es de Oscar y solo es requisito antes de activar v2.
- Guía de Meta: el cuerpo de las v2 no lleva `{{nombre_tenant}}`, que va solo en el encabezado. Copiar el cuerpo de la v1 tal cual daría error 132000 en invitación y promoción.

## 2026-10-10 · T-00 Plantillas Meta (Oscar)

### Aceptadas
- Las 4 plantillas v2 quedaron **aprobadas** en Meta, con nombres exactos: `recordatorio_cupones_vencer_v2`, `cumpleanos_regalo_tenant_v2`, `invitacion_evento_exclusivo_v2` y `promocion_relampago_v2`. No hay que cambiar constantes.
- Categoría asignada: Marketing (las 4).
- Variable del botón: posicional `{{1}}`. **No** se define `WHATSAPP_V2_BUTTON_PARAM_NAME`.
- Orden de botones: «Mira tus cupones» (índice 0) e «Información del comercio» (índice 1). `WHATSAPP_V2_BUTTON_INDEX` se deja en su default `1`.
- URL del botón dinámico: `https://www.rulett.app/c/{{1}}`.

### Sigue abierto
- Envío de prueba desde Meta Manager por plantilla (W-04).
- Activación: agregar los nombres v1 a `WHATSAPP_V2_TEMPLATES_APPROVED` solo cuando el worker (W-01…W-03) esté en Cloud Run y T-14 esté desplegado en ese entorno.
