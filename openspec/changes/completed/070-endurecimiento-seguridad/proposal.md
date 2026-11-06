SDD: RUL-endurecimiento-seguridad · v4 · 2026-11-06

# Proposal — Endurecimiento de seguridad de rulett.app

ID HU: ClickUp `17tnjraqgk7` (alias `RUL-endurecimiento-seguridad`, D-24) · Repos: `rulett-app`, `whatsapp_rulett-app`

## Problema

Un diagnóstico externo pasivo de `www.rulett.app` [humano] encontró ajustes de cabeceras y dejó fuera lo que más importa en un SaaS multi-comercio: aislamiento entre comercios, sesiones, lógica de cupones, Server Actions, webhooks y vendedores. La revisión del código de este cambio [intake.md] confirma que el aislamiento entre comercios es sólido (no hay IDOR entre comercios explotable), pero encuentra vulnerabilidades reales en otras capas:

1. **Premios forzables** (H-01, H-02): el reclamo acepta cualquier `couponId` jugable de la campaña, sin relación con el giro, y se puede girar sin límite hasta sacar el premio deseado. Un comensal se queda con el premio más caro y agota su cupo.
2. **Cuentas del personal atacables** (H-03, H-12): el captcha del login se salta llamando directo al callback de credenciales; no hay bloqueo por intentos; los mensajes revelan si la cuenta existe y su rol.
3. **Sesiones que no mueren** (H-05): desactivar, borrar o cambiar la contraseña no cierra sesiones de hasta 30 días.
4. **Login CSRF por OAuth** (H-04): Google y Facebook sin `state` ni PKCE.
5. **Escalada dentro del comercio** (H-06…H-08): un comensal con `tenantId` adoptado puede cambiar el tema de las campañas; asignación masiva latente en cupones.
6. **Documentos sensibles públicos** (H-09): comprobantes de pago y `private/*` legibles por la URL pública de r2.dev.
7. **Sin cabeceras de seguridad ni `security.txt`** (H-10), y otros ajustes de bajo riesgo (H-14…H-21).

## Valor

Cierra los caminos de fraude de premios (impacto directo en el comercio que paga), protege las cuentas con poder (admin, Super Admin, vendedores) y deja la plataforma lista para una prueba autenticada ASVS nivel 2, **sin romper ningún flujo vivo**.

## Alcance

- H0 operación sin código: Firewall de Vercel (403 de páginas legales, reglas de tasa), verificación de HSTS y `npm audit`. **Sin cambios en Cloudflare** (D-09).
- H1 cabeceras de seguridad, CSP en Report-Only con endpoint propio de reportes, COOP en Report-Only, `security.txt`, rewrite de teselas acotado.
- Dependencias antes de H2 (D-27): `next` 16.4.5 y `next-auth` beta.32 (T-43); `zod` 4.6.x y arreglos de desarrollo (T-44).
- H2 guardias de rol (`updateQrTheme`, `leads`), lista cerrada en cupones, prefijo por comercio en URLs y claves R2, comprobantes de pago bajo `private/` con lectura firmada (mismo bucket), comparación de monto en Wompi, cron en tiempo constante, mismo origen sin `localhost` en PDN, LabsMobile por cabecera, PII fuera de logs, `server-only` en Google Wallet, guardia estática anti-regresión.
- H3 preautorización firmada en el callback de credenciales, bloqueo por intentos (`AuthThrottle`), mensajes sin enumeración, `sessionVersion` y revisión de `isActive` por petición, token de recuperación con hash y tope, OAuth con `state` y PKCE.
- H4 token firmado que ata giro y reclamo, resultado fijo por dispositivo y campaña, sorteo con `crypto.randomInt`.
- H5 prueba autenticada ASVS L2 en lab con dos comercios, escenarios E2E de aislamiento y paso a obligatorio de cada interruptor.
- Worker: sin `userName` en logs y `/api/trigger` solo por `POST`.

## Fuera de alcance

- **CSP obligatoria con nonces** y sin `'unsafe-inline'`: los nonces obligan a render dinámico y romperían el ISR de `/l/...` y `/menu` (066). Cambio posterior, con los reportes de H1 como insumo (ADR-070-2).
- **Cualquier cambio en Cloudflare** (D-09): bucket privado, reglas WAF, dominio propio para R2. Por eso `private/*` sigue legible por r2.dev a quien conozca la clave (D-38 de 063, riesgo aceptado), y r2.dev queda como deuda (tiene límite de tasa y Cloudflare no lo recomienda para producción).
- MFA para el personal (recomendado por ASVS L2 para cuentas privilegiadas): se registra como riesgo y candidato a cambio siguiente.
- Verificar la ubicación real del comensal: en web no hay forma confiable; se acepta como riesgo residual R-01.
- Cambiar la regla del canje de cupones de campañas terminadas (D-06: sigue igual).
- Prueba de penetración externa contratada.
- Actualizaciones de versión mayor: `nodemailer` 7 → 10 y `prisma` 6 → 7 (cambio aparte, D-27). Las dependencias con riesgo aceptado están en `decisions.md` (T-05).

