SDD: 17tnjrabmxn · v8 · 2026-10-09

# Decisiones — 17tnjrabmxn

## D-04 · IAM en vez de Cloudflare (2026-10-08)

[humano, 2026-10-08] El servicio ya corre en Cloud Run. Se descarta el header de borde y `worker.rulett.app`. La puerta pasa a ser IAM con la cuenta `whatsapp-worker-invoker`, sin roles de proyecto, y el Bearer del worker se mantiene. rulett-app guarda la URL `run.app`. La audiencia del token es el origen de esa URL, sin path y sin barra final. El header es `X-Serverless-Authorization: Bearer <id_token>`. No borrar `EDGE_SHARED_SECRET` hasta que la revisión que lo ignora esté sirviendo.

La evidencia de T-01 y las decisiones D-05, D-06 y D-08 están en `rulett-app/openspec/changes/active/054-gemini-aviso-cloud-run/decisions.md`. Este repo no cambia en v8.
