SDD: 17tnjra85qn · v11 · 2026-10-01

# Decisiones — reconciliación rulett-app

Memoria única. [humano, 2026-10-01] Esta historia vive en `openspec/changes/active/051-recordatorio-juego-descubre/`. `docs/sdd/` y la copia `sdd/` de la raíz del workspace dejan de ser fuente. El precedente es el cambio 050: el canon es `openspec/` y no se duplica `openspec/specs/`.

Cierre de laboratorio. El analista cierra la corrida en `lab.rulett.app` el 2026-10-01 con lo ya visto. Veredicto Incompleto. El envío al teléfono (R-01 a R-14, R-16, R-32) queda fuera y no se marca como cumple. [humano, 2026-10-01]

Cierre v11. El contrato describe el árbol local. T-16 y T-17 están hechas: el formulario tiene `aria-label`, `useId` y `aria-describedby` en el texto de 15 km, y el `UPDATE` de `20261001230527` lleva el `WHERE` de R-31. Oscar confirmó que lab y producción no tenían esa migración al editarla. El quality gate de SonarCloud pasó: 1 issue nuevo, 0 aceptados, 0 hotspots, 0,0 % de cobertura en código nuevo y 0,0 % de duplicación. La captura no nombra el issue que queda, y el gate igual está en verde. [humano, 2026-10-01] [repo: src/components/admin/BranchLandingDiscoveryForm.tsx] [repo: prisma/migrations/20261001230527_discovery_listed_default_true/migration.sql]

Fuera del cierre: Oscar aplica `20261001114819_subscription_reminders_discovery` y después `20261001230527_discovery_listed_default_true` en lab y producción; W-04 redespliega el worker y anota Node y `/health`; el flag sigue apagado; antes del merge el worker pasa a `engines.node` `>=22.5.0`.

T-16 y T-17 están en el árbol local, sin commit. 1.400 tests y `next build` en verde. Paso 0 de T-17: Oscar confirmó que ni lab ni producción tienen `20261001230527`. En Docker el checksum previo coincidía con el SHA-256 de los bytes del archivo en `HEAD`; se reemplazó por el del archivo nuevo, en minúsculas, sin reejecutar el relleno. `migrate status` contra `localhost:5440` al día. Los avisos de SonarCloud se confirman tras el push. [implementador, 2026-10-01]

v11, plan de T-16 y T-17 aceptado con condiciones. [humano, 2026-10-01] [repo: vitest.config.ts]

T-16. `useId()` para el checkbox y para el texto de ayuda. El texto de 15 km sigue siendo un `<span>` dentro del `<label>`; no pasa a `<p>` ni sale del label. `aria-label` sustituye el nombre accesible; ese span queda solo como `aria-describedby`, no como segunda copia del título. El aviso ámbar de GPS no entra en `aria-describedby`. La prueba es `src/components/admin/__tests__/branch-landing-discovery-form.test.ts` (`renderToStaticMarkup`). Vitest incluye `src/**/*.test.ts`, no hace falta meterla en `src/lib`. [repo: vitest.config.ts]

T-17 no empieza hasta el paso 0. La migración está en el commit `dbc551c`, ya en `origin` de esta rama. Subirla no la aplica: `build` no corre `migrate deploy`. Desde aquí no se ve Neon. Si lab o producción ya tienen `20261001230527_discovery_listed_default_true`, no se edita el SQL y el aviso de SonarCloud se acepta como relleno intencional, sin `sonar.exclusions`. Si no la tienen, el `WHERE` de R-31 entra en el mismo archivo. El checksum en Docker es el SHA-256 en hexadecimal minúsculas de los bytes del archivo en disco (Prisma no usa el hash en mayúsculas de `Get-FileHash`). No se usa `migrate dev`. El aviso PL/SQL solo se comprueba en SonarCloud.

Cierre. El contrato v10 describe el árbol local. No hay task de código abierta. Lo que falta no cambia el SDD: Oscar aplica `20261001114819_subscription_reminders_discovery` y después `20261001230527_discovery_listed_default_true` en lab y producción; W-04 redespliega el worker y anota Node y `/health`; el flag sigue apagado hasta esa prueba; antes del merge el worker pasa a `engines.node` `>=22.5.0`. [humano, 2026-10-01]

