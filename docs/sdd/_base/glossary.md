# Glosario — whatsapp_rulett-app

estado: borrador — pendiente de validación humana
Actualizado: 2026-10-01

| Término | Significado en este repo |
|---|---|
| Plantilla | Nombre Meta en `templateName`. El worker solo sabe armar las seis mapeadas: cuatro de comercio y dos avisos de suscripción. |
| Aviso de suscripción | `recordatorio_suscripcion_7d` / `recordatorio_suscripcion_hoy`. Fila `origin = PLATFORM` de Rulett al contacto del comercio, sin campaña, solo body. |
| parameter_name | Parámetro nombrado de la Cloud API. No es el `{{1}}` posicional. [repo: openspec/specs/integrations.md] |
| SENT | Meta aceptó el mensaje. No prueba que el teléfono lo tenga. |
| FAILED | Rechazo inmediato, o `templateParams` vacío o sin las claves que exige su plantilla. `errorLog` guarda el detalle. |
| Trigger | Señal de rulett-app para procesar un lote. No es el alta del mensaje. |
