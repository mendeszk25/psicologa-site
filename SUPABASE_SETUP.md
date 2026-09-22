# Configuração do agendamento no Supabase

O site funciona como página institucional mesmo sem Supabase. O agendamento online só é ativado quando `supabaseUrl` e `supabaseAnonKey` estiverem preenchidos em `config.js` e o banco estiver configurado.

## 1. Criar o projeto

Crie um projeto no Supabase e abra **SQL Editor**.

Execute o arquivo:

`supabase/schema.sql`

Ele cria:

- `booking_settings`
- `availability_rules`
- `blocked_periods`
- `appointments`
- políticas RLS
- funções públicas seguras para consultar horários e reservar
- proteção contra reserva concorrente do mesmo horário

## 2. Criar a conta administrativa

Em **Authentication → Users**, crie manualmente a conta que a Silvana usará no `/admin/`.

Copie o UUID do usuário.

Depois execute no SQL Editor, substituindo o UUID:

```sql
update public.booking_settings
set admin_user_id = 'COLE-O-UUID-AQUI'
where id = 1;
```

Somente esse usuário poderá ler nomes, telefones, e-mails e administrar a agenda.

## 3. Configurar a chave pública no site

Em **Project Settings → API**, copie:

- Project URL
- anon / publishable key

Preencha em `config.js`:

```js
supabaseUrl: 'https://SEU-PROJETO.supabase.co',
supabaseAnonKey: 'SUA_CHAVE_PUBLICA',
```

A chave anônima/publishable é pública por definição. **Nunca** coloque `service_role` no front-end.

## 4. Entrar no painel

Abra:

`/admin/`

Faça login com a conta criada no Supabase Auth.

Na primeira configuração, defina no painel:

- duração do atendimento
- intervalo entre atendimentos
- antecedência mínima
- quantidade de dias futuros disponíveis
- fuso horário IANA (ex.: `America/Recife` somente se este for realmente o fuso usado pela profissional)

Nenhum desses valores é inventado no projeto: enquanto faltarem, a agenda pública não oferece horários.

## 5. Criar disponibilidade semanal

No painel, adicione cada intervalo real de atendimento, por exemplo:

- dia da semana
- modalidade (presencial, online ou ambas)
- hora inicial
- hora final

O sistema gera os slots a partir da duração e do intervalo configurados.

## 6. Bloqueios

O painel permite bloquear:

- dia inteiro
- período específico

Bloqueios removem automaticamente esses horários da agenda pública.

## 7. Status dos agendamentos

Novas reservas entram como **Pendente**.

No painel é possível mudar para:

- Confirmado
- Concluído
- Cancelado

Reservas `cancelled` deixam de bloquear o horário.

## 8. Segurança

A agenda pública não possui permissão para listar a tabela `appointments`.

O visitante só recebe:

- dias disponíveis
- horários disponíveis
- resultado da própria tentativa de reserva

Os dados pessoais ficam legíveis apenas para o usuário administrativo definido em `booking_settings.admin_user_id`.

## 9. Dados que ainda precisam ser confirmados pela Silvana

Para publicar a agenda, confirme:

- duração de cada atendimento
- intervalo entre atendimentos
- antecedência mínima para reserva
- horizonte de agenda (quantos dias à frente)
- fuso horário real usado na agenda
- disponibilidade semanal
- WhatsApp real, se quiser mostrar o botão após a confirmação

Não é necessário coletar diagnóstico, sintomas, motivo do atendimento ou outras informações clínicas.
