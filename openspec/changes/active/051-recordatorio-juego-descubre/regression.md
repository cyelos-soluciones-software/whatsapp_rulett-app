# Regresión — rulett-app

estado: borrador — pendiente de validación humana
Actualizado: 2026-10-01 (17tnjra85qn, laboratorio)

Casos cortos para repetir en este módulo. No es la suite completa de la historia.

| Caso | Criterio | Canal | Datos |
|---|---|---|---|
| Descubre separa ruletas y páginas | R-22 | backoffice | `https://lab.rulett.app/descubre`, sin sesión |
| La ruleta no tiene «Cómo llegar» y la página sí | R-30 | backoffice | la misma página, escritorio |
| El cron de suscripción sin secreto responde 401 | R-15 | API | `GET /api/cron/subscription-reminders` sin bearer. No usar el secreto real en la regresión |
