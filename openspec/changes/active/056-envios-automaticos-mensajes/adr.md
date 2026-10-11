SDD: 17tnjra7awa · v4 · 2026-10-10

# ADR — 056 Envíos automáticos de WhatsApp/SMS
estado: aceptado [humano, 2026-10-10]

## ADR-056-1 · Libro de contactos (`MessageContact`) como punto único de topes
**Contexto.** Los topes por comercio y por teléfono deben cumplir tres condiciones:
- Aplicar a automáticos y manuales.
- Contar como un solo contacto un WhatsApp y su SMS de respaldo.
- Excluir lo no entregado [humano, 2026-10-10].

Hoy las colas no tienen índice por teléfono ni noción de contacto [repo: prisma/schema.prisma].

**Decisión.** Un contacto por mensaje lógico al cliente, que se crea en `reserveContact()` antes de la fila de cola. Los topes se cuentan sobre los contactos activos.

**Consecuencias.**
- Todos los caminos de envío al cliente deben pasar por el gate.
- Hay una tabla más que reconciliar.
- Los históricos no cuentan.

**Descartado.** Contar sobre las colas, porque duplica el respaldo y obliga a uniones costosas.

## ADR-056-2 · Respaldo WhatsApp→SMS por reconciliación en la app
**Decisión.** Mismo patrón que el 051: la app lee el estado del WhatsApp y encola el SMS. El worker no toca `SmsQueue`.

**Consecuencia.** "De inmediato" equivale a la misma pasada o la siguiente, por el disparo síncrono del worker más la reconciliación al final de los crons.

## ADR-056-3 · Configuración por resolver con valores por defecto, sin backfill
**Decisión.** `TenantAutoMessageConfig` es opcional y la ausencia de fila equivale a los valores por defecto. La landing principal efectiva se calcula al leer.

**Consecuencia.** No hay migración de datos ni cambios en el alta de tenants. Un comercio nuevo nace "encendido" sin escribir nada.

## ADR-056-4 · Botón "Información del comercio" → `/c/{tenantId}`
**Decisión.** El parámetro del botón URL dinámico es el `tenantId`. La redirección a la landing se resuelve al hacer clic.

**Consecuencia.** Los mensajes ya enviados siguen la landing principal vigente. El UUID del tenant queda expuesto en la URL; no es un secreto, porque las landings ya son públicas.

**Descartado.** Pasar la ruta de la landing en el parámetro: quedaría congelada en los mensajes enviados.

## ADR-056-5 · Plantillas v2 por variable de entorno
**Decisión.** La lista `WHATSAPP_V2_TEMPLATES_APPROVED` activa cada v2 de forma independiente, cuando Meta la aprueba.

**Consecuencia.** Activar una plantilla requiere redesplegar la app.

**Descartado.** Una tabla de settings: es más infraestructura para un evento que ocurre cuatro veces.

## ADR-056-6 · Lock consultivo por teléfono
**Decisión.** `pg_advisory_xact_lock(hashtext(phone))` dentro de la transacción de cada destinatario.

**Consecuencias.**
- Serializa el cron y los envíos manuales sobre el mismo teléfono.
- Los choques de hash son raros y solo serializan de más; no causan errores.
- Una transacción por destinatario: para 200 manuales son 200 transacciones cortas. Se acepta.
