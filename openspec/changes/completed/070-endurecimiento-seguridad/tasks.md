SDD: RUL-endurecimiento-seguridad · v4 · 2026-11-06

# Tasks — whatsapp_rulett-app

Dependencias externas: ninguna. La app llama `/api/trigger` con `POST` [repo rulett-app: src/lib/whatsapp-worker-trigger.ts:29]; no hay que esperar ningún hito de `rulett-app`.

Quality Gate: 0 bugs y 0 vulnerabilidades nuevas, hotspots revisados, cobertura ≥ 80 % en código nuevo, duplicación ≤ 3 %.

> **Cierre (2026-11-06):** 070 se cerró sin código en el worker; W-01 (lo que falta) y W-02 pasan a 071. Ver `closure.md`.

### [ ] W-01 · Sin nombre del cliente en los logs — en parte hecho por 068 (`processor.ts`); falta el log del pool
Repo: whatsapp_rulett-app · Depende de: ninguna
Subtarea ClickUp: ninguna
Archivos previstos: `src/processor.ts`, `src/db/queue.ts`, `test/processor.test.ts` (o el archivo de pruebas vigente del procesador)
Criterio de hecho: el log «Procesando mensaje» ya no lleva `userName` [whatsapp: src/processor.ts:21-28]; el error del pool de la base registra solo `code` y `message`, no el objeto completo [whatsapp: src/db/queue.ts:150]; el teléfono sigue enmascarado.
Pruebas: espía del logger: ninguna llamada lleva `userName` ni un teléfono sin máscara.
Seguridad: A09 · Hotspot a revisar: no

### [ ] W-02 · `/api/trigger` solo por `POST`
Repo: whatsapp_rulett-app · Depende de: ninguna
Subtarea ClickUp: ninguna
Archivos previstos: `src/server.ts`, `test/server.test.ts` (o el vigente)
Criterio de hecho: en dos pasos para no romper a un llamador desconocido:
1. `GET /api/trigger` sigue funcionando y registra `warn TRIGGER_GET_DEPRECATED` (sin cabeceras ni clave) [whatsapp: src/server.ts:70].
2. Tras 14 días sin ese evento en los logs de Cloud Run, `GET` responde 405 con `Allow: POST`.
Pruebas: `POST` autorizado y no autorizado como hoy; `GET` en el paso 1 (warn) y en el paso 2 (405); `/health` sin cambio.
Seguridad: A05 · Hotspot a revisar: no
