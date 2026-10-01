SDD: 17tnjra85qn · v8 · 2026-10-01

# Decisiones — reconciliación rulett-app

T-12 todavía no está hecha. v8 la agrega: «Cómo llegar» en la ficha de página y en el menú, no en la ruleta. [humano, 2026-10-01]

T-01 a T-11 están en el árbol de trabajo, sin commit. Migración local `20261001114819_subscription_reminders_discovery`, solo Docker. No se tocó Neon ni `.env`. El flag sigue apagado. [implementador, 2026-10-01]

## Aceptadas

- Teléfono de contacto vacío: se crea `NOT_DELIVERED` y no se reintenta. Es el borde del spec. `design.md` decía que sin teléfono no había fila; v7 lo corrige. [repo: rulett-app/docs/sdd/17tnjra85qn/spec.md] [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts]
- El cron diario dispara el worker solo si encoló al menos un WhatsApp. La reconciliación corre igual, y el cron de WhatsApp sigue drenando la cola. [repo: rulett-app/src/lib/billing/subscription-reminder-queue.ts] [repo: rulett-app/src/app/api/cron/send-whatsapp/route.ts]
- `GameFlow` sigue recibiendo `campaignName` aunque el componente ya no la usa, para no cambiar a quien la llama. [repo: rulett-app/src/components/GameFlow.tsx]
- `.env.example` queda fuera de git porque `.gitignore` tiene `.env*`. La variable está en `docs/ENV.md`, que sí se versiona. Para meter el ejemplo hay que agregar `!.env.example` antes del commit. Este rol no edita `.gitignore`. [repo: rulett-app/.gitignore] [repo: rulett-app/docs/ENV.md]

## Sigue abierto

- Revisión manual del juego en 390×844 y en Safari de iOS. T-08 en código no cierra esa prueba.
- T-01 en laboratorio y producción, la aplica Oscar. Después, worker redesplegado (W-04) y plantillas Meta. Solo entonces `SUBSCRIPTION_REMINDERS_ENABLED=true`.
- En esa prueba: un WhatsApp fallido termina en un SMS `PLATFORM` enviado, y ese SMS no consume el cupo del comercio.
