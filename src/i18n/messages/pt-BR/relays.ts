import type { MessageShape } from '../../types';
import type { relays as source } from '../en/relays';

/** Brazilian Portuguese: the relay settings. */
export const relays: MessageShape<typeof source> = {
  title: 'Relays',
  tile: {
    sub: '{connected} de {total} conectados. Onde seu Blobbi fica guardado no Nostr.',
  },
  intro: 'Relays são os servidores que guardam seu Blobbi no Nostr. A rede Blobbi é sempre usada; você pode adicionar alguns relays seus. Estas configurações ficam neste aparelho.',
  essential: {
    title: 'Rede Blobbi',
    hint: 'Sempre ligados: seu Blobbi é lido e salvo aqui, por isso não dá para desligá-los.',
    primary: 'Relay do Blobbi',
    network: 'Relay da rede',
  },
  extras: {
    title: 'Seus relays',
    empty: 'Nenhum ainda.',
    count: '{count} de {max}',
    hint: 'Lugares extras para ler e, se você quiser, para enviar seus eventos. Seu Blobbi nunca depende deles.',
  },
  status: {
    ok: 'Conectado',
    failing: 'Sem conexão, tentando de novo',
    unknown: 'Ainda não verificado',
    idle: 'Sem uso',
  },
  access: {
    read: 'Ler',
    write: 'Enviar meus eventos',
  },
  confirmWrite: {
    title: 'Enviar seus eventos para {relay}?',
    body: 'Tudo o que o jogo publica por você (seu Blobbi, os cuidados, seus itens) também será enviado para lá. Seu Blobbi não precisa disso para ficar salvo.',
    allow: 'Enviar para este relay',
    cancel: 'Agora não',
  },
  add: {
    label: 'Endereço do relay',
    placeholder: 'wss://relay.exemplo.com',
    button: 'Adicionar',
    added: 'Adicionado. Só é usado para leitura até você ligar o envio.',
  },
  error: {
    invalid: 'Isso não é um endereço de relay. Ele começa com wss://.',
    essential: 'Esse relay já faz parte da rede Blobbi.',
    duplicate: 'Esse relay já está na sua lista.',
    full: 'Você pode adicionar até {max} relays.',
  },
  remove: 'Remover {relay}',
  restore: {
    button: 'Restaurar padrão',
    done: 'De volta só à rede Blobbi.',
  },
  nip65: {
    button: 'Mostrar minha lista de relays (NIP-65)',
    title: 'Da sua lista de relays',
    hint: 'Só leitura: sua lista de relays nunca é alterada aqui. O relay que você escolher entra só para leitura.',
    loading: 'Procurando sua lista de relays…',
    none: 'Nenhuma lista encontrada, ou todos os relays dela já estão aqui.',
    failed: 'Não deu para ler sua lista de relays. Tente de novo daqui a pouco.',
    add: 'Adicionar {relay}',
  },
};
