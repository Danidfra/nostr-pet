import type { MessageShape } from '../../types';
import type { relays as source } from '../en/relays';

/** Spanish: the relay settings. */
export const relays: MessageShape<typeof source> = {
  title: 'Relays',
  tile: {
    sub: '{connected} de {total} conectados. Donde se guarda tu Blobbi en Nostr.',
  },
  intro: 'Los relays son los servidores que guardan tu Blobbi en Nostr. La red Blobbi siempre se usa; puedes añadir algunos relays propios. Estos ajustes se quedan en este dispositivo.',
  essential: {
    title: 'Red Blobbi',
    hint: 'La red Blobbi: siempre activa. Tu Blobbi queda guardado cuando uno de los relays necesarios para guardar lo tiene; los demás ayudan, pero nunca se esperan.',
    primary: 'Relay de Blobbi · necesario para guardar',
    required: 'Relay de la red · necesario para guardar',
    default: 'Relay de la red · también se usa, nunca se espera',
  },
  extras: {
    title: 'Tus relays',
    empty: 'Ninguno todavía.',
    count: '{count} de {max}',
    hint: 'Lugares extra para leer y, si quieres, para enviar tus eventos. Tu Blobbi nunca depende de ellos.',
  },
  status: {
    ok: 'Conectado',
    failing: 'Sin conexión, reintentando',
    unknown: 'Aún sin comprobar',
    idle: 'Sin uso',
  },
  access: {
    read: 'Leer',
    write: 'Enviar mis eventos',
  },
  confirmWrite: {
    title: '¿Enviar tus eventos a {relay}?',
    body: 'Todo lo que el juego publica por ti (tu Blobbi, sus cuidados, tus objetos) también se enviará allí. Tu Blobbi no lo necesita para quedar guardado.',
    allow: 'Enviar a este relay',
    cancel: 'Ahora no',
  },
  add: {
    label: 'Dirección del relay',
    placeholder: 'wss://relay.ejemplo.com',
    button: 'Añadir',
    added: 'Añadido. Solo se usa para leer hasta que actives el envío.',
  },
  error: {
    invalid: 'Esa no es una dirección de relay. Empieza con wss://.',
    essential: 'Ese relay ya forma parte de la red Blobbi.',
    duplicate: 'Ese relay ya está en tu lista.',
    full: 'Puedes añadir hasta {max} relays.',
  },
  remove: 'Quitar {relay}',
  restore: {
    button: 'Restaurar valores',
    done: 'De vuelta solo a la red Blobbi.',
  },
  nip65: {
    button: 'Mostrar mi lista de relays (NIP-65)',
    title: 'De tu lista de relays',
    hint: 'Solo lectura: tu lista de relays nunca se cambia aquí. El relay que elijas entra solo para lectura.',
    loading: 'Buscando tu lista de relays…',
    none: 'No se encontró ninguna lista, o todos sus relays ya están aquí.',
    failed: 'No se pudo leer tu lista de relays. Inténtalo de nuevo en un momento.',
    add: 'Añadir {relay}',
  },
};
