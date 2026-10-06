# V11 — refinamento da ornamentação

Passagem exclusiva de direção de arte sobre o ZIP recebido. Escala, textos, estrutura, configuração e funcionalidades originais preservados.

- Molduras vegetais nas bordas, com folhas, flores claras e sementes secas em diferentes escalas.
- Textura discreta de papel e linhas orgânicas nas áreas de respiro.
- Contornos nas fotos e na citação; percurso vegetal na seção de processo.
- Line art claro nas extremidades do CTA verde e detalhe fino no rodapé.
- Recortes responsivos mantêm o texto livre de sobreposições.

## Arquivos

O único arquivo original alterado é index.html, para carregar a folha decorativa, inserir elementos sem conteúdo semântico e trocar a imagem ornamental da linha do processo por um SVG já existente.
Novos: css/ornaments.css, assets/botanical-atlas.png, assets/botanical-outline.svg e este documento.
Os estilos anteriores, scripts, admin, configuração e Supabase permanecem byte a byte iguais ao ZIP recebido.

O atlas PNG é um complemento gerado com transparência: composição de ramos botânicos vintage em verde oliva dessaturado, louro, eucalipto, flores marfim e sementes secas, com detalhe delicado de gravura e aquarela. Os demais ornamentos reutilizam os assets existentes. O SVG de contorno deriva de botanical-engraving.svg.

## Verificação

Renderização em 375, 390, 430, 768, 1024, 1440 e 1880 px. Dimensões das seções e elementos principais e tamanhos de fonte comparados com o projeto recebido: iguais nas sete larguras. Sem rolagem horizontal da página, imagens quebradas ou exceções JavaScript.
Menu móvel, FAQ e abertura/fechamento da janela de agendamento verificados. Nenhuma reserva foi enviada. A integração real com Supabase não foi exercitada: o CDN externo não estava acessível no ambiente de teste.
