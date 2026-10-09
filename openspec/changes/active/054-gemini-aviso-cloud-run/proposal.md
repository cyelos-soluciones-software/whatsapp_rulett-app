SDD: 17tnjrabmxn · v2 · 2026-10-08

# Propuesta — 17tnjrabmxn

## Problema

Tres fallos distintos, una historia porque el analista lo pidió así. [humano, 2026-10-08]

1. rulett-app genera cupones, SMS y los cupones iniciales del alta con `gemini-2.5-flash-lite`. [repo: rulett-app/src/config/ai-prompts.ts] [repo: rulett-app/src/lib/ai/sms-prompts.ts] Esa familia se retira de Vertex "no antes del 16/10/2026"; la fecha no la confirmó Google. [repo: kb-rulett-app/openspec/changes/active/001-kb-foundation/decisions.md D-18] Si se retira, las tres funciones dejan de responder. El alta del comercio no se revierte: queda sin cupones iniciales. [repo: rulett-app/src/lib/tenant-bootstrap-ai.ts]
2. El aviso de renovación está en el código y no le llegó al analista. Al cierre de `17tnjra85qn` seguían abiertos la migración en producción, el redespliegue del worker, el interruptor y la aprobación de las plantillas en Meta. [repo: rulett-app/docs/sdd/17tnjra85qn/index.md] Además el aviso automático solo sale 7 días antes y el día del vencimiento. [proyecto: historias/lote-suscripcion-juego-descubre/historia.md] No hay forma de probarlo ni de reenviarlo.
3. El worker vive en Render, plan gratis. [humano, 2026-10-05] Se duerme a los 15 minutos sin tráfico. El disparo de las 08:00 lo encuentra dormido.

## Valor

La IA sigue funcionando después del 16/10. El super admin puede comprobar el aviso en su teléfono y reenviarlo. El envío de WhatsApp deja de depender de un servicio que se duerme, detrás del dominio de Rulett, dentro de la capa gratis de Cloud Run.

## Alcance

- Tres usos de IA de rulett-app a `gemini-3.1-flash-lite`, región `global`, nombre de modelo por variable de entorno.
- Set de referencia (5 comercios y 5 intenciones de SMS) comparado por el analista. No es un arnés automático.
- Botón en `/super-admin/tenants/[tenantId]/suscripcion` para forzar el aviso de 7 días o el de vencimiento, con historial.
- Cerrar en producción los pendientes de `17tnjra85qn` que bloquean el WhatsApp (migración, interruptor, plantillas). Lo ejecuta el humano; el SDD le deja las consultas.
- Worker: el disparo procesa el lote y después responde; exige encabezado de Cloudflare además del Bearer.
- Cloud Run + Artifact Registry + Secret Manager + Cloudflare Worker en un subdominio de rulett.app. Runbook en `design.md`.
- Apagar Render después de la prueba. No borrarlo el mismo día.

## No alcance

- Chat y embeddings de kb-rulett-app.
- Cambiar prompts, reglas de vigencia, textos de plantillas o las reglas del cron de la mañana.
- Mover rulett-app fuera de Vercel, ni el SMS a otro proveedor.
- Cerrar `*.run.app` con un balanceador de Google.
- Recuperar días de aviso automático que ya pasaron.
- Dejar una instancia de Cloud Run siempre encendida.

## Usuarios

| Actor | Qué cambia para él |
|---|---|
| Administrador de comercio | Sigue generando cupones y SMS con IA. Si la IA falla, ve el mismo error de hoy. |
| Quien se registra o a quien da de alta el super admin | El comercio nuevo sigue naciendo con 3 cupones iniciales si la IA responde. |
| Super admin | Puede forzar un aviso y ver el historial en la ficha de suscripción. |
| Operación | Despliega el worker en Google Cloud y apaga Render. |

## Criterios de aceptación

Los de [proyecto: historias/gemini-31-aviso-renovacion-cloud-run/historia.md], seccionados en `spec.md`. Resumen:

- Cupones y SMS con IA válidos; alta con 3 cupones; alta que no falla si la IA no responde.
- Comparación del set de referencia aprobada por el analista.
- Forzar aviso de 7 días o de vencimiento, también si ya salió o la suscripción venció. Sin teléfono, no envía. Meta rechaza → SMS. No gasta cupo. Doble pulsación = un envío. No tapa el automático del día.
- Campaña de un comercio y aviso de las 08:00 salen con el worker en Cloud Run.
- Llamada directa a `run.app` sin el encabezado no procesa la cola. Llamada por Cloudflare sin la clave tampoco.
- Convivencia Render + Cloud Run sin duplicar ni perder los mensajes en cola.

## Riesgos

- T-01 puede invalidar la fase de IA (esquema JSON, razonamiento que se come el tope de 2048 del SMS, 404 de región).
- El único `(tenantId, kind, expiresOn)` impide el reenvío. Hay que partirlo. [repo: rulett-app/prisma/schema.prisma]
- Si Vercel corta el cron antes de que Cloud Run termine el lote, el cliente aborta. Supuesto: el plan admite ≥ 60 s. [SUPUESTO — confirmar]
- Un lote muerto en `PROCESSING` no se reintenta hoy. [repo: whatsapp_rulett-app/docs/DEPLOYMENT.md] Cloud Run puede matar el request al llegar al timeout.
- Plantillas de Meta sin aprobar: el aviso forzado cae a SMS. No es un defecto.
- La dirección `run.app` sigue pública. La barrera es el encabezado más el Bearer, no la red.

## Preguntas abiertas

Ninguna bloquea el plan. Quedan como supuesto en `design.md`: duración del cron en Vercel, botón con el interruptor apagado, ventana de 2 minutos para la doble pulsación, región `us-central1` para Cloud Run.
