(() => {
  'use strict';

  const doc = document;
  const client = window.bookingSupabase || null;

  const unconfigured = doc.querySelector('[data-admin-unconfigured]');
  const login = doc.querySelector('[data-admin-login]');
  const app = doc.querySelector('[data-admin-app]');
  const logoutButton = doc.querySelector('[data-admin-logout]');
  const loginForm = doc.querySelector('[data-admin-login-form]');
  const loginError = doc.querySelector('[data-admin-login-error]');
  const globalFeedback = doc.querySelector('[data-admin-global-feedback]');

  const navButtons = [...doc.querySelectorAll('[data-admin-view-target]')];
  const views = [...doc.querySelectorAll('[data-admin-view]')];
  const todayDate = doc.querySelector('[data-today-date]');
  const todayCount = doc.querySelector('[data-today-count]');
  const todayList = doc.querySelector('[data-today-list]');
  const dayKicker = doc.querySelector('[data-day-kicker]');
  const dayPick = doc.querySelector('[data-day-pick]');
  const upcomingList = doc.querySelector('[data-upcoming-list]');

  const settingsForm = doc.querySelector('[data-settings-form]');
  const settingsStatus = doc.querySelector('[data-settings-status]');
  const weeklyEditor = doc.querySelector('[data-weekly-editor]');
  const rulesStatus = doc.querySelector('[data-rules-status]');
  const modalityTabs = [...doc.querySelectorAll('[data-modality-tab]')];
  const modalityTitle = doc.querySelector('[data-modality-title]');
  const modalityCopy = doc.querySelector('[data-modality-copy]');

  const blockForm = doc.querySelector('[data-block-form]');
  const blocksStatus = doc.querySelector('[data-blocks-status]');
  const blocksList = doc.querySelector('[data-blocks-list]');

  const ruleDialog = doc.querySelector('[data-rule-dialog]');
  const ruleDialogForm = doc.querySelector('[data-rule-dialog-form]');
  const ruleDialogTitle = doc.querySelector('[data-rule-dialog-title]');
  const ruleDialogContext = doc.querySelector('[data-rule-dialog-context]');
  const ruleDialogError = doc.querySelector('[data-rule-dialog-error]');
  const ruleDaysBox = doc.querySelector('[data-rule-days]');
  const ruleDaysGrid = doc.querySelector('[data-rule-days-grid]');

  const cancelDialog = doc.querySelector('[data-cancel-dialog]');
  const cancelDialogContext = doc.querySelector('[data-cancel-dialog-context]');
  const cancelConfirmButton = doc.querySelector('[data-cancel-dialog-confirm]');

  const weekDays = [
    { value: 1, label: 'Segunda-feira' },
    { value: 2, label: 'Terça-feira' },
    { value: 3, label: 'Quarta-feira' },
    { value: 4, label: 'Quinta-feira' },
    { value: 5, label: 'Sexta-feira' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' }
  ];

  const statusLabels = {
    pending: 'Aguardando confirmação',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado'
  };

  let activeView = 'today';
  let selectedDay = '';
  let activeModality = 'presencial';
  let rules = [];
  let blocks = [];
  let currentSettings = null;
  let cancelTarget = null;

  const safe = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const pad = (n) => String(n).padStart(2, '0');
  const localISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseISODate = (value) => {
    const [y, m, d] = String(value).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  };
  const time = (value) => String(value || '').slice(0, 5);
  const dayName = (weekday) => weekDays.find((day) => day.value === Number(weekday))?.label || 'Dia';
  const formatDateFull = (value) => new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(parseISODate(value));
  const formatDateShort = (value) => new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long'
  }).format(parseISODate(value));

  const setFeedback = (node, message, isError = false) => {
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('is-error', Boolean(isError));
  };

  const showUnconfigured = () => {
    if (unconfigured) unconfigured.hidden = false;
    if (login) login.hidden = true;
    if (app) app.hidden = true;
    if (logoutButton) logoutButton.hidden = true;
  };

  const showLogin = (message = '') => {
    if (unconfigured) unconfigured.hidden = true;
    if (login) login.hidden = false;
    if (app) app.hidden = true;
    if (logoutButton) logoutButton.hidden = true;
    if (loginError) loginError.textContent = message;
  };

  const showApp = () => {
    if (unconfigured) unconfigured.hidden = true;
    if (login) login.hidden = true;
    if (app) app.hidden = false;
    if (logoutButton) logoutButton.hidden = false;
  };

  if (!client) {
    showUnconfigured();
    return;
  }

  // Sessão perdida/expirada de forma inesperada (RLS negou uma chamada, o
  // token expirou, ou a pessoa saiu em outra aba): volta para o login e
  // garante que nenhuma tela continue mostrando dados administrativos.
  // `expectedSignOut` marca os sign-outs que o próprio painel já pediu
  // (logout manual, ou "usuário não autorizado"), que tratam sua própria
  // tela e não devem disparar a mensagem genérica de sessão expirada.
  let expectedSignOut = false;
  let sessionLostHandled = false;
  const handleSessionLost = () => {
    if (expectedSignOut) { expectedSignOut = false; return; }
    if (sessionLostHandled) return;
    sessionLostHandled = true;
    showLogin('Sua sessão expirou. Entre novamente.');
  };

  // Todas as operações abaixo dependem de uma sessão autenticada no Supabase.
  // As tabelas têm RLS habilitado e só permitem leitura/escrita quando
  // is_booking_admin() é verdadeiro para o usuário logado (ver supabase/schema.sql
  // e supabase/migrations/20260926_secure_admin_production.sql). Se a pessoa
  // logada não for a administradora configurada, o banco recusa a operação
  // mesmo que o código do painel tente executá-la.
  const api = {
    async listAppointments(startDate, endDate) {
      return client.from('appointments')
        .select('id,client_name,client_phone,client_email,appointment_date,start_time,modality,status')
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date')
        .order('start_time');
    },
    async updateAppointmentStatus(id, status) {
      return client.from('appointments').update({ status }).eq('id', id);
    },
    async getSettings() {
      return client.from('booking_settings')
        .select('duration_minutes,interval_minutes,minimum_notice_hours,booking_horizon_days,timezone')
        .eq('id', 1)
        .single();
    },
    async updateSettings(payload) {
      return client.from('booking_settings').update(payload).eq('id', 1);
    },
    async listRules(modality) {
      return client.from('availability_rules')
        .select('id,weekday,modality,start_time,end_time,is_active')
        .eq('modality', modality)
        .order('weekday')
        .order('start_time');
    },
    async createRule(payload) {
      return client.from('availability_rules').insert({
        weekday: payload.weekday,
        modality: payload.modality,
        start_time: payload.start_time,
        end_time: payload.end_time,
        is_active: true
      });
    },
    async createRules(list) {
      return client.from('availability_rules').insert(list.map((payload) => ({
        weekday: payload.weekday,
        modality: payload.modality,
        start_time: payload.start_time,
        end_time: payload.end_time,
        is_active: true
      })));
    },
    async updateRule(payload) {
      return client.from('availability_rules').update({
        weekday: payload.weekday,
        modality: payload.modality,
        start_time: payload.start_time,
        end_time: payload.end_time,
        is_active: true
      }).eq('id', payload.id);
    },
    async deleteRule(id) {
      return client.from('availability_rules').delete().eq('id', id);
    },
    async listBlocks() {
      return client.from('blocked_periods')
        .select('id,blocked_date,start_time,end_time')
        .gte('blocked_date', localISO(new Date()))
        .order('blocked_date')
        .order('start_time');
    },
    async createBlock(payload) {
      return client.from('blocked_periods').insert({
        blocked_date: payload.blocked_date,
        start_time: payload.start_time || null,
        end_time: payload.end_time || null
      });
    },
    async deleteBlock(id) {
      return client.from('blocked_periods').delete().eq('id', id);
    },
    async getAvailableSlots(date, modality) {
      return client.rpc('get_available_slots', { p_date: date, p_modality: modality });
    },
    async createAppointment(payload) {
      return client.rpc('book_appointment', {
        p_client_name: payload.client_name,
        p_client_phone: payload.client_phone,
        p_client_email: null,
        p_date: payload.appointment_date,
        p_start_time: payload.start_time,
        p_modality: payload.modality
      });
    }
  };

  // Nunca repassamos o erro técnico do Supabase/Postgres para a tela.
  // Tudo vira uma mensagem simples; o detalhe fica só no console (dev).
  const isAuthError = (message) => (
    message.includes('JWT') ||
    message.includes('jwt') ||
    message.includes('PGRST301') ||
    message.includes('permission denied') ||
    message.includes('row-level security')
  );

  const mapRpcError = (error, fallback = 'Não foi possível concluir esta ação. Tente novamente.') => {
    const message = String(error?.message || '');
    if (isAuthError(message)) {
      handleSessionLost();
      return 'Sua sessão expirou. Entre novamente.';
    }
    return fallback;
  };

  const formatPhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
    if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
    if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
    return digits ? `+${digits}` : 'Não informado';
  };

  const whatsappUrl = (appointment) => {
    let digits = String(appointment.client_phone || '').replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    if (!/^[1-9]\d{9,14}$/.test(digits)) return '';
    const message = `Olá, ${appointment.client_name}. Aqui é Silvana. Estou entrando em contato sobre seu atendimento marcado para ${formatDateShort(appointment.appointment_date)} às ${time(appointment.start_time)}.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  };

  const appointmentCard = (item) => {
    const status = statusLabels[item.status] || 'Consulta';
    const wa = whatsappUrl(item);
    const actions = [];

    if (item.status === 'pending') {
      actions.push(`<button class="admin-action primary" type="button" data-appointment-status="confirmed" data-appointment-id="${item.id}">Confirmar consulta</button>`);
    }
    if (wa && item.status !== 'cancelled') {
      actions.push(`<a class="admin-action whatsapp" href="${safe(wa)}" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>`);
    }
    if (item.status === 'confirmed') {
      actions.push(`<button class="admin-action" type="button" data-appointment-status="completed" data-appointment-id="${item.id}">Marcar como concluída</button>`);
    }
    if (item.status === 'pending' || item.status === 'confirmed') {
      actions.push(`<button class="admin-action danger" type="button" data-cancel-appointment="${item.id}" data-client-name="${safe(item.client_name)}" data-appointment-time="${time(item.start_time)}">Cancelar</button>`);
    }

    return `
      <article class="admin-appointment-card${item.status === 'cancelled' ? ' is-cancelled' : ''}" data-appointment-card="${item.id}">
        <div class="admin-appointment-time">${time(item.start_time)}</div>
        <div class="admin-appointment-content">
          <div class="admin-appointment-top">
            <div>
              <h3 class="admin-appointment-name">${safe(item.client_name)}</h3>
              <div class="admin-appointment-info">
                <span><strong>${item.modality === 'online' ? 'Online' : 'Presencial'}</strong></span>
                <span>WhatsApp: ${safe(formatPhone(item.client_phone))}</span>
              </div>
            </div>
            <span class="admin-status" data-status="${safe(item.status)}">${safe(status)}</span>
          </div>
          ${actions.length ? `<div class="admin-appointment-actions">${actions.join('')}</div>` : ''}
        </div>
      </article>`;
  };

  const showAppointmentsError = (container, error) => {
    console.error('[agenda] Falha ao carregar consultas', error);
    container.innerHTML = '<p class="admin-empty">Não foi possível carregar sua agenda. Tente novamente.</p>';
    setFeedback(globalFeedback, mapRpcError(error, 'Não foi possível carregar sua agenda. Tente novamente.'), true);
  };

  const loadToday = async () => {
    const today = localISO(new Date());
    if (!selectedDay) selectedDay = today;
    const day = selectedDay;
    const isToday = day === today;
    todayDate.textContent = formatDateFull(day);
    if (dayKicker) dayKicker.textContent = isToday ? 'Agenda de hoje' : 'Agenda do dia';
    if (dayPick) dayPick.value = day;
    todayList.innerHTML = '<p class="admin-empty">Carregando sua agenda…</p>';
    todayCount.textContent = 'Carregando sua agenda…';
    setFeedback(globalFeedback, '');

    const { data, error } = await api.listAppointments(day, day);
    if (day !== selectedDay) return;
    if (error) {
      todayCount.textContent = 'Não foi possível carregar as consultas.';
      showAppointmentsError(todayList, error);
      return;
    }
    const appointments = Array.isArray(data) ? data : [];
    const activeCount = appointments.filter((item) => item.status !== 'cancelled').length;
    const when = isToday ? 'hoje' : 'neste dia';
    todayCount.textContent = activeCount === 0 ? `Nenhuma consulta ${when}` : activeCount === 1 ? `1 consulta ${when}` : `${activeCount} consultas ${when}`;
    todayList.innerHTML = appointments.length
      ? appointments.map(appointmentCard).join('')
      : `<p class="admin-empty">Nenhuma consulta marcada ${isToday ? 'para hoje' : 'para este dia'}.</p>`;
  };

  const goToDay = (iso) => {
    if (!iso) return;
    selectedDay = iso;
    loadToday();
  };
  doc.querySelector('[data-day-prev]')?.addEventListener('click', () => goToDay(localISO(addDays(parseISODate(selectedDay || localISO(new Date())), -1))));
  doc.querySelector('[data-day-next]')?.addEventListener('click', () => goToDay(localISO(addDays(parseISODate(selectedDay || localISO(new Date())), 1))));
  doc.querySelector('[data-day-today]')?.addEventListener('click', () => goToDay(localISO(new Date())));
  dayPick?.addEventListener('change', () => goToDay(dayPick.value));

  const dateGroupTitle = (iso) => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    if (iso === localISO(tomorrow)) return `Amanhã · ${formatDateShort(iso)}`;
    return formatDateShort(iso);
  };

  const loadUpcoming = async () => {
    const start = addDays(new Date(), 1);
    const end = addDays(new Date(), 90);
    upcomingList.innerHTML = '<p class="admin-empty">Carregando sua agenda…</p>';
    setFeedback(globalFeedback, '');

    const { data, error } = await api.listAppointments(localISO(start), localISO(end));
    if (error) {
      showAppointmentsError(upcomingList, error);
      return;
    }
    const appointments = (Array.isArray(data) ? data : []).filter((item) => item.status === 'pending' || item.status === 'confirmed');
    if (!appointments.length) {
      upcomingList.innerHTML = '<p class="admin-empty">Não há novas consultas agendadas.</p>';
      return;
    }

    const groups = appointments.reduce((acc, item) => {
      (acc[item.appointment_date] ||= []).push(item);
      return acc;
    }, {});

    upcomingList.innerHTML = Object.entries(groups).map(([date, items]) => `
      <section class="admin-date-group">
        <h3 class="admin-date-group-title">${safe(dateGroupTitle(date))}</h3>
        ${items.map(appointmentCard).join('')}
      </section>`).join('');
  };

  const refreshVisibleAppointments = async () => {
    await loadToday();
    if (activeView === 'upcoming') await loadUpcoming();
  };

  const updateAppointment = async (id, status, button = null) => {
    if (button) button.disabled = true;
    setFeedback(globalFeedback, status === 'confirmed' ? 'Confirmando consulta…' : status === 'completed' ? 'Marcando como concluída…' : 'Cancelando consulta…');
    const { error } = await api.updateAppointmentStatus(id, status);
    if (button) button.disabled = false;
    if (error) {
      console.error('[agenda] Falha ao alterar consulta', { id, status, error });
      setFeedback(globalFeedback, mapRpcError(error), true);
      return false;
    }
    const message = status === 'confirmed' ? 'Consulta confirmada.' : status === 'completed' ? 'Consulta concluída.' : 'Consulta cancelada.';
    await refreshVisibleAppointments();
    setFeedback(globalFeedback, message);
    return true;
  };

  const handleAppointmentClick = async (event) => {
    const statusButton = event.target.closest('[data-appointment-status]');
    if (statusButton) {
      await updateAppointment(statusButton.dataset.appointmentId, statusButton.dataset.appointmentStatus, statusButton);
      return;
    }
    const cancelButton = event.target.closest('[data-cancel-appointment]');
    if (cancelButton) {
      cancelTarget = cancelButton.dataset.cancelAppointment;
      cancelDialogContext.textContent = `${cancelButton.dataset.clientName} · ${cancelButton.dataset.appointmentTime}`;
      cancelDialog.showModal();
    }
  };

  todayList?.addEventListener('click', handleAppointmentClick);
  upcomingList?.addEventListener('click', handleAppointmentClick);

  doc.querySelector('[data-refresh-today]')?.addEventListener('click', loadToday);
  doc.querySelector('[data-refresh-upcoming]')?.addEventListener('click', loadUpcoming);

  doc.querySelector('[data-cancel-dialog-close]')?.addEventListener('click', () => cancelDialog.close());
  doc.querySelector('[data-cancel-dialog-back]')?.addEventListener('click', () => cancelDialog.close());
  cancelDialog?.addEventListener('click', (event) => { if (event.target === cancelDialog) cancelDialog.close(); });
  cancelConfirmButton?.addEventListener('click', async () => {
    if (!cancelTarget) return;
    cancelConfirmButton.disabled = true;
    const ok = await updateAppointment(cancelTarget, 'cancelled');
    cancelConfirmButton.disabled = false;
    if (ok) {
      cancelTarget = null;
      cancelDialog.close();
    }
  });

  const loadSettings = async () => {
    const { data, error } = await api.getSettings();
    if (error || !data) {
      currentSettings = null;
      setFeedback(settingsStatus, mapRpcError(error, 'Não foi possível carregar as configurações.'), true);
      return;
    }
    currentSettings = data;
    const incomplete = ['duration_minutes','interval_minutes','minimum_notice_hours','booking_horizon_days','timezone'].some((key) => data[key] === null || data[key] === '');
    const notice = doc.querySelector('[data-settings-notice]');
    if (notice) notice.hidden = !incomplete;
    const details = doc.querySelector('[data-settings-details]');
    if (details && incomplete) details.open = true;
    const tz = settingsForm?.elements.timezone;
    if (tz && data.timezone && ![...tz.options].some((o) => o.value === data.timezone)) tz.add(new Option(data.timezone, data.timezone));
    ['duration_minutes','interval_minutes','minimum_notice_hours','booking_horizon_days','timezone'].forEach((key) => {
      if (settingsForm?.elements[key]) settingsForm.elements[key].value = data[key] ?? '';
    });
  };

  const renderWeek = () => {
    if (!weeklyEditor) return;
    weeklyEditor.innerHTML = weekDays.map((day) => {
      const dayRules = rules
        .filter((rule) => Number(rule.weekday) === day.value && rule.modality === activeModality)
        .sort((a, b) => time(a.start_time).localeCompare(time(b.start_time)));

      const rulesMarkup = dayRules.length
        ? dayRules.map((rule) => `
          <div class="admin-rule-row">
            <span class="admin-rule-time">${time(rule.start_time)} às ${time(rule.end_time)}</span>
            <div class="admin-rule-actions">
              <button class="admin-text-action" type="button" data-edit-rule="${rule.id}">Editar</button>
              <button class="admin-text-action danger" type="button" data-delete-rule="${rule.id}">Excluir</button>
            </div>
          </div>`).join('')
        : '<p class="admin-day-empty">Nenhum horário definido.</p>';

      return `
        <article class="admin-day" data-weekday="${day.value}">
          <div class="admin-day-title">
            <strong>${day.label}</strong>
            <span>${dayRules.length ? `${dayRules.length} horário${dayRules.length > 1 ? 's' : ''}` : 'Sem horário cadastrado'}</span>
          </div>
          <div class="admin-day-rules">${rulesMarkup}</div>
          <button class="admin-button admin-add-day" type="button" data-add-rule="${day.value}">+ Adicionar horário</button>
        </article>`;
    }).join('');
  };

  const loadRules = async () => {
    renderWeek();
    setFeedback(rulesStatus, 'Carregando horários…');
    const { data, error } = await api.listRules(activeModality);
    if (error) {
      console.error('[agenda] Falha ao carregar disponibilidade', { activeModality, error });
      rules = [];
      renderWeek();
      setFeedback(rulesStatus, mapRpcError(error, 'Não foi possível carregar os horários salvos.'), true);
      return;
    }
    rules = Array.isArray(data) ? data : [];
    renderWeek();
    setFeedback(rulesStatus, '');
  };

  const openRuleDialog = ({ weekday, rule = null }) => {
    ruleDialogForm.reset();
    ruleDialogError.textContent = '';
    ruleDialogForm.elements.rule_id.value = rule?.id || '';
    ruleDialogForm.elements.weekday.value = weekday;
    ruleDialogForm.elements.modality.value = activeModality;
    ruleDialogForm.elements.start_time.value = rule ? time(rule.start_time) : '';
    ruleDialogForm.elements.end_time.value = rule ? time(rule.end_time) : '';
    if (ruleDaysBox) {
      ruleDaysBox.hidden = Boolean(rule);
      ruleDaysGrid.innerHTML = weekDays.filter((day) => day.value !== Number(weekday)).map((day) => `
        <label class="admin-checkbox-row"><input type="checkbox" name="extra_days" value="${day.value}"> ${day.label}</label>`).join('');
    }
    ruleDialogTitle.textContent = rule ? 'Editar horário' : 'Adicionar horário';
    ruleDialogContext.textContent = `${dayName(weekday)} · ${activeModality === 'online' ? 'Online' : 'Presencial'}`;
    const submitButton = ruleDialogForm.querySelector('[type="submit"]');
    submitButton.textContent = rule ? 'Salvar alterações' : 'Salvar horário';
    ruleDialog.showModal();
  };

  const closeRuleDialog = () => { if (ruleDialog?.open) ruleDialog.close(); };

  weeklyEditor?.addEventListener('click', async (event) => {
    const addButton = event.target.closest('[data-add-rule]');
    if (addButton) {
      openRuleDialog({ weekday: Number(addButton.dataset.addRule) });
      return;
    }
    const editButton = event.target.closest('[data-edit-rule]');
    if (editButton) {
      const rule = rules.find((item) => item.id === editButton.dataset.editRule);
      if (rule) openRuleDialog({ weekday: Number(rule.weekday), rule });
      return;
    }
    const deleteButton = event.target.closest('[data-delete-rule]');
    if (deleteButton) {
      const rule = rules.find((item) => item.id === deleteButton.dataset.deleteRule);
      const label = rule ? `${dayName(rule.weekday)}, ${time(rule.start_time)} às ${time(rule.end_time)}` : 'este horário';
      if (!window.confirm(`Deseja excluir ${label}?`)) return;
      deleteButton.disabled = true;
      const { error } = await api.deleteRule(deleteButton.dataset.deleteRule);
      if (error) {
        console.error('[agenda] Falha ao remover horário', error);
        setFeedback(rulesStatus, mapRpcError(error, 'Não foi possível remover o horário.'), true);
        deleteButton.disabled = false;
        return;
      }
      await loadRules();
      setFeedback(rulesStatus, 'Horário removido.');
    }
  });

  ruleDialogForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    ruleDialogError.textContent = '';
    const form = new FormData(ruleDialogForm);
    const start = String(form.get('start_time') || '');
    const end = String(form.get('end_time') || '');
    if (!start || !end || start >= end) {
      ruleDialogError.textContent = 'O horário inicial precisa ser anterior ao horário final.';
      return;
    }

    const payload = {
      id: String(form.get('rule_id') || ''),
      weekday: Number(form.get('weekday')),
      modality: String(form.get('modality')),
      start_time: start,
      end_time: end
    };
    const targetDays = payload.id
      ? [payload.weekday]
      : [payload.weekday, ...form.getAll('extra_days').map(Number)];

    const conflict = targetDays.find((weekday) => rules.some((rule) => {
      if (payload.id && rule.id === payload.id) return false;
      if (Number(rule.weekday) !== weekday || rule.modality !== payload.modality || !rule.is_active) return false;
      return payload.start_time < time(rule.end_time) && payload.end_time > time(rule.start_time);
    }));
    if (conflict !== undefined) {
      ruleDialogError.textContent = `Esse horário se sobrepõe a outro já cadastrado em ${dayName(conflict).toLowerCase()}.`;
      return;
    }

    const submit = ruleDialogForm.querySelector('[type="submit"]');
    submit.disabled = true;
    const { error } = payload.id
      ? await api.updateRule(payload)
      : await api.createRules(targetDays.map((weekday) => ({ ...payload, weekday })));
    submit.disabled = false;
    if (error) {
      console.error('[agenda] Falha ao salvar horário', error);
      ruleDialogError.textContent = mapRpcError(error, 'Não foi possível salvar o horário. Confira se ele já não existe.');
      return;
    }
    closeRuleDialog();
    await loadRules();
    setFeedback(rulesStatus, payload.id ? 'Horário atualizado.' : targetDays.length > 1 ? `Horário salvo em ${targetDays.length} dias.` : 'Horário salvo.');
  });

  doc.querySelector('[data-rule-dialog-close]')?.addEventListener('click', closeRuleDialog);
  doc.querySelector('[data-rule-dialog-cancel]')?.addEventListener('click', closeRuleDialog);
  ruleDialog?.addEventListener('click', (event) => { if (event.target === ruleDialog) closeRuleDialog(); });

  modalityTabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      activeModality = tab.dataset.modalityTab;
      modalityTabs.forEach((item) => {
        const selected = item === tab;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      modalityTitle.textContent = activeModality === 'online' ? 'Atendimento online' : 'Atendimento presencial';
      modalityCopy.textContent = activeModality === 'online'
        ? 'Estes horários aparecem para quem escolher atendimento online.'
        : 'Estes horários aparecem para quem escolher atendimento presencial.';
      await loadRules();
    });
  });

  settingsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const raw = new FormData(settingsForm);
    const nullableNumber = (name) => {
      const value = String(raw.get(name) || '').trim();
      return value === '' ? null : Number(value);
    };
    const payload = {
      duration_minutes: nullableNumber('duration_minutes'),
      interval_minutes: nullableNumber('interval_minutes'),
      minimum_notice_hours: nullableNumber('minimum_notice_hours'),
      booking_horizon_days: nullableNumber('booking_horizon_days'),
      timezone: String(raw.get('timezone') || '').trim() || null
    };
    const numericRules = [['duration_minutes', 15, 240, 'O tempo de cada atendimento'], ['interval_minutes', 0, 120, 'A pausa entre atendimentos'], ['minimum_notice_hours', 0, 720, 'A antecedência mínima'], ['booking_horizon_days', 1, 365, 'Os dias disponíveis no futuro']];
    for (const [key, min, max, label] of numericRules) {
      const value = payload[key];
      if (value !== null && (!Number.isInteger(value) || value < min || value > max)) {
        setFeedback(settingsStatus, `${label} precisa ser um número entre ${min} e ${max}.`, true);
        return;
      }
    }
    setFeedback(settingsStatus, 'Salvando…');
    const { error } = await api.updateSettings(payload);
    if (error) {
      console.error('[agenda] Falha ao salvar configurações', error);
      setFeedback(settingsStatus, mapRpcError(error, 'Não foi possível salvar as configurações.'), true);
      return;
    }
    await loadSettings();
    setFeedback(settingsStatus, 'Configurações salvas.');
  });

  const renderBlocks = () => {
    if (!blocks.length) {
      blocksList.innerHTML = '<p class="admin-empty">Nenhum dia bloqueado.</p>';
      return;
    }
    blocksList.innerHTML = blocks.map((block) => `
      <div class="admin-row">
        <p><strong>${safe(formatDateFull(block.blocked_date))}</strong><br><small>${block.start_time ? `${time(block.start_time)} às ${time(block.end_time)}` : 'Dia inteiro'}</small></p>
        <button class="admin-action danger" type="button" data-delete-block="${block.id}">Remover bloqueio</button>
      </div>`).join('');
  };

  const loadBlocks = async () => {
    setFeedback(blocksStatus, 'Carregando…');
    const { data, error } = await api.listBlocks();
    if (error) {
      console.error('[agenda] Falha ao carregar bloqueios', error);
      blocks = [];
      renderBlocks();
      setFeedback(blocksStatus, mapRpcError(error, 'Não foi possível carregar os dias bloqueados.'), true);
      return;
    }
    blocks = Array.isArray(data) ? data : [];
    renderBlocks();
    setFeedback(blocksStatus, '');
  };

  const blockOnlyPart = doc.querySelector('[data-block-only-part]');
  const blockTimeFields = doc.querySelector('[data-block-time-fields]');
  const blockSubmitLabel = doc.querySelector('[data-block-submit-label]');

  blockOnlyPart?.addEventListener('change', () => {
    const showTimes = blockOnlyPart.checked;
    if (blockTimeFields) blockTimeFields.hidden = !showTimes;
    if (blockSubmitLabel) blockSubmitLabel.textContent = showTimes ? 'Bloquear este horário' : 'Não vou atender neste dia';
    const startInput = blockForm?.elements.start_time;
    const endInput = blockForm?.elements.end_time;
    if (startInput) startInput.required = showTimes;
    if (endInput) endInput.required = showTimes;
    if (!showTimes) {
      if (startInput) startInput.value = '';
      if (endInput) endInput.value = '';
    }
  });

  blockForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const raw = new FormData(blockForm);
    const blockedDate = String(raw.get('blocked_date') || '');
    const onlyPart = Boolean(blockOnlyPart?.checked);
    const startTime = onlyPart ? String(raw.get('start_time') || '') : '';
    const endTime = onlyPart ? String(raw.get('end_time') || '') : '';
    if (!blockedDate) {
      setFeedback(blocksStatus, 'Escolha uma data.', true);
      return;
    }
    if (onlyPart && (!startTime || !endTime)) {
      setFeedback(blocksStatus, 'Escolha o horário de início e de fim.', true);
      return;
    }
    if (onlyPart && startTime >= endTime) {
      setFeedback(blocksStatus, 'O horário final precisa ser depois do inicial.', true);
      return;
    }
    if (blockedDate < localISO(new Date())) {
      setFeedback(blocksStatus, 'Escolha uma data de hoje em diante.', true);
      return;
    }
    const submit = blockForm.querySelector('[type="submit"]');
    submit.disabled = true;
    setFeedback(blocksStatus, 'Salvando…');
    const { error } = await api.createBlock({ blocked_date: blockedDate, start_time: startTime, end_time: endTime });
    submit.disabled = false;
    if (error) {
      console.error('[agenda] Falha ao bloquear data', error);
      setFeedback(blocksStatus, mapRpcError(error, 'Não foi possível bloquear esse horário.'), true);
      return;
    }
    blockForm.reset();
    if (blockTimeFields) blockTimeFields.hidden = true;
    if (blockSubmitLabel) blockSubmitLabel.textContent = 'Não vou atender neste dia';
    await loadBlocks();
    setFeedback(blocksStatus, onlyPart ? 'Horário bloqueado.' : 'Dia bloqueado.');
  });

  blocksList?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-block]');
    if (!button) return;
    if (!window.confirm('Deseja remover este bloqueio?')) return;
    button.disabled = true;
    const { error } = await api.deleteBlock(button.dataset.deleteBlock);
    if (error) {
      button.disabled = false;
      setFeedback(blocksStatus, 'Não foi possível remover o bloqueio.', true);
      return;
    }
    await loadBlocks();
    setFeedback(blocksStatus, 'Bloqueio removido.');
  });

  // ---- Novo agendamento (manual) ----
  const newApptForm = doc.querySelector('[data-new-appointment-form]');
  const newApptStatus = doc.querySelector('[data-new-appointment-status]');
  const newApptModalityTabs = [...doc.querySelectorAll('[data-new-appt-modality]')];
  let newApptModality = 'presencial';

  const resetNewApptTimeOptions = (message) => {
    const select = newApptForm?.elements.start_time;
    if (!select) return;
    select.innerHTML = `<option value="">${safe(message)}</option>`;
    select.disabled = true;
  };

  const loadNewApptSlots = async () => {
    const dateValue = newApptForm?.elements.appointment_date?.value;
    if (!dateValue) {
      resetNewApptTimeOptions('Escolha a data primeiro');
      return;
    }
    resetNewApptTimeOptions('Carregando horários…');
    const { data, error } = await api.getAvailableSlots(dateValue, newApptModality);
    const select = newApptForm.elements.start_time;
    if (error) {
      console.error('[agenda] Falha ao carregar horários livres', error);
      resetNewApptTimeOptions('Não foi possível carregar os horários');
      return;
    }
    const slots = Array.isArray(data) ? data : [];
    if (!slots.length) {
      resetNewApptTimeOptions('Nenhum horário livre nesse dia');
      return;
    }
    select.innerHTML = `<option value="">Escolha um horário</option>` +
      slots.map((slot) => `<option value="${safe(time(slot.slot_time))}">${safe(time(slot.slot_time))}</option>`).join('');
    select.disabled = false;
  };

  newApptModalityTabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      newApptModality = tab.dataset.newApptModality;
      newApptModalityTabs.forEach((item) => {
        const selected = item === tab;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      await loadNewApptSlots();
    });
  });

  newApptForm?.elements.appointment_date?.addEventListener('change', loadNewApptSlots);

  newApptForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const raw = new FormData(newApptForm);
    const payload = {
      client_name: String(raw.get('client_name') || '').trim(),
      client_phone: String(raw.get('client_phone') || '').replace(/\D/g, ''),
      appointment_date: String(raw.get('appointment_date') || ''),
      start_time: String(raw.get('start_time') || ''),
      modality: newApptModality
    };
    if (!payload.client_name || !payload.client_phone || !payload.appointment_date || !payload.start_time) {
      setFeedback(newApptStatus, 'Preencha todos os campos.', true);
      return;
    }
    const submit = newApptForm.querySelector('[type="submit"]');
    submit.disabled = true;
    setFeedback(newApptStatus, 'Salvando…');
    const { error } = await api.createAppointment(payload);
    submit.disabled = false;
    if (error) {
      console.error('[agenda] Falha ao criar agendamento', error);
      const message = String(error?.message || '');
      const friendly = message.includes('slot_unavailable')
        ? 'Esse horário acabou de ficar indisponível. Escolha outro.'
        : message.includes('invalid_phone')
        ? 'O WhatsApp digitado não parece válido. Confira o DDD e o número.'
        : mapRpcError(error, 'Não foi possível salvar o agendamento.');
      setFeedback(newApptStatus, friendly, true);
      return;
    }
    newApptForm.reset();
    resetNewApptTimeOptions('Escolha a data primeiro');
    newApptModality = 'presencial';
    newApptModalityTabs.forEach((item) => {
      const selected = item.dataset.newApptModality === 'presencial';
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-selected', String(selected));
    });
    await refreshVisibleAppointments();
    setFeedback(newApptStatus, 'Agendamento criado.');
  });

  const showView = async (viewName) => {
    activeView = viewName;
    views.forEach((view) => { view.hidden = view.dataset.adminView !== viewName; });
    navButtons.forEach((button) => {
      const selected = button.dataset.adminViewTarget === viewName;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    setFeedback(globalFeedback, '');

    if (viewName === 'today') { selectedDay = localISO(new Date()); await loadToday(); }
    if (viewName === 'upcoming') await loadUpcoming();
    if (viewName === 'availability') await Promise.all([loadSettings(), loadRules()]);
    if (viewName === 'blocks') await loadBlocks();
    if (viewName === 'new-appointment') setFeedback(newApptStatus, '');
  };

  navButtons.forEach((button) => button.addEventListener('click', () => showView(button.dataset.adminViewTarget)));

  const isAdminConfigured = async () => {
    const { data, error } = await client.rpc('is_booking_admin_configured');
    if (error) return false;
    return data === true;
  };

  // A verificação real de autorização acontece no banco: booking_settings só é
  // legível por quem satisfaz is_booking_admin() (auth.uid() == admin_user_id).
  // Se essa consulta falhar, o usuário logado não é a administradora — mesmo
  // que tenha uma sessão Supabase válida para outra finalidade.
  const verifyAdmin = async () => {
    const { data, error } = await client.from('booking_settings').select('id').eq('id', 1).single();
    if (error || !data) {
      expectedSignOut = true;
      await client.auth.signOut();
      showLogin('Este usuário não está autorizado a administrar a agenda.');
      return false;
    }
    sessionLostHandled = false;
    showApp();
    return true;
  };

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.textContent = 'Entrando…';
    const email = doc.getElementById('admin-email').value.trim();
    const password = doc.getElementById('admin-password').value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      loginError.textContent = 'E-mail ou senha incorretos.';
      return;
    }
    if (await verifyAdmin()) await showView('today');
  });

  logoutButton?.addEventListener('click', async () => {
    expectedSignOut = true;
    await client.auth.signOut();
    if (await isAdminConfigured()) showLogin();
    else showUnconfigured();
  });

  // Mantém o painel em sincronia com o estado real de autenticação: se o
  // token expira, é revogado, ou a pessoa sai em outra aba, o painel some
  // e volta para a tela de login em vez de continuar exibindo dados.
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') handleSessionLost();
  });

  const boot = async () => {
    const today = localISO(new Date());
    const footerDate = doc.querySelector('[data-admin-today]');
    if (footerDate) footerDate.textContent = formatDateFull(today);

    const configured = await isAdminConfigured();
    if (!configured) {
      expectedSignOut = true;
      await client.auth.signOut();
      showUnconfigured();
      return;
    }
    const { data } = await client.auth.getSession();
    if (!data.session) {
      showLogin();
      return;
    }
    if (await verifyAdmin()) await showView('today');
  };

  boot();
})();
