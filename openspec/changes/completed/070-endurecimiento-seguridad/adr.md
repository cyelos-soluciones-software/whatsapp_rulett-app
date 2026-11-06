SDD: RUL-endurecimiento-seguridad · v4 · 2026-11-06

# ADR — 070

## ADR-070-1 · Modo observación con un solo interruptor `SECURITY_ENFORCE`
- **Decisión:** todo control que pueda rechazar a un usuario legítimo se despliega registrando lo que habría rechazado; pasa a obligatorio agregando su nombre a `SECURITY_ENFORCE`.
- **Por qué:** Oscar pidió «sin dañar nada». Permite medir en PDN antes de cortar y apagar sin desplegar código.
- **Descartado:** una variable por control (seis variables que se desalinean entre ambientes); activar directo en PDN (sin evidencia de falsos positivos).

## ADR-070-2 · CSP estática en Report-Only con `'unsafe-inline'`; nonces en un cambio posterior
- **Decisión:** la CSP va en `next.config.ts` como `Content-Security-Policy-Report-Only`, sin nonces.
- **Por qué:** un nonce por petición obliga a render dinámico (`headers()` en el árbol); eso rompe el ISR de `/l/...` y `/menu` y la prueba `public-landing-isr-preconditions.test.ts` de 066. Los reportes de 1–2 semanas definen la política obligatoria.
- **Descartado:** CSP obligatoria ahora (rompería Turnstile, Wompi o imágenes no inventariadas); nonces en el proxy (mismo problema de ISR).

## ADR-070-3 · Token firmado sin estado para atar giro y reclamo
- **Decisión:** el giro emite un HMAC de `(qrId, couponId, iat, exp, nonce)`; los dos reclamos lo verifican.
- **Por qué:** el giro es anónimo y frecuente; persistirlo escribe una fila por giro sin dueño. El token sobrevive al viaje de OAuth en `localStorage`, como ya hace `PendingClaimPayload`.
- **Descartado:** tabla `SpinResult` (escrituras por giro anónimo, limpieza, carreras); quitar el `couponId` del cliente y resolver el premio en el reclamo (rompe el flujo de 015/017 y los reclamos en curso).
- **Riesgo aceptado (R-02):** el token es un portador; uso único requeriría estado.

## ADR-070-4 · Resultado fijo por cookie firmada (D-02)
- **Decisión:** cookie `httpOnly` firmada con el último premio por campaña; dentro de la ventana, volver a girar devuelve el mismo premio.
- **Por qué:** cierra el re-roll sin cuentas ni estado en la base. Borrar cookies lo evita; lo acota la tasa por IP (H0).
- **Descartado:** solo tasa por IP (no impide girar 30 veces por minuto); `localStorage` (lo manipula el cliente).

## ADR-070-5 · Preautorización firmada en `authorize()` en lugar de bloquear el callback en el Firewall
- **Decisión:** las acciones de login emiten, tras Turnstile, un HMAC de 120 s que `authorize()` exige.
- **Por qué:** se verifica en el código y en pruebas. No se puede asegurar desde el repo que `signIn()` del servidor no pase por la ruta HTTP del callback, así que una regla del Firewall sobre esa ruta podría romper el login. La regla de tasa del callback (T-02) se suma, no reemplaza.
- **Descartado:** validar Turnstile dentro de `authorize()` (los tokens de Turnstile son de un solo uso y ya los consume la acción).

## ADR-070-6 · Tabla `AuthThrottle` por hash de clave, no columnas en `User`
- **Decisión:** el contador de intentos vive en una tabla con clave `scope:sha256(correo)`.
- **Por qué:** cuenta igual los correos inexistentes (no enumera) y sirve también para el tope de recuperación. No toca `User`.
- **Descartado:** `User.failedLoginCount` (no cubre correos inexistentes y revela existencia por el bloqueo).

## ADR-070-7 · `User.sessionVersion` (revierte el descarte de 066)
- **Decisión:** versión en `User`, copiada al JWT; si difiere, la sesión se cierra.
- **Por qué:** 066 ya lee al usuario en cada petición (`loadSessionUserByEmail`); comparar un entero no agrega consultas. Cubre cambio y recuperación de contraseña (D-04).
- **Descartado:** estrategia de sesión en base de datos (cambio mayor de Auth.js y de rendimiento); `maxAge` corto (cierra sesiones legítimas sin cerrar las robadas).

## ADR-070-8 · Comprobantes privados sin tocar Cloudflare (v2, D-09)
- **Decisión:** el comprobante de pago pasa a purpose privado en el **mismo bucket** (`private/payment-receipts/{tenantId}/…`), se guarda como `attachmentKey` y se lee por una ruta firmada de 60 s. Ningún cambio en Cloudflare.
- **Por qué:** Oscar no autoriza cambios en Cloudflare. Con esto la URL del comprobante deja de estar en la base, en el HTML y en el presign; queda el mismo nivel que los demás documentos privados de 063 y 064.
- **Riesgo aceptado:** D-38 de 063 sigue vigente: r2.dev sirve `private/*` a quien conozca la clave (un UUID que ya no se publica).
- **Descartado (v1):** bucket privado separado; dominio propio + regla WAF sobre `private/*`. Ambos exigen entrar a Cloudflare.

## ADR-070-9 · OAuth vuelve a los checks por defecto de Auth.js detrás de `oauth-checks`
- **Decisión:** sin `checks: ['none']` fuera de `development` cuando la bandera está activa (`pkce` + `state` por defecto).
- **Por qué:** cierra el login CSRF. El comentario actual atribuye el problema a desarrollo [repo: src/auth.ts:149-151]; en PDN con HTTPS las cookies de los checks funcionan. Los navegadores dentro de apps son el riesgo, por eso la bandera y la medición (CA-09).
- **Descartado:** solo `state` (PKCE es el default de Auth.js para Google).
