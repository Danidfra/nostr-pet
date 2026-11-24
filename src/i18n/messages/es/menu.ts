import type { MessageShape } from '../../types';
import type { menu as source } from '../en/menu';

/** Spanish: the game menu. */
export const menu: MessageShape<typeof source> = {
  title: 'Menú',
  guest: {
    yourBlobbi: 'Tu Blobbi',
    yourBlobbiInSentence: 'tu Blobbi',
    theGuestBlobbi: 'El Blobbi invitado',
    save: 'Guardar a {name}',
    finishSaving: 'Terminar de guardar a {name}',
    saveSub: 'Un hogar al que volver desde otros dispositivos, y la puerta a nuevos mundos. El mismísimo Blobbi.',
    signIn: 'Ya tengo una cuenta',
    signInSub: 'Inicia sesión con la cuenta donde viven tus Blobbis. {name} se queda aquí, en este dispositivo.',
  },
  account: {
    title: 'Cuenta',
    sub: 'Tu nombre y tu foto, la copia de tu clave y cerrar sesión.',
  },
  room: {
    title: 'Habitación 3D',
  },
  sound: {
    title: 'Sonido',
    on: 'Sonidos activados',
    off: 'Sonidos desactivados',
    sub: 'Unos sonidos suaves cuando cuidas de tu Blobbi.',
  },
  language: {
    title: 'Idioma',
    hint: 'El juego se recarga en el idioma que elijas.',
  },
  help: {
    title: 'Ayuda',
    about: '¿Qué es Blobbi?',
    aboutSub: 'Qué es un Blobbi, qué es Nostr y dónde están los mundos.',
  },
  lighting: {
    title: 'Iluminación de casa',
    hint: 'Ahora es {phase} en la Isla. Tu Blobbi se ve igual con cualquier luz.',
  },
};
