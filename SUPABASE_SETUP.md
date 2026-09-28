# Configuração do agendamento no Supabase

O site institucional funciona sem login para visitantes. O agendamento público
usa apenas a chave pública do Supabase e as RPCs seguras definidas em
`supabase/schema.sql` (`get_available_days`, `get_available_slots` e
`book_appointment`).

A área administrativa (`/admin/`) usa **Supabase Auth** (e-mail e senha) e só
funciona depois de configurar um usuário administrador. Se você está
configurando o painel pela primeira vez, siga **`PRODUCTION_SECURITY_SETUP.md`**
— ele tem o passo a passo completo, escrito para quem não conhece Supabase.

Este arquivo cobre apenas a parte de banco de dados / schema.

## 1. Banco de dados

Em um projeto novo, execute no **SQL Editor** o arquivo:

`supabase/schema.sql`

Ele cria as tabelas, ativa RLS (row level security), e cria as funções
públicas de agendamento (`get_available_days`, `get_available_slots`,
`book_appointment`) e as funções auxiliares de autorização
(`is_booking_admin`, `is_booking_admin_configured`).

### Projeto que já executou versões anteriores do schema

Se o seu projeto já tinha as funções `admin_test_*` (modo de teste, hoje
removido), execute também:

`supabase/migrations/20260926_secure_admin_production.sql`

Essa migration remove essas funções de teste, revoga qualquer acesso anônimo
a elas, e reafirma as políticas de RLS corretas — sem apagar agendamentos,
horários ou bloqueios já cadastrados.

## 2. Chave pública do Supabase

Em `config.js`, mantenha somente:

```js
supabaseUrl: 'https://SEU-PROJETO.supabase.co',
supabaseAnonKey: 'SUA_CHAVE_PUBLICA',
```

Nunca coloque `service_role`, `sb_secret`, senha ou token administrativo no
frontend. A chave `anon`/`publishable` é segura de ficar pública: ela não dá
acesso a nada que as políticas de RLS não permitam.

## 3. Configurar o administrador

Veja `PRODUCTION_SECURITY_SETUP.md`. Resumo:

1. crie o usuário em **Authentication → Users**;
2. copie o UID;
3. rode no SQL Editor:
   ```sql
   update public.booking_settings
   set admin_user_id = 'COLE-O-UUID-AQUI'
   where id = 1;
   ```
4. entre em `/admin/` com o e-mail e senha criados.

## 4. Usar o painel (`/admin/`)

Depois de logada, em **Meus horários**:

### Presencial

1. selecione a aba **Presencial**;
2. escolha o dia;
3. clique em **+ Adicionar horário**;
4. informe início e fim;
5. salve.

### Online

1. selecione a aba **Online**;
2. escolha o dia;
3. clique em **+ Adicionar horário**;
4. informe início e fim;
5. salve.

As duas agendas são independentes e o calendário público respeita a
modalidade escolhida.

## 5. Configurações gerais

No painel, em **Configurações avançadas**, preencha:

- duração da sessão;
- intervalo entre sessões;
- antecedência mínima;
- dias futuros disponíveis;
- fuso horário IANA (ex.: `America/Recife`).

O calendário público só gera horários quando essas configurações essenciais
estiverem preenchidas.

## 6. Bloqueios

Em **Dias que não vou atender**, informe a data para bloquear o dia inteiro.

Os bloqueios são considerados automaticamente por `get_available_days()` e
`get_available_slots()`.

## 7. Agendamento do visitante

O fluxo público:

1. escolher Presencial ou Online;
2. escolher um dia disponível;
3. escolher um horário;
4. informar nome e WhatsApp;
5. informar e-mail somente se quiser;
6. confirmar.

As reservas entram com status `pending` e continuam protegidas por RLS e pela
lógica de conflito do banco (`book_appointment` usa um lock transacional para
impedir dupla reserva do mesmo horário).

## 8. Segurança

- RLS está ativo em `appointments`, `availability_rules`, `blocked_periods` e
  `booking_settings`.
- `appointments` nunca é legível por `anon` — apenas pela conta administradora
  autenticada (validada por `is_booking_admin()`).
- As únicas funções que `anon` pode chamar são `get_available_days`,
  `get_available_slots` e `book_appointment`, e nenhuma delas retorna dados de
  outros clientes.
- `service_role` nunca vai para o navegador.

## Correção do painel de disponibilidade (histórico)

Se você está atualizando um projeto muito antigo e o painel mostra os dias mas
não consegue salvar horários, isso era um problema do modo de teste (RPCs
`admin_test_*`), que foi completamente removido. Depois de aplicar
`supabase/migrations/20260926_secure_admin_production.sql` e configurar o
administrador (`PRODUCTION_SECURITY_SETUP.md`), o painel usa consultas
diretas às tabelas (protegidas por RLS) e não depende mais dessas RPCs.
