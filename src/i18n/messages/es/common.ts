import type { MessageShape } from '../../types';
import type { common as source } from '../en/common';

/** Spanish: words shared across the game. */
export const common: MessageShape<typeof source> = {
  close: 'Cerrar',
  back: 'Volver',
  cancel: 'Cancelar',
  save: 'Guardar',
  done: 'Listo',
  retry: 'Intentar de nuevo',
  loading: 'Cargando…',
  documentTitle: 'Blobbi - El hogar de tu Blobbi',
  phase: {
    dawn: 'amanecer',
    day: 'día',
    sunset: 'atardecer',
    night: 'noche',
  },
};
