/*
  Dados centralizados para edição rápida.
  Preencha somente informações confirmadas pela profissional.
  Enquanto siteUrl/WhatsApp/e-mail estiverem vazios, o site mantém fallbacks seguros.
*/
window.SITE_CONFIG = {
  nome: 'Silvana Delacio',
  tituloProfissional: 'Terapeuta Integrativa',
  apresentacao: 'Professora com especialização em Educação e Capacitação Pedagógica pela UFRPE, Terapeuta Integrativa com formação pelo IBTRG/CITRG e arte-educadora em projetos sociais do MUCA.',
  conducao: 'Sua trajetória reúne educação, arte-educação e terapia integrativa. Hoje, esse percurso se traduz em uma condução atenta à história, ao momento e às necessidades de cada pessoa.',

  // Preencha quando houver domínio oficial publicado, ex.: https://exemplo.com.br/
  siteUrl: '',
  ogImage: 'assets/og-image.webp',

  // Número real do WhatsApp da profissional, com DDI+DDD, apenas dígitos (ex.: 5581999999999).
  // Enquanto vazio, os botões de contato usam o Instagram abaixo como alternativa.
  whatsapp: '',
  mensagemWhatsapp: 'Olá, Silvana. Encontrei seu site e gostaria de conversar sobre um atendimento.',
  instagram: 'https://www.instagram.com/terapeutasilvanadelacio/',
  // E-mail real da profissional. Só é exibido quando for um e-mail válido.
  email: '',

  // Chaves PÚBLICAS do Supabase (URL + anon key). É seguro que fiquem no frontend:
  // elas não dão acesso a nada que as políticas de RLS do banco não permitam.
  // NUNCA coloque aqui a service_role key nem qualquer chave privada/administrativa.
  supabaseUrl: 'https://gvwqpkzgblrlmugyvzmc.supabase.co',
  supabaseAnonKey: 'sb_publishable_t1FjJvqrp1Rl4AdCyY0I6g_p-8iTtbP',

  // A área administrativa (/admin/) usa exclusivamente Supabase Auth (e-mail + senha).
  // Não existe mais um "modo de teste" que libera o painel sem login — veja
  // PRODUCTION_SECURITY_SETUP.md para criar o usuário administrador.

  modalidades: ['Presencial', 'Online'],
  localizacao: 'A localização detalhada é informada durante o agendamento.',
  duracao: 'A duração é informada pela profissional durante o agendamento.'
};