## Criterios de aceptación

| CA | Criterio verificable |
|---|---|
| CA-01 | Toda respuesta de PDN lleva `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (cámara y ubicación solo `self`), `Content-Security-Policy-Report-Only` y `Cross-Origin-Opener-Policy-Report-Only`; unit y E2E en verde. |
| CA-02 | `https://www.rulett.app/.well-known/security.txt` responde 200 con `Contact`, `Expires` (futuro) y `Canonical` válidos según RFC 9116. |
| CA-03 | `/privacidad` y `/terminos` responden 200 a un navegador normal y a Googlebot verificado. |
| CA-04 | Solo `TENANT_ADMIN` cambia el tema de una campaña o lee leads; `createCoupon`/`updateCoupon` rechazan campos fuera de la lista. |
| CA-05 | Con `spin-token` obligatorio, un reclamo prospera solo con el `couponId` y la campaña del token emitido por el giro, vigente; en observación, todo reclamo sin token o con token inválido queda registrado y prospera como hoy. |
| CA-06 | Con `spin-sticky` activo, volver a girar la misma campaña desde el mismo navegador dentro de la ventana devuelve el mismo premio y lo indica en pantalla. |
| CA-07 | Con `credentials-preauth` obligatorio, un POST directo al callback de credenciales sin preautorización no abre sesión; con `login-throttle` obligatorio, 10 fallos seguidos bloquean 15 min con el mismo mensaje para correos existentes e inexistentes. |
| CA-08 | Cambiar o recuperar la contraseña cierra todas las sesiones de ese usuario; desactivar un usuario, borrarlo o desactivar su comercio (personal) cierra sus sesiones en la siguiente petición; las sesiones emitidas antes del despliegue siguen válidas. |
| CA-09 | Con `oauth-checks` activo, el OAuth de Google y Facebook usa `state` y PKCE, y la tasa de errores de callback en PDN no sube frente a los 7 días previos. |
| CA-10 | Los comprobantes de pago nuevos no tienen URL pública en la base, el HTML ni el presign, y solo se abren por la ruta firmada (comercio dueño o Super Admin); los existentes siguen visibles para quien hoy los ve. Hasta T-42, un cliente viejo en caché aún recibe la URL de su propio comprobante en el presign, pero no se guarda (D-10). |
| CA-11 | El webhook de Wompi no aprueba un evento cuyo monto o moneda difiere del recibo. |
| CA-12 | La prueba autenticada ASVS L2 en lab con dos comercios termina sin hallazgos Altos ni Medios abiertos (o con su riesgo aceptado por Oscar por escrito). |
| CA-14 | `npm audit --omit=dev` de `rulett-app` no reporta avisos críticos ni altos de `next`, `next-auth`/`@auth/core` ni `zod`; los que queden tienen riesgo aceptado o cambio aparte en `decisions.md` (T-05). |
| CA-13 | Retrocompatibilidad: ningún flujo existente falla con los interruptores apagados; cada interruptor se apaga sin desplegar. |

## Usuarios y casos afectados

- Comensal: giro y reclamo (H4); OAuth (H3). Sin cambio visible salvo el aviso de «ya giraste» (CA-06).
- Personal (admin, cajero, mesero, Super Admin, vendedor): login y sesiones (H3). Cambio visible: tras cambiar la contraseña se cierra la sesión y se pide entrar de nuevo; los mensajes de error del login son genéricos hasta verificar la contraseña.
- Comercio: comprobantes de pago (H2), tema de campañas (H2).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| OAuth con `state`/PKCE falla en navegadores dentro de apps (Instagram, Facebook) | Interruptor `oauth-checks`; lab primero; medir errores de callback 7 días (CA-09); apagar sin desplegar. |
| El token del giro rechaza reclamos legítimos (reclamos pendientes durante el OAuth) | Observación ≥ 7 días en PDN y TTL de 2 h; obligatorio solo con < 0,5 % de reclamos sin token. |
| El bloqueo por intentos se usa para bloquear cuentas ajenas | Ventana de 15 min, se libera solo, la recuperación sigue disponible; la tasa por IP la corta el Firewall. |
| La CSP Report-Only genera volumen de logs | Tope de tamaño y de reportes por petición; regla de tasa en el Firewall. |
| `X-Frame-Options: DENY` rompe un embebido desconocido | D-05 (no hay); sin iframes propios en `src/` [repo: rg `<iframe`]. Reversible quitando la cabecera. |
| Un `TENANT_ADMIN` con URLs antiguas no puede guardar su landing | Prefijo por comercio en observación; un valor igual al guardado siempre pasa. |

## Preguntas abiertas

- ID de ClickUp (deseable).
- Configuración exacta de los «7 ajustes» del diagnóstico externo; si difiere de CA-01, se ajusta en la revisión de H1.
- ¿LabsMobile acepta el API JSON con autenticación básica en el plan contratado? [SUPUESTO — confirmar] (T-20).
