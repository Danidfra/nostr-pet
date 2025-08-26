chat agora vou criar um outro app, relacionado a esse.... o outro app vai se chamar blobbi island... ele vai ter uma pagina inicial de boas vindas ao blobbi island, uma header bem moderna e bonita, o estilo do app todo deve ser baseado no arquivo 'DESIGN_SYSTEM.md', nessa tela inicial na parte do header vai ter alem do botao de login uma engrenagem para mudar os relays conectados etc, quando a pessoa logar com a conta nostr dela vai fazer uma request para o/os relays conectados que a pessoa colocou (ou o padrao se ela nao mexeu), a req para o relay vai ser pedindo o kind 31125 relacionado a pubkey dessa pessoa, outro kind vai ser todos os kinds 31124 relacionados a pubkey daquele usuario também, enquanto espera os dados vai ficar uma tela carregando... depois que carregar tudo isso vai mostrar qual é o blobbi companion como se ele estivesse selecionado (tag current_companion do kind 31125) e os outros blobbis que a pessoa tiver (se aplicavel) todos em uma grade para a pessoa escolher qual ela vai usar naquela sessão, se for o que ja esta selecionado mesmo é so ela clicar em entrar depois de selecionar o que ela quiser... deixa um botao para entrar e outro para cancelar que vai direcionar para a tela inicial... depois que a pessoa selecionar o blobbi que ela quer, se for outro que nao é o current_companion, é para ser criado um event com os valores antigos do 31125, atualizando somente a tag current_companion, e colocando o id do blobbi selecionado ali no lugar e enviar esse novo evento para o relay, depois que atualizou isso, é para pegar o id desse blobbi selecionado e utilizar o kind 31124 referente a esse blobbi... com os dados do kind 31124, vai ser carregado o personagem, os seguintes dados sao necessarios para carregar o personagem, tags: stage, base_color, secondary_color (se aplicavel), eye_color

a primeira condicional é que o stage precisa ser no minimo baby... se ele for egg ele nao pode ser utilizado no blobbi island...

se ele for baby ou mais velho, entao o stage vai ser utulizado para fazer uma request para a seguinte url:

se for baby o blobbi vai ser assim: https://danidfra.github.io/blobbi-designs/baby-stage/baby/blobbi-baby-base.svg


se for adult vai ser assim: https://danidfra.github.io/blobbi-designs/adult-stage/{valor da tag adult_type que tem no kind 31124 do blobbi}/{adult_type}-base.svg

isso vai puxar o design do blobbi tipo a aparencia dele, e depois que puxar esse svg, ele deve ser modificado utilizando as cores das tags, por exemplo, a maior parte do corpo do personagem deve ter a cor da tag 'base_color', se ele tiver 'secondary_color' essa segunda cor deve ser aplicada em uma pequena parte dele, os olhos devem ter a cor da tag 'eye_color'. Por enquanto aplica esse cor segundaria somente para os babies, se for adult aplica somente a 'base_color'

um exemplo de ediçao ja feita é esse codigo do baby stage:

```js
function customizeSvg(svgText: string, blobbi: Blobbi, isSleeping: boolean = false): string {
  let modifiedSvg = svgText;

  // Only apply customizations if we have colors
  if (!blobbi.baseColor && !blobbi.secondaryColor) {
    return modifiedSvg;
  }

  // Find and modify the body gradient
  const bodyGradientRegex = /<radialGradient[^>]*id=["']blobbiBodyGradient["'][^>]*>([\s\S]*?)<\/radialGradient>/;
  const bodyGradientMatch = modifiedSvg.match(bodyGradientRegex);

  if (bodyGradientMatch && blobbi.baseColor) {
    let newGradient = '';
    
    if (blobbi.secondaryColor) {
      // Both base_color and secondary_color are present
      newGradient = `<radialGradient id="blobbiBodyGradient" cx="0.3" cy="0.25">
        <stop offset="0%" style="stop-color:${blobbi.secondaryColor}"/>
        <stop offset="60%" style="stop-color:${lightenColor(blobbi.secondaryColor, 20)}"/>
        <stop offset="100%" style="stop-color:${blobbi.baseColor}"/>
      </radialGradient>`;
    } else {
      // Only base_color is present
      newGradient = `<radialGradient id="blobbiBodyGradient" cx="0.3" cy="0.25">
        <stop offset="0%" style="stop-color:${lightenColor(blobbi.baseColor, 40)}"/>
        <stop offset="60%" style="stop-color:${lightenColor(blobbi.baseColor, 20)}"/>
        <stop offset="100%" style="stop-color:${blobbi.baseColor}"/>
      </radialGradient>`;
    }
    
    modifiedSvg = modifiedSvg.replace(bodyGradientMatch[0], newGradient);
  }

  // ✅ FIXED: Skip eye color customization for sleeping SVGs (eyes are closed)
  if (blobbi.eyeColor && !isSleeping) {
    const eyeGradientRegex = /<radialGradient[^>]*id=["']blobbiPupilGradient["'][^>]*>([\s\S]*?)<\/radialGradient>/;
    const eyeGradientMatch = modifiedSvg.match(eyeGradientRegex);

    if (eyeGradientMatch) {
      const newEyeGradient = `<radialGradient id="blobbiPupilGradient" cx="0.3" cy="0.3">
        <stop offset="0%" style="stop-color:${lightenColor(blobbi.eyeColor, 30)}"/>
        <stop offset="100%" style="stop-color:${blobbi.eyeColor}"/>
      </radialGradient>`;
      
      modifiedSvg = modifiedSvg.replace(eyeGradientMatch[0], newEyeGradient);
    }
  }

  return modifiedSvg;
}
```


depois que a pessoa fizer esse login, deve carregar a pagina do game... a ideia é ser um jogo que o design da pagina vai ser assim:

no meio da tela vai ter o retangulo com a dimensao de 1046 × 697 onde vao ser carregados as imagens dos mapas, personagens, etc... no topo da pagina tera um header com um botao para ir para o home (icone de casinha), o botao para configurar os relays e o de log out (se ja estiver logada se nao o de login...)

nessa janela principal que fica no meio datela, ela deve ter suporte para mobile e quando for mobile a pessoa deve virar a tela... para uma melhor experiencia...

dentro da janela principal onde vai ser carregado uma uma imagem e nela tera dois botoes, um de login e o outro para criar sua conta que vai redirecionar a pessoa para o site blobbi.pet

nessa janela principal depois que a pessoa logar e passar pelo processo que falei antes de carregar os blobbis nessa janela principal para a pessoal selecionar e talls, deve ser aberto a imagem 'blobbi-village.png' ajustada dentro da janela central, dentro dela vai ser carregado e posicionado as seguintes imagens: nostr-station.png, mine.png, plaza.png, home.png, town.png e beach.png, espalha elas uma longe da outra e depois eu posociono mudando o codigo, quando o mouse passar nessas imagens ele deve ficar no modo cursor-pointer e a imagem deve 'crescer' tipo dar o efeito de expandir...