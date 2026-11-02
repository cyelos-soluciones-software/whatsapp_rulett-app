/**
 * Fixture de contrato 068 (specs §2.1), espejo de `rulett-app/src/lib/__tests__/fixtures/feedback-contract.ts`
 * (D-14): el JSON exacto que `rulett-app` escribe en `WhatsappQueue.templateParams` de `calificar_pedido` y
 * los `components` que el worker debe mandar a Meta. Si cambia un lado, cambia el otro.
 *
 * Botón posicional en el índice por defecto («0», el único botón): `parameters: [{ type: 'text', text: token }]`.
 */
export const FEEDBACK_CONTRACT_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv0123456789abcdEF';

const text = (parameterName: string, value: string) => ({
  type: 'text',
  parameter_name: parameterName,
  text: value,
});

export const FEEDBACK_CONTRACT = {
  templateName: 'calificar_pedido',
  templateParams: {
    nombre_tenant: 'La Previa',
    nombre_usuario: 'Ana',
    numero_pedido: '128',
    nombre_sede: 'Sede Centro',
    fecha_pedido: '1 nov 2026',
    boton_calificacion: FEEDBACK_CONTRACT_TOKEN,
  } as Record<string, string>,
  components: [
    { type: 'header', parameters: [text('nombre_tenant', 'La Previa')] },
    {
      type: 'body',
      parameters: [
        text('nombre_usuario', 'Ana'),
        text('numero_pedido', '128'),
        text('nombre_sede', 'Sede Centro'),
        text('fecha_pedido', '1 nov 2026'),
      ],
    },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: FEEDBACK_CONTRACT_TOKEN }] },
  ],
};
