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

  whatsapp: '',
  mensagemWhatsapp: 'Olá, Silvana. Encontrei seu site e gostaria de conversar sobre um atendimento.',
  instagram: 'https://www.instagram.com/terapeutasilvanadelacio/',
  email: '',

  // Chaves públicas do Supabase para ativar o agendamento. Nunca use service_role aqui.
  supabaseUrl: 'https://gvwqpkzgblrlmugyvzmc.supabase.co',
  supabaseAnonKey: 'sb_publishable_t1FjJvqrp1Rl4AdCyY0I6g_p-8iTtbP',

  modalidades: ['Presencial', 'Online'],
  localizacao: 'A localização detalhada é informada durante o agendamento.',
  duracao: 'A duração é informada pela profissional durante o agendamento.'
};
