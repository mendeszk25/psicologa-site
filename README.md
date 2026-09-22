# Silvana Delacio — Terapia Integrativa

Site institucional one-page com apresentação profissional, temas de acompanhamento, processo de atendimento, modalidades presencial/online, FAQ e contato.

## Arquivos principais
- `index.html` — estrutura, conteúdo, SEO básico e dados estruturados.
- `styles.css` — identidade visual consolidada, responsividade e microinterações.
- `main.js` — contatos, menu mobile, FAQ, navegação ativa, eventos de analytics e SEO dependente do domínio.
- `config.js` — dados que mudam com frequência sem necessidade de editar o layout.
- `assets/` — fotografias, SVGs, favicon e `og-image.webp` (1200×630).
- `robots.txt` — instrução básica para indexação.

## Configuração antes da publicação
Edite apenas informações reais em `config.js`:

- `siteUrl`: domínio HTTPS oficial. Ao ser preenchido, o JavaScript cria `canonical`, `og:url`, `og:image` e `twitter:image` com URL absoluta.
- `whatsapp`: número com DDI/DDD, apenas dígitos. Enquanto estiver vazio, os CTAs usam o Instagram configurado como fallback.
- `email`: opcional; só será exibido quando houver um e-mail válido.
- `localizacao` e `duracao`: mantenha apenas o que a profissional quiser divulgar.

Não invente telefone, endereço, preço, horários, registro profissional ou qualquer outra informação ainda não confirmada.

## Open Graph
A imagem `assets/og-image.webp` já está preparada em 1200×630. O meta `og:image` só é ativado quando `siteUrl` estiver configurado para evitar publicar uma URL fictícia.

## Analytics
O projeto não inclui rastreador externo. Interações importantes disparam:

- eventos em `window.dataLayer`, caso um analytics seja conectado futuramente;
- um evento customizado `site:analytics` no `window`.

Já estão preparados eventos para CTAs, Instagram, WhatsApp, menu e abertura de perguntas do FAQ.

## Performance e acessibilidade
- Hero prioritário, sem lazy-loading.
- Imagens abaixo da dobra com `loading="lazy"`.
- `prefers-reduced-motion` respeitado.
- Menu por teclado/Escape.
- FAQ com `<details>/<summary>` e estado `aria-expanded` sincronizado.
- `focus-visible`, skip link e landmarks semânticos.

## Sistema de agendamento

O projeto inclui agora um fluxo de agendamento integrado ao site:

- modalidade presencial ou online;
- calendário com dias disponíveis;
- horários calculados pelo Supabase;
- nome, WhatsApp e e-mail opcional;
- confirmação com status inicial `pending`;
- proteção de conflito no banco;
- painel administrativo em `/admin/`;
- disponibilidade semanal e bloqueios;
- RLS para impedir leitura pública dos dados dos clientes.

A agenda permanece desativada de forma segura até o Supabase ser configurado. Veja `SUPABASE_SETUP.md` e rode `supabase/schema.sql`.
