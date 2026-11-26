import type { MessageShape } from '../../types';
import type { common as source } from '../en/common';

/** Brazilian Portuguese: words shared across the game. */
export const common: MessageShape<typeof source> = {
  close: 'Fechar',
  back: 'Voltar',
  cancel: 'Cancelar',
  save: 'Salvar',
  done: 'Pronto',
  retry: 'Tentar de novo',
  loading: 'Carregando…',
  documentTitle: 'Blobbi - O lar do seu Blobbi',
  phase: {
    dawn: 'amanhecer',
    day: 'dia',
    sunset: 'pôr do sol',
    night: 'noite',
  },
};
