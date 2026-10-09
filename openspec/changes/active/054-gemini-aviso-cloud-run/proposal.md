SDD: 17tnjrabmxn · v8 · 2026-10-09

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
- Botón «Forzar avisos de suscripción» en `/super-admin/tenants`, al lado de «Forzar reinicio de límites». Corre el mismo pase que el cron. No elige comercio ni plantilla y no agrega historial en la ficha.
- La ventana del aviso pasa de «hoy y en 7 días» a «mañana y en 7 días». `DUE_DAY` significa «falta 1 día». Los dos avisos usan `recordatorio_suscripcion_7d`.
- Cerrar en producción los pendientes de `17tnjra85qn` que bloquean el WhatsApp (migración, interruptor, plantillas). Lo ejecuta el humano; el SDD le deja las consultas.
- Worker: el disparo procesa el lote y después responde; exige el Bearer. Cloud Run exige además un token de identidad de una cuenta de servicio solo para invocar.
- Cloud Run + Artifact Registry + Secret Manager. Runbook en `design.md`. Sin Cloudflare.
- Apagar Render después de la prueba. No borrarlo el mismo día.

## No alcance

- Chat y embeddings de kb-rulett-app.
- Cambiar prompts, reglas de vigencia de cupones o el texto de las plantillas en Meta.
- El worker de WhatsApp. La plantilla de 1 día es la de 7 días, con otro `dias`.
- Mover rulett-app fuera de Vercel, ni el SMS a otro proveedor.
- Cerrar `*.run.app` con un balanceador de Google.
- Recuperar días de aviso automático que ya pasaron.
- Dejar una instancia de Cloud Run siempre encendida.

## Usuarios

| Actor | Qué cambia para él |
|---|---|
| Administrador de comercio | Sigue generando cupones y SMS con IA. Si la IA falla, ve el mismo error de hoy. |
| Quien se registra o a quien da de alta el super admin | El comercio nuevo sigue naciendo con 3 cupones iniciales si la IA responde. |
| Super admin | Desde el listado de empresas dispara el pase de avisos del día, el mismo que a las 08:00. |
| Operación | Despliega el worker en Google Cloud y apaga Render. |

## Criterios de aceptación

Los de [proyecto: historias/gemini-31-aviso-renovacion-cloud-run/historia.md], seccionados en `spec.md`. Resumen:

- Cupones y SMS con IA válidos; alta con 3 cupones; alta que no falla si la IA no responde.
- Comparación del set de referencia aprobada por el analista.
- Desde el listado, el super admin dispara el pase del día: solo comercios que vencen mañana o en 7 días. No elige plantilla ni reenvía si ya salió. El de 1 día usa `recordatorio_suscripcion_7d` con `dias` = `"1"`. Meta rechaza → SMS, y el pase de cada 15 minutos cierra `SENT_SMS` o `NOT_DELIVERED` aunque el interruptor esté apagado. No gasta cupo. Un segundo clic, o el cron del mismo día, no manda otro mensaje.
- Campaña de un comercio y aviso de las 08:00 salen con el worker en Cloud Run.
- Una llamada a `run.app` sin el token de identidad no entra al contenedor. Con token y sin la clave del worker, no procesa la cola.
- Convivencia Render + Cloud Run sin duplicar ni perder los mensajes en cola.

## Riesgos

- T-01 puede invalidar la fase de IA (esquema JSON, razonamiento que se come el tope de 2048 del SMS, 404 de región).
- El único `(tenantId, kind, expiresOn)` se conserva. El botón y el cron de las 08:00 no duplican el aviso del mismo día. No hay reenvío fuera de esa ventana. [repo: rulett-app/prisma/schema.prisma]
- Si Vercel corta el cron antes de que Cloud Run termine el lote, el cliente aborta. Supuesto: el plan admite ≥ 60 s. [SUPUESTO — confirmar]
- Un lote muerto en `PROCESSING` no se reintenta hoy. [repo: whatsapp_rulett-app/docs/DEPLOYMENT.md] Cloud Run puede matar el request al llegar al timeout.
- Plantillas de Meta sin aprobar: el aviso forzado cae a SMS. No es un defecto.
- La dirección `run.app` sigue pública. La barrera es el encabezado más el Bearer, no la red.

## Preguntas abiertas

Ninguna bloquea el plan. Quedan como supuesto en `design.md`: duración del cron en Vercel y región `us-central1` para Cloud Run. El botón no mira el interruptor, y el pase de 15 minutos reconcilia siempre: eso ya no es supuesto.