T-13, T-14 y T-15 están en el árbol local, sin commit. 1.398 tests, `next build` y `src/lib` al 84 %. La migración `20261001230527_discovery_listed_default_true` solo está en Docker. `AGENTS.md` no se actualizó. Sonar sigue marcando la etiqueta del checkbox en `BranchLandingDiscoveryForm.tsx`; la estructura no cambió y no se tocó. [implementador, 2026-10-01]

v10. La ficha de página no lleva «Sede · {nombre}»: el título ya es la sede. [repo: rulett-app/src/actions/discovery.ts] El plan del implementador queda aceptado con eso: `listedInDiscoveryAt` explícito en las altas, `coupon.create` dentro de una transacción en vez de `createMany`, conteo de ofertas en código con `resolveProductDisplayPrice`, helper `src/lib/discovery-menu-summary.ts`, y el relleno SQL comprobado en Docker, no con Vitest. El botón de IA del panel se cubre con un test nuevo. No hace falta un `findFirst` extra de la sede en T-14: el `branchId` sale del alta. La etiqueta en el listado de landings y el aviso de GPS en el correo quedan fuera. [humano, 2026-10-01]

v9 aún no está implementada. La casilla de Descubre nace marcada, también en páginas ya creadas. Sin GPS no salen. Los cupones del alta de super admin y de 14 días quedan en la sede de ese alta; el botón de IA del panel no. La ficha de página, si hay menú, muestra ofertas o la invitación al menú. v10 quitó la línea de sede porque repetía el título. [humano, 2026-10-01]

T-12 quedó en código en local. Falta la revisión en el celular. [humano, 2026-10-01]

T-13, T-14 y T-15 están en el árbol de trabajo, sin commit. Migración local `20261001230527_discovery_listed_default_true`, solo Docker. [implementador, 2026-10-01]

- v10: la ficha `PAGE` no muestra «Sede · {nombre}» porque el título ya es la sede; ese lugar lo ocupa la línea del menú. [humano, 2026-10-01]
- El relleno SQL no tiene unit en Vitest (sin BD); se verificó en Docker local con un conteo antes y después, anotado en `tasks.md`. [implementador, 2026-10-01]
- `persistBootstrapAiCoupons` usa `$transaction` de `coupon.create` porque `createMany` no admite `connect` N:M. [repo: rulett-app/src/lib/tenant-bootstrap-ai.ts]

T-01 a T-11 están en el árbol de trabajo, sin commit. Migración local `20261001114819_subscription_reminders_discovery`, solo Docker. No se tocó Neon ni `.env`. El flag sigue apagado. [implementador, 2026-10-01]

## Aceptadas

- Teléfono de contacto vacío: se crea `NOT_DELIVERED` y no se reintenta. Es el borde del spec. `design.md` decía que sin teléfono no había fila; v7 lo corrige. [repo: openspec/changes/active/051-recordatorio-juego-descubre/specs.md] [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts]
- El cron diario dispara el worker solo si encoló al menos un WhatsApp. La reconciliación corre igual, y el cron de WhatsApp sigue drenando la cola. [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts] [repo: rulett-app/src/app/api/cron/send-whatsapp/route.ts]
- `GameFlow` sigue recibiendo `campaignName` aunque el componente ya no la usa, para no cambiar a quien la llama. [repo: rulett-app/src/components/GameFlow.tsx]
- `.env.example` queda fuera de git porque `.gitignore` tiene `.env*`. La variable está en `docs/ENV.md`, que sí se versiona. Para meter el ejemplo hay que agregar `!.env.example` antes del commit. Este rol no edita `.gitignore`. [repo: rulett-app/.gitignore] [repo: rulett-app/docs/ENV.md]

## Sigue abierto

- Revisión manual del juego en 390×844 y en Safari de iOS. T-08 en código no cierra esa prueba.
- T-01 en laboratorio y producción, la aplica Oscar. Después, worker redesplegado (W-04) y plantillas Meta. Solo entonces `SUBSCRIPTION_REMINDERS_ENABLED=true`.
- En esa prueba: un WhatsApp fallido termina en un SMS `PLATFORM` enviado, y ese SMS no consume el cupo del comercio.
