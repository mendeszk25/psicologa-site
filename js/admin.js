(() => {
  'use strict';

  const client = window.bookingSupabase || null;
  const doc = document;
  const login = doc.querySelector('[data-admin-login]');
  const app = doc.querySelector('[data-admin-app]');
  const logoutButton = doc.querySelector('[data-admin-logout]');
  const loginForm = doc.querySelector('[data-admin-login-form]');
  const loginError = doc.querySelector('[data-admin-login-error]');
  const settingsForm = doc.querySelector('[data-settings-form]');
  const settingsStatus = doc.querySelector('[data-settings-status]');
  const ruleForm = doc.querySelector('[data-rule-form]');
  const blockForm = doc.querySelector('[data-block-form]');
  const rulesList = doc.querySelector('[data-rules-list]');
  const blocksList = doc.querySelector('[data-blocks-list]');
  const appointmentsList = doc.querySelector('[data-appointments-list]');
  const dayNames = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const statusLabels = { pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado' };

  const localISO = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const formatDate = (value) => {
    const [y,m,d] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { weekday:'short', day:'2-digit', month:'short' }).format(new Date(y,m-1,d));
  };
  const time = (value) => String(value || '').slice(0,5);
  const safe = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  const showLogin = (message = '') => {
    login.hidden = false;
    app.hidden = true;
    logoutButton.hidden = true;
    if (loginError) loginError.textContent = message;
  };
  const showApp = () => { login.hidden = true; app.hidden = false; logoutButton.hidden = false; };

  if (!client) {
    showLogin('Configure supabaseUrl e supabaseAnonKey no config.js antes de usar a agenda.');
    loginForm?.querySelectorAll('input,button').forEach((el) => { el.disabled = true; });
    return;
  }

  const verifyAdmin = async () => {
    const { data, error } = await client.from('booking_settings').select('*').eq('id', 1).single();
    if (error || !data) {
      await client.auth.signOut();
      showLogin('Este usuário não está autorizado a administrar a agenda.');
      return false;
    }
    showApp();
    return true;
  };

  const loadSettings = async () => {
    const { data, error } = await client.from('booking_settings').select('*').eq('id',1).single();
    if (error || !data) return;
    ['duration_minutes','interval_minutes','minimum_notice_hours','booking_horizon_days','timezone'].forEach((key) => {
      if (settingsForm.elements[key]) settingsForm.elements[key].value = data[key] ?? '';
    });
  };

  const loadRules = async () => {
    const { data, error } = await client.from('availability_rules').select('*').order('weekday').order('start_time');
    if (error) { rulesList.innerHTML = '<p class="admin-empty">Não foi possível carregar a disponibilidade.</p>'; return; }
    if (!data.length) { rulesList.innerHTML = '<p class="admin-empty">Nenhum horário semanal configurado.</p>'; return; }
    rulesList.innerHTML = data.map((rule) => `
      <div class="admin-row">
        <p><strong>${dayNames[rule.weekday]}</strong><br><small>${time(rule.start_time)}–${time(rule.end_time)} · ${safe(rule.modality === 'ambos' ? 'Ambas' : rule.modality)}</small></p>
        <button class="admin-action danger" type="button" data-delete-rule="${rule.id}">Remover</button>
      </div>`).join('');
  };

  const loadBlocks = async () => {
    const today = localISO(new Date());
    const { data, error } = await client.from('blocked_periods').select('*').gte('blocked_date', today).order('blocked_date').order('start_time');
    if (error) { blocksList.innerHTML = '<p class="admin-empty">Não foi possível carregar os bloqueios.</p>'; return; }
    if (!data.length) { blocksList.innerHTML = '<p class="admin-empty">Nenhum bloqueio futuro.</p>'; return; }
    blocksList.innerHTML = data.map((block) => `
      <div class="admin-row">
        <p><strong>${formatDate(block.blocked_date)}</strong><br><small>${block.start_time ? `${time(block.start_time)}–${time(block.end_time)}` : 'Dia inteiro'}</small></p>
        <button class="admin-action danger" type="button" data-delete-block="${block.id}">Remover</button>
      </div>`).join('');
  };

  const loadAppointments = async () => {
    const today = localISO(new Date());
    const horizon = new Date(); horizon.setDate(horizon.getDate() + 60);
    const { data, error } = await client.from('appointments')
      .select('id,client_name,client_phone,client_email,appointment_date,start_time,modality,status')
      .gte('appointment_date', today)
      .lte('appointment_date', localISO(horizon))
      .order('appointment_date')
      .order('start_time');
    if (error) { appointmentsList.innerHTML = '<p class="admin-empty">Não foi possível carregar os atendimentos.</p>'; return; }

    const todayItems = data.filter((item) => item.appointment_date === today && item.status !== 'cancelled');
    const pending = data.filter((item) => item.status === 'pending');
    const confirmed = data.filter((item) => item.status === 'confirmed');
    doc.querySelector('[data-stat-today]').textContent = todayItems.length;
    doc.querySelector('[data-stat-pending]').textContent = pending.length;
    doc.querySelector('[data-stat-confirmed]').textContent = confirmed.length;
    doc.querySelector('[data-admin-today]').textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle:'full' }).format(new Date());

    if (!data.length) { appointmentsList.innerHTML = '<p class="admin-empty">Nenhum atendimento futuro.</p>'; return; }
    appointmentsList.innerHTML = data.map((item) => `
      <article class="admin-appointment">
        <div class="admin-appointment-head">
          <div><h3>${safe(item.client_name)}</h3><div class="admin-appointment-meta"><span>${formatDate(item.appointment_date)} · ${time(item.start_time)}</span><span>${safe(item.modality === 'online' ? 'Online' : 'Presencial')}</span><span>${safe(item.client_phone)}</span>${item.client_email ? `<span>${safe(item.client_email)}</span>` : ''}</div></div>
          <span class="admin-status" data-status="${item.status}">${statusLabels[item.status] || safe(item.status)}</span>
        </div>
        <div class="admin-row-actions">
          ${item.status === 'pending' ? `<button class="admin-action" type="button" data-status-id="${item.id}" data-status-value="confirmed">Confirmar</button>` : ''}
          ${item.status !== 'completed' && item.status !== 'cancelled' ? `<button class="admin-action" type="button" data-status-id="${item.id}" data-status-value="completed">Concluir</button>` : ''}
          ${item.status !== 'cancelled' ? `<button class="admin-action danger" type="button" data-status-id="${item.id}" data-status-value="cancelled">Cancelar</button>` : ''}
        </div>
      </article>`).join('');
  };

  const loadAll = async () => Promise.all([loadSettings(), loadRules(), loadBlocks(), loadAppointments()]);

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.textContent = 'Entrando…';
    const email = doc.getElementById('admin-email').value.trim();
    const password = doc.getElementById('admin-password').value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { loginError.textContent = 'Não foi possível entrar. Confira e-mail e senha.'; return; }
    if (await verifyAdmin()) await loadAll();
  });

  logoutButton?.addEventListener('click', async () => { await client.auth.signOut(); showLogin(); });
  doc.querySelector('[data-admin-refresh]')?.addEventListener('click', loadAppointments);

  settingsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    settingsStatus.textContent = 'Salvando…';
    const payload = {
      duration_minutes: Number(settingsForm.elements.duration_minutes.value),
      interval_minutes: Number(settingsForm.elements.interval_minutes.value),
      minimum_notice_hours: Number(settingsForm.elements.minimum_notice_hours.value),
      booking_horizon_days: Number(settingsForm.elements.booking_horizon_days.value),
      timezone: settingsForm.elements.timezone.value.trim()
    };
    const { error } = await client.from('booking_settings').update(payload).eq('id',1);
    settingsStatus.textContent = error ? 'Não foi possível salvar.' : 'Configurações salvas.';
  });

  ruleForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(ruleForm);
    const payload = Object.fromEntries(data.entries());
    payload.weekday = Number(payload.weekday);
    const { error } = await client.from('availability_rules').insert(payload);
    if (!error) { ruleForm.reset(); await loadRules(); }
  });

  blockForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(blockForm);
    const payload = Object.fromEntries(data.entries());
    if (!payload.start_time && !payload.end_time) { payload.start_time = null; payload.end_time = null; }
    if ((payload.start_time && !payload.end_time) || (!payload.start_time && payload.end_time)) return;
    const { error } = await client.from('blocked_periods').insert(payload);
    if (!error) { blockForm.reset(); await loadBlocks(); }
  });

  rulesList?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-rule]');
    if (!button) return;
    await client.from('availability_rules').delete().eq('id', button.dataset.deleteRule);
    await loadRules();
  });

  blocksList?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-block]');
    if (!button) return;
    await client.from('blocked_periods').delete().eq('id', button.dataset.deleteBlock);
    await loadBlocks();
  });

  appointmentsList?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-status-id]');
    if (!button) return;
    button.disabled = true;
    await client.from('appointments').update({ status: button.dataset.statusValue }).eq('id', button.dataset.statusId);
    await loadAppointments();
  });

  client.auth.getSession().then(async ({ data }) => {
    if (!data.session) { showLogin(); return; }
    if (await verifyAdmin()) await loadAll();
  });
})();
