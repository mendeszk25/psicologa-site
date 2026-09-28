# Configurar o acesso administrativo com segurança (passo a passo)

Este guia é para quem **não** conhece Supabase. Siga na ordem. No final, `/admin/`
só vai abrir para quem tiver e-mail e senha corretos, e os dados dos clientes
(nome, WhatsApp, e-mail) ficam protegidos.

Antes de começar: o "modo de teste" do painel (que abria `/admin/` sem login)
**foi removido do código**. Sem completar os passos abaixo, `/admin/` vai
mostrar a tela de login, mas ninguém (nem você) conseguirá entrar até criar o
usuário administrador.

---

## 1. Entrar no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login.
2. Abra o projeto usado por este site (o mesmo cuja URL está em `config.js`,
   em `supabaseUrl`).

## 2. Criar o usuário administrador

1. No menu lateral, clique em **Authentication**.
2. Clique em **Users** (ou "Usuários").
3. Clique em **Add user** → **Create new user**.
4. Preencha:
   - **E-mail**: o e-mail que Silvana vai usar para entrar em `/admin/`.
   - **Password**: uma senha forte (guarde em local seguro).
5. Deixe marcado "Auto Confirm User" (para não precisar confirmar por e-mail).
6. Clique em **Create user**.

## 3. Copiar o UUID do usuário criado

1. Ainda em **Authentication → Users**, clique no usuário que você acabou de criar.
2. Copie o valor do campo **UID** (um código como
   `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

## 4. Marcar esse usuário como administrador da agenda

1. No menu lateral, clique em **SQL Editor**.
2. Clique em **New query**.
3. Cole o comando abaixo, **substituindo** `COLE-O-UUID-AQUI` pelo UID copiado
   no passo 3 (mantenha as aspas):

   ```sql
   update public.booking_settings
   set admin_user_id = 'COLE-O-UUID-AQUI'
   where id = 1;
   ```

4. Clique em **Run** (ou "Executar").
5. Deve aparecer "Success. No rows returned" ou similar — sem mensagens de erro.

## 5. Aplicar a migration de segurança

1. Ainda no **SQL Editor**, abra uma nova query.
2. Abra o arquivo `supabase/migrations/20260926_secure_admin_production.sql`
   deste projeto, copie todo o conteúdo e cole no SQL Editor.
3. Clique em **Run**.
4. Deve terminar sem mensagens de erro (mensagens do tipo "NOTICE" são normais
   e podem ser ignoradas).

Essa migration remove as funções de teste do banco e garante que só a conta
que você configurou no passo 4 consiga acessar dados de agendamentos.

> Se este for um projeto **novo**, que ainda não rodou nada: rode primeiro
> `supabase/schema.sql` inteiro no SQL Editor, depois faça os passos 2 a 5
> normalmente. Não é necessário rodar as migrations antigas
> (`20260922_*.sql`) — elas eram só do modo de teste, que não existe mais.

## 6. Conferir o `config.js`

Abra `config.js` e confirme que:

- `supabaseUrl` e `supabaseAnonKey` são os do seu projeto (a chave pública
  `anon`/`publishable` — nunca a `service_role`);
- **não existe mais** a linha `adminTestMode` (ela foi removida do código).

Não é preciso alterar mais nada aqui para a parte de segurança.

## 7. Testar o `/admin/`

1. Publique/suba os arquivos atualizados no seu servidor (ou abra localmente).
2. Acesse `/admin/`.
3. Você deve ver a tela **"Entrar na agenda"**, pedindo e-mail e senha.
4. Entre com o e-mail e a senha criados no passo 2.
5. O painel deve abrir normalmente em **Hoje**, mostrando a agenda.
6. Atualize a página (F5): você deve continuar logada, sem precisar entrar de novo.
7. Clique em **Sair**: você deve voltar para a tela de login.
8. Tente entrar com uma senha errada: deve aparecer apenas
   **"E-mail ou senha incorretos."** (nenhuma mensagem técnica).

Se em vez da tela de login aparecer "Painel administrativo ainda não
configurado", volte ao passo 4 — o `admin_user_id` não foi salvo corretamente.

## 8. Testar o agendamento público (sem estar logada)

Em uma aba anônima/privada do navegador (ou em outro navegador):

1. Abra o site normal (não o `/admin/`).
2. Clique em **"Agendar uma conversa"**.
3. Escolha Presencial ou Online.
4. Verifique se os dias e horários aparecem (você precisa ter cadastrado ao
   menos um horário em **Meus horários**, dentro de `/admin/`, e ter
   preenchido **Configurações avançadas**: duração, intervalo, antecedência
   mínima, dias no futuro e fuso horário).
5. Complete um agendamento de teste e confirme que ele aparece em **Hoje** ou
   **Próximas consultas** dentro de `/admin/`.
6. Cancele esse agendamento de teste em `/admin/` para não confundir com
   agendamentos reais.

## 9. O que NÃO fazer

- Não coloque a chave `service_role` do Supabase em nenhum arquivo do site
  (`config.js`, HTML, JS). Ela é secreta e nunca deve sair do painel do
  Supabase.
- Não crie outros usuários em **Authentication → Users** pensando em dar
  acesso ao painel — só o UUID salvo em `booking_settings.admin_user_id`
  (passo 4) consegue entrar em `/admin/`. Se precisar trocar quem administra,
  repita o passo 4 com o novo UUID.
- Não reative um "modo de teste": ele foi removido do código de propósito,
  porque deixava dados de clientes (nome, telefone, e-mail) acessíveis para
  qualquer visitante do site.

---

Dúvidas técnicas sobre o que foi corrigido e por quê: veja o resumo no final
da conversa com o desenvolvedor, ou o topo do arquivo
`supabase/migrations/20260926_secure_admin_production.sql`.
