SDD: 17tnjrabmxn · v2 · 2026-10-08

# Tasks — whatsapp_rulett-app

Solo este repo. rulett-app está en `rulett-app/openspec/changes/active/054-gemini-aviso-cloud-run/tasks.md`.

Este build no se despliega en Render. Render sigue con el código actual hasta suspenderlo en el corte.

### W-01 · El disparo espera al lote y exige el borde
Repo: whatsapp_rulett-app · Depende de: ninguna
Subtarea ClickUp: `17tnjrabmxv`
Archivos previstos: `src/server.ts`, `src/index.ts`, `src/config.ts`, `src/db/queue.ts`
Criterio de hecho: `POST /api/trigger` hace await de un lote y después responde `{ triggered, processed }`. Comparación de Bearer y de `X-Rulett-Edge-Secret` en tiempo constante; 401 si falta o no coincide; 503 si `EDGE_SHARED_SECRET` está vacío; en esos tres casos no se llama al procesador. `GET /health` no pide secretos. Si ya hay un lote en curso, responde 200 con `busy: true` y `processed: 0`. El proceso no programa `POLL_INTERVAL_MS`. Antes de reclamar, `PROCESSING` con más de 15 minutos vuelve a `PENDING` y se loguea el conteo.
Pruebas: ver W-02.
Seguridad: API2, API8, A03 en el UPDATE de reclaim (SQL estático, intervalo fijo).
Hotspot a revisar: sí, la comparación de los dos secretos

### W-02 · Pruebas del server
Repo: whatsapp_rulett-app · Depende de: W-01
Subtarea ClickUp: `17tnjrabmxv`
Archivos previstos: `test/` junto a los tests actuales del server, si no hay un archivo de server se crea
Criterio de hecho: cubre R-14, R-15, R-18 y R-19. Casos: ambos secretos bien y el procesador se espera antes de la respuesta; Bearer mal; header ausente; secreto de borde vacío → 503 y cero llamadas al procesador; health sin headers; reclaim no toca una fila `PROCESSING` de hace 1 minuto y sí una de hace 16. ≥ 80 % de las líneas nuevas de `server.ts` y de la función de reclaim.
Pruebas: `npm test` del repo.
Seguridad: los tests usan secretos fijos de prueba, no los de `.env`.
Hotspot a revisar: no

### W-03 · Documentar el binario sin sondeo
Repo: whatsapp_rulett-app · Depende de: W-01
Subtarea ClickUp: `17tnjrabmxv`
Archivos previstos: `docs/DEPLOYMENT.md`
Criterio de hecho: una sección "Cloud Run" que apunta al runbook de `openspec/changes/active/054-gemini-aviso-cloud-run/design.md` y dice que este build no hace sondeo y que Render no debe recibirlo. No copia secretos ni ids de teléfono.
Pruebas: no hay.
Seguridad: ninguno
Hotspot a revisar: no

### W-04 · Aprovisionar Cloud Run
Repo: whatsapp_rulett-app · Depende de: W-01, W-02
Subtarea ClickUp: `17tnjrabmxw`
Archivos previstos: ninguno. Lo ejecuta el humano con el runbook de `design.md` (registro, imagen, secretos, servicio, Cloudflare, alerta de US$5).
Criterio de hecho: `GET https://worker.rulett.app/health` → 200. `POST` a ese host sin Bearer → 401. `POST` directo a `run.app` con Bearer y sin `X-Rulett-Edge-Secret` → 401. Recién ahí rulett-app puede hacer T-07. La URL de `run.app` no se escribe en Vercel.
Pruebas: esos tres requests, anotados en `decisions.md` sin pegar los secretos.
Seguridad: API4, API8, API9.
Hotspot a revisar: no
