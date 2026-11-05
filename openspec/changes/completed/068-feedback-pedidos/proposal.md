SDD: 17tnjrajf9b · v10 · 2026-11-02

# Proposal — 068 Calificación de pedidos e informe de experiencia
estado: aprobado [humano, 2026-11-01] · v2 agrega el alcance 12
ClickUp: `17tnjrajf9b`, cuenta de Rulett. Alias de la historia: `RUL-feedback-pedidos`.

## Problema
Rulett ya sabe qué se pidió, en qué sede, quién lo tomó y quién lo cobró [repo: prisma/schema.prisma:608-673, 772]. Lo que no sabe es cómo le fue al cliente: no hay forma de pedir una calificación ni de convertir los comentarios en acciones [historia].

Los datos de un pedido tampoco pueden usarse para enviar WhatsApp o SMS [repo: openspec/specs/security.md, 062 D-80]. Por eso la captura se apoya en dos cosas: la billetera, que trae el consentimiento del usuario, y un enlace propio de cada pedido.

## Valor
- El comercio sabe qué personas, productos y modalidades van bien o mal, con evidencia de cada semana.
- El comensal califica en menos de un minuto, y el enlace lo invita a crear la billetera y a usar Descubre.
- Rulett gana un dato de satisfacción comparable entre rubros: NPS.

## Alcance
Corresponde a la historia, Incluye 1–11.
1. Interruptor «Pedir calificación» por sede, encendido por defecto. También queda encendido en las sedes existentes y en las nuevas, vengan de `/registro` o del Super Admin.
2. Una solicitud por pedido al pasar a Finalizado, sin importar origen ni modalidad.
3. WhatsApp con respaldo por SMS, 1 h después de finalizar, solo para pedidos vinculados a una billetera.
   - Se envía entre 08:00 y 21:00 (Bogotá); lo que vence fuera de ese horario sale a las 08:00.
   - Descuenta del cupo de WA/SMS del comercio.
   - No pasa por los topes de 056.
   - Respeta la baja.
4. Plantilla de Meta `calificar_pedido` (categoría Utilidad) y su texto SMS equivalente.
5. Enlace y QR firmados por pedido, vigentes 7 días después de finalizar. Se muestran en el seguimiento, en la billetera, en el resumen de WhatsApp del personal y en el PDF.
6. Página pública `/f/{token}`:
   - con sesión de billetera, se califica en la billetera;
   - sin sesión, se califica y después se invita a crear la billetera y se muestra Descubre.
7. Calificaciones pendientes en la billetera.
8. La baja también se ofrece en comercios donde el usuario solo tiene pedidos.
9. Preguntas: NPS de 0 a 10 y comentario de hasta 500 caracteres.
10. Pestaña «Experiencia del cliente»:
    - cifras sin IA;
    - lista de calificaciones;
    - informe con IA semanal (lunes 06:00) y a demanda (1 por día), cada uno a cargo de 1 prompt de `maxAiPromptsPerMonth`.
11. El Resumen se reorganiza en 4 pestañas.
12. **Home** [humano, 2026-11-01, v2]: un destacado nuevo en «Lo que más se nota» y una pregunta frecuente que explican la calificación de pedidos a los comercios. Los textos pasan por la compuerta G-0 y se publican junto con la funcionalidad en PDN (regla 058: la home solo promete lo que está en producción).
13. **Envío manual (v6)** [humano, 2026-11-02]: en un pedido Finalizado, el administrador (cualquier sede) y el cajero (su sede) pueden pulsar «Enviar calificación».
    - El botón adelanta el envío automático de esa solicitud: si sale manual, no sale automático.
    - Aplica las mismas reglas del envío automático: billetera, baja, cupo, suscripción, interruptor, vigencia y franja de 08:00 a 21:00.
    - Se envía una sola vez por pedido.
    - En un pedido sin billetera, el botón explica que no se puede enviar y sugiere compartir el resumen por WhatsApp, que ya lleva el enlace.
