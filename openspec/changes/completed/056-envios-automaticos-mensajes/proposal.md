SDD: 17tnjra7awa · v4 · 2026-10-10

# Proposal — 056 Envíos automáticos de WhatsApp/SMS sin acosar al cliente
estado: aprobado [humano, 2026-10-10]
ClickUp: `17tnjra7awa` — [Enviar solos los recordatorios de cupones y los saludos de cumpleaños, sin acosar al cliente](https://app.clickup.com/t/17tnjra7awa)

## Problema
Los administradores casi no envían WhatsApp ni SMS. Cada envío pide elegir campaña, audiencia, ventana de días y regalo o texto [repo: src/components/admin/WhatsappCampaignForm.tsx, SmsCampaignForm.tsx]. Por eso los cupones se vencen sin reclamar y los cumpleaños pasan sin saludo [historia].

Además:
- Todos los comercios envían desde el mismo número de WhatsApp de Rulett [repo: whatsapp_rulett-app/src/services/whatsapp.ts].
- No hay topes por teléfono.
- No hay mecanismo de baja [repo: prisma/schema.prisma].
- El único control de duplicados es contra una fila `PENDING` de la misma campaña y plantilla [repo: src/actions/whatsapp.ts].

Si se automatiza sin protección, el cliente recibe varios mensajes al día del mismo remitente y Rulett pone en riesgo su número ante Meta.

## Valor
- Los clientes vuelven a redimir sin que el comercio tenga que acordarse de enviar.
- El cliente recibe pocos mensajes y puede darse de baja de cada comercio.
- Rulett protege la reputación de su número.

## Alcance
1. Envío diario automático, encendido por defecto, de dos mensajes:
   - El recordatorio de cupones por vencer, que resume todos los cupones del comercio.
   - El saludo de cumpleaños, con un regalo distinto por canal.
2. Pantalla "Mensajes automáticos" con:
   - Encendido de cada mensaje.
   - Días de antelación de cada uno.
   - Regalo de cumpleaños de WhatsApp y de SMS.
   - Textos SMS con comodines y validación.
   - Landing principal.
3. Canal: WhatsApp primero. Pasa a SMS si el cupo de WhatsApp está agotado o si Meta rechaza el envío al instante. Si el SMS no se puede enviar en ese momento, espera a que abra la ventana horaria.
4. Topes por comercio (1 al día, 3 en 7 días) y globales por teléfono (2 al día, 5 en 7 días).
   - Aplican a automáticos y manuales.
   - Prioridad entre motivos: cumpleaños, luego cupón por vencer, luego manual.
   - Los automáticos desplazados se reintentan.
   - Máximo 3 felicitaciones por cumpleaños sumando todos los comercios.
5. Baja por comercio desde un menú de cuenta en la billetera, reversible por el cliente. Al darse de baja se cancelan los envíos pendientes.
6. Informe de omitidos por motivo, en envíos manuales y en el dashboard.
7. Dashboard ampliado y acceso directo a la configuración.
8. Marca automático/manual y motivo en las colas.
9. Cuatro plantillas v2 en Meta con el botón "Información del comercio". Mientras Meta no las apruebe, siguen las actuales.
10. Recorrido guiado: un paso nuevo y los pasos de WhatsApp y SMS actualizados. Quien ya lo terminó ve solo los pasos nuevos.

## No-alcance
- Automatizar la invitación a evento exclusivo o la promoción relámpago.
- Detectar mensajes no entregados después de que Meta los acepta (no hay webhook de estados).
- Reservar cupo para envíos manuales.
- Baja general.
- Aviso o enlace de baja dentro de los mensajes.
- El botón "Detener promociones" de Meta.
- Pasar a SMS en los envíos manuales.
- Topes configurables.
- App nativa.
- **Throughput del worker** (`BATCH_SIZE`, frecuencia del cron `send-whatsapp`). Lo ajusta Oscar por operación cuando haga falta [humano, 2026-10-10].
- Corregir las deudas de los envíos manuales que no exige la historia (ver design §Deudas detectadas).

## Criterios de aceptación
Los 36 escenarios Gherkin de la historia, numerados CA-01…CA-36 en `specs.md` §Matriz de trazabilidad.

## Usuarios y casos afectados
- **TENANT_ADMIN:** pantalla nueva; los envíos manuales ahora pueden omitir clientes; dashboard y colas.
- **USER (cliente final):** menú de cuenta y pantalla de baja en la billetera; recibe menos mensajes.
- **Rulett (operación):** dos variables de entorno nuevas, un cron diario y el trámite de plantillas en Meta.

## Riesgos
- **Aprobación de Meta:** puede tardar o ser rechazada, y las plantillas pueden quedar clasificadas como marketing (más costosas y con límites propios de frecuencia). Mitigación: las v1 siguen operando mientras tanto.
- **Topes sobre manuales:** el administrador puede leer las omisiones como una falla. Mitigación: el resultado del encolado muestra el conteo por motivo.
- **Baja solo en la billetera:** jurídica debe validarlo, igual que el horario de contacto. Es un riesgo heredado de la historia.
- **Throughput:** el worker procesa 50 WhatsApp por disparo y se dispara cada hora [repo: whatsapp_rulett-app/src/config.ts; rulett-app/vercel.json]. Si el volumen diario lo supera, los automáticos se demoran. Queda en manos de operación (Oscar).
- **Tamaño:** se estimaron 93–153 h, más de un sprint. El analista decidió mantener una sola historia; se ejecuta por fases (ver index.md).

## Preguntas abiertas (no bloqueantes)
- Jurídica: horario de contacto y si basta con la baja en la billetera.
- Categoría Meta (utilidad o marketing) y costo de las plantillas v2.
- Nombres finales de las plantillas v2 en Meta [SUPUESTO — confirmar en T-00].
