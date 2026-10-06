# Revisão visual da referência

## Escopo
Implementação visual sobre o ZIP V9, com a referência botânica como direção de composição e o V9 como base de escala, conteúdo e comportamento.

- Header claro, hero com fotografia real dominante e recorte orgânico.
- Título desktop mantido em 72px a 1440px, igual ao V9; texto introdutório de 15px para 16px. Container de 1240px preservado.
- Sobre com fotografia retangular, enquadramento editorial e botânica lateral.
- Seis temas em grade regular, com links reais para o agendamento existente.
- Quatro etapas preservadas; processo vertical no mobile.
- Atendimento editorial, FAQ com linhas finas, faixa final verde e rodapé claro.
- Fotos reais de Silvana preservadas. A pose e o enquadramento disponíveis no ZIP diferem da imagem de referência; não houve geração ou substituição da pessoa.
- Créditos e todos os conteúdos originais preservados.

## Arquivos
`index.html`: carregamento consolidado em `css/reference.css` e `css/booking.css`; uso de assets existentes e links dos temas.
`css/reference.css`: estilos públicos, fontes locais, composição, ornamentos, estados de interação e breakpoints.
Os estilos antigos permanecem no pacote para consulta, sem serem carregados pela homepage. Os arquivos de administração, configuração, scripts, Supabase e agendamento não foram modificados.

## Validação
Chromium/Playwright: 375, 390, 430, 768, 1024, 1440 e 1920px.
- Sem overflow horizontal, imagens quebradas ou exceções JavaScript.
- Menu abre e fecha; FAQ abre uma pergunta por vez.
- Modal de agendamento abre e fecha, sem overflow horizontal.
- Todos os IDs, atributos data-* e scripts originais preservados.
- Integridade byte a byte dos arquivos originais de lógica, configuração e administração.
- Screenshots desktop e mobile revisados; recortes fotográficos e decoração ajustados.

## Limite da validação online
O ambiente de teste bloqueou a requisição à biblioteca Supabase em cdn.jsdelivr.net (ERR_EMPTY_RESPONSE). Assim, o modal e o estado de indisponibilidade foram verificados, mas não foi possível verificar disponibilidade real, autenticação ou gravação de agendamento. A URL, chave pública, integração e lógica originais foram mantidas integralmente. Nenhum agendamento foi criado durante os testes.

## Execução
Sirva a pasta `psicologa-site` com um servidor HTTP, por exemplo `python3 -m http.server 8080`, e abra `http://localhost:8080`. Publique a pasta completa na hospedagem existente.
