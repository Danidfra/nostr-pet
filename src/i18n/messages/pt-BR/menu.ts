import type { MessageShape } from '../../types';
import type { menu as source } from '../en/menu';

/** Brazilian Portuguese: the game menu. */
export const menu: MessageShape<typeof source> = {
  title: 'Menu',
  guest: {
    yourBlobbi: 'Seu Blobbi',
    yourBlobbiInSentence: 'seu Blobbi',
    theGuestBlobbi: 'O Blobbi convidado',
    save: 'Salvar {name}',
    finishSaving: 'Terminar de salvar {name}',
    saveSub: 'Um lar para onde você pode voltar de outros aparelhos, e a porta para novos mundos. O mesmíssimo Blobbi.',
    signIn: 'Já tenho uma conta',
    signInSub: 'Entre com a conta onde seus Blobbis moram. {name} fica aqui neste aparelho.',
  },
  account: {
    title: 'Conta',
    sub: 'Seu nome e foto, o backup da sua chave e sair.',
  },
  room: {
    title: 'Quarto 3D',
  },
  sound: {
    title: 'Som',
    on: 'Sons ligados',
    off: 'Sons desligados',
    sub: 'Alguns sons suaves quando você cuida do seu Blobbi.',
  },
  music: {
    on: 'Música ligada',
    off: 'Música desligada',
    sub: 'Uma melodia suave enquanto você está em casa.',
  },
  language: {
    title: 'Idioma',
    hint: 'O jogo recarrega no idioma que você escolher.',
    waiting: 'Terminando de salvar primeiro; depois o jogo recarrega.',
    unsaved: 'Salve ou cancele a decoração antes: recarregar faria você perdê-la.',
  },
  help: {
    title: 'Ajuda',
    about: 'O que é Blobbi?',
    aboutSub: 'O que é um Blobbi, o que é Nostr e onde ficam os mundos.',
  },
  lighting: {
    title: 'Iluminação da casa',
    hint: 'Agora é {phase} na Ilha. Seu Blobbi fica igualzinho com qualquer luz.',
  },
};
