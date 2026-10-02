SDD: 17tnjra85qn · v11 · 2026-10-01

# Índice — 17tnjra85qn

estado: v11 pendiente de tu ok. T-01 a T-15 y W-00 a W-03 siguen hechas. T-16 y T-17 cierran dos smells de SonarCloud sin cambiar el comportamiento. Fuera del código: las migraciones en lab y producción, W-04 en Render, el flag apagado, y `engines.node` del worker todavía en `>=20.0.0` hasta el merge.

ClickUp: [Recordar el pago de la suscripción, caber el juego en una pantalla y filtrar lo que hay cerca](https://app.clickup.com/t/9013064238/17tnjra85qn)

Historia local: [proyecto: historias/lote-suscripcion-juego-descubre/historia.md]

El humano pidió un solo SDD para los tres flujos. [humano, 2026-09-30]

ClickUp no se pudo leer desde esta sesión (subtareas, comentarios, relaciones). Si la tarjeta contradice la historia local, este SDD está mal y hay que parar.

## Repos

| Repo | Qué hace | Tasks |
|---|---|---|
| rulett-app | Esquema, aviso, SMS, juego, Descubre, dos smells de SonarCloud | T-01 … T-17 |
| whatsapp_rulett-app | Pruebas, mapeo, campaña nula, docs y prueba en Render | W-00 … W-04 |

## Orden de despliegue

1. Migración de rulett-app (T-01) aplicada por el implementador solo en Docker local. Lab y producción las aplica el humano, antes de encender el flag. Las filas viejas siguen siendo de comercio: `origin` sale en `TENANT`.
2. Worker (W-00 … W-03) en Render, antes del primer aviso por WhatsApp.
3. rulett-app (T-02 … T-11). El cron del aviso no encola hasta `SUBSCRIPTION_REMINDERS_ENABLED=true`.
4. Plantillas en Meta (no es código). Hasta que Meta las apruebe, el WhatsApp falla y el SMS de respaldo sí sale. [proyecto: historias/lote-suscripcion-juego-descubre/historia.md]
5. W-04: redesplegar el worker, aplicar T-01 en laboratorio y producción, probar una fila de plataforma. En el log de ese mismo redespliegue se anota la versión de Node que tomó Render y se comprueba que `/health` responde. Solo después se enciende el flag.

Juego (T-08) y Descubre (T-09 … T-11) no esperan al worker. Pueden ir en el mismo release o después, dentro de esta misma historia.

## Versión

v11. Dos smells de SonarCloud, solo en rulett-app. El worker no cambia. [humano, 2026-10-01]

- T-16. La casilla de Descubre gana `aria-label` con el mismo texto visible. El `name`, el marcado y el aviso de GPS no cambian.
- T-17. El `UPDATE` de `20261001230527_discovery_listed_default_true` lleva un `WHERE` que escribe las mismas filas. No es otra migración. Lab y producción todavía no la tienen. En Docker local solo se actualiza el checksum de Prisma, sin volver a ejecutar el relleno contra Neon.

v10. La ficha de página no repite «Sede · {nombre}»: el título ya es la sede. El hueco lo llena la línea del menú. La oferta se cuenta con `resolveProductDisplayPrice`, en código. T-13, T-14 y T-15 están en el árbol local, sin commit. La migración `20261001230527_discovery_listed_default_true` solo está en Docker. [humano, 2026-10-01] [implementador, 2026-10-01]

v9. Tres ajustes, solo en rulett-app (T-13, T-14, T-15). El worker no cambia. [humano, 2026-10-01]

- La casilla «Publicar esta página en Descubre» nace marcada, también en las páginas que ya existen y en el alta de 14 días y de super admin. El comercio la apaga si no la quiere. Sin GPS de esa sede la página sigue fuera del listado.
- Los cupones que el alta logra crear quedan ligados a la sede creada en ese mismo alta. El botón de cupones con IA del panel no les pone sede.
- La ficha de página muestra la sede, como la ruleta. Si el menú de esa sede tiene ofertas, dice cuántas. Si hay menú y ninguna oferta, invita al menú. Si no hay productos, solo la sede.

v8. En la ficha de página de Descubre y en el menú público de esa sede, un botón «Cómo llegar» abre la app de mapas del celular hacia las coordenadas de la sede. No reemplaza «Ver página». Las ruletas no lo llevan. Task T-12. [humano, 2026-10-01]

v7. T-01 a T-11 están implementadas en local, sin commit. La migración `20261001114819_subscription_reminders_discovery` quedó solo en Docker. El flag sigue apagado. Desviaciones aceptadas en `decisions.md`. [implementador, 2026-10-01]

v6, lanzada [humano, 2026-10-01]. Revisada contra el repo: sin `.nvmrc` ni `.node-version`; `.env` ignorado; `package.json` sigue en `>=20.0.0` hasta que el implementador lo suba. Nota que no bloquea: en ese mismo cambio puede alinear `AGENTS.md`, que marca `POLL_INTERVAL_MS` como requerida aunque el código no falla si falta. `WHATSAPP_LANGUAGE_CODE` usa `es_CO` si no está definida. [repo: src/config.ts] [repo: AGENTS.md]

v6. `engines.node` queda en `>=22.5.0`. `--test-coverage-include` existe desde Node 22.5.0, así que `>=22` dejaría pasar 22.0–22.4 y `npm run test:coverage` fallaría igual. El script no se cambia. No hay `.nvmrc` ni `.node-version`: Render elige Node desde `engines.node`, así que el redespliegue de W-04 corre en otra versión mayor. No es un cambio neutro; el worker usa `fetch` nativo y `pg`. [humano, 2026-10-01] [repo: whatsapp_rulett-app/package.json]

v5. W-00 a W-03 del worker están implementadas y coinciden con v4. [humano, 2026-10-01]