14. **Comensal sin billetera (v8)** [humano, 2026-11-02]:
    - La autorización obligatoria del pedido del comensal pasa a «Autorizo a {comercio} y a CYELOS SOLUCIONES DE SOFTWARE S.A.S. a usar mis datos para gestionar este pedido y pedirme por WhatsApp o SMS que lo califique», versión `pedido-2026-11`.
    - Los pedidos del comensal sin billetera creados con esa versión reciben el mensaje de calificación en el celular del pedido, con las mismas reglas: uno por pedido, cupo, baja y franja.
    - Los pedidos del personal y los creados con la versión anterior siguen solo con enlace o QR.
15. **Baja desde `/f` (v8):** quien abre el enlace puede dejar de recibir mensajes de ese comercio en el celular del pedido. Es el mecanismo de revocación para quien no tiene billetera.
16. **`/f` con el diseño de la sede (v8):** colores (fondo, texto, botones, texto de botones), tipografías y logo de la landing de la sede del pedido, con los valores por defecto si no hay landing.
17. **Ajustes del programa de vendedores (v10, H8)** [humano, 2026-11-02]:
    - El texto de contraseña del registro del vendedor dice el mínimo real (12), tomado de la constante.
    - `/registro?codigo=` con un código válido bloquea el campo «¿Te recomendó alguien?».
    - Las comisiones se pagan en los **5** primeros días hábiles del mes siguiente, con contrato `vendedores-v3-2026-11` y nueva aceptación.
    - Cada pago «Por liquidar» del portal dice en qué liquidación entra y cuándo se paga.
    - Se cierra el reporte de QA: se demuestra con pruebas que el % del comercio vigente al aprobar es el que se liquida, y la ficha del vendedor aclara que su % por defecto solo aplica a comercios nuevos.

## No-alcance
Corresponde a la historia, No incluye. Además, en lo técnico:
- No hay estado de entrega de Meta: sin webhook, igual que en 056.
- No se cambia el throughput del worker.
- No hay reserva de cupo de IA compartida con cupones y SMS: esos siguen contando después del uso (ver design §Riesgos).

## Criterios de aceptación
Son los 28 escenarios Gherkin de la historia, numerados CA-01…CA-28, más CA-29 (home, v2) CA-30…CA-36 (envío manual, v6) y CA-37…CA-43 (v8), en `specs.md` §Matriz de trazabilidad.

## Usuarios y casos afectados
- **TENANT_ADMIN:** interruptor en la sede, Resumen en pestañas, pestaña nueva e informe.
- **TENANT_CASHIER / TENANT_WAITER:** al finalizar se crea la solicitud (sin cambios visibles); el PDF y el resumen de WhatsApp llevan el enlace o QR.
- **USER (comensal):** calificaciones pendientes en la billetera, mensajes y baja ampliada.
- **Público:** página `/f/{token}`; la home muestra la capacidad nueva.
- **Rulett (operación):**
  - plantilla en Meta;
  - variables nuevas;
  - dos crons nuevos;
  - cuenta de OpenRouter (opcional, hay respaldo con Gemini).

## Riesgos
- **Meta reclasifica la plantilla como Marketing:** sube el costo y aplican límites de marketing. Mitigación: texto sin promoción. Mientras no esté aprobada, solo sale SMS.
- **OpenRouter:** el contrato de los modelos de decisión no está verificado, porque usan preguntas tipadas. Mitigación: spike en T-01 y Gemini como respaldo o como proveedor principal.
- **Privacidad:**
  - Los comentarios salen hacia proveedores de IA de terceros.
  - El texto sin cuenta lleva aviso de datos (R36) pendiente de revisión de Legal.
  - Se evalúa a personas identificables (meseros y cajeros).

  Mitigación: se redactan teléfonos y correos antes de enviar; los rankings piden muestra mínima de 5.
- **Volumen:** el worker procesa 50 WA por disparo. Con muchos pedidos, el retraso de 1 h crece. Queda en manos de operación (Oscar).
- **Tamaño:** se estimaron 122–187 h. Oscar mantuvo una sola historia y se ejecuta por hitos.

## Preguntas abiertas (no bloqueantes)
- Legal: el aviso de datos al calificar sin cuenta y el uso de comentarios para evaluar al personal.
- Categoría y costo final de `calificar_pedido` en Meta.
- Contrato de OpenRouter para Jev y Microsoft-Decision-1 (T-01).
