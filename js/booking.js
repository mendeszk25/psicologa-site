(() => {
  'use strict';

  const doc = document;
  const config = window.SITE_CONFIG || {};
  const client = window.bookingSupabase || null;
  const dialog = doc.getElementById('booking-dialog');
  if (!dialog) return;

  const $ = (selector, root = dialog) => root.querySelector(selector);
  const $$ = (selector, root = dialog) => [...root.querySelectorAll(selector)];
  const steps = $$('.booking-step');
  const progressItems = $$('.booking-progress li');
  const unavailable = $('.booking-unavailable');
  const success = $('.booking-success');
  const statusBox = $('.booking-status');
  const nextButton = $('[data-booking-next]');
  const backButton = $('[data-booking-back]');
  const closeButtons = $$('[data-booking-close], .booking-close');
  const monthLabel = $('[data-calendar-month]');
  const daysGrid = $('[data-calendar-days]');
  const slotsGrid = $('[data-slot-grid]');
  const slotsDate = $('[data-slots-date]');
  const prevMonth = $('[data-calendar-prev]');
  const nextMonth = $('[data-calendar-next]');
  const form = $('#booking-client-form');
  const whatsappAfter = $('[data-booking-whatsapp]');
  const successDetails = $('[data-booking-success-details]');

  let opener = null;
  let currentStep = 1;
  let availableDays = new Set();
  let viewMonth = new Date();
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);

  const state = {
    modality: '',
    date: '',
    time: '',
    name: '',
    phone: '',
    email: '',
    appointmentId: ''
  };

  const emit = (event, params = {}) => {
    window.dispatchEvent(new CustomEvent('site:analytics', { detail: { event, ...params } }));
    if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event, ...params });
  };

  const pad = (n) => String(n).padStart(2, '0');
  const localISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseISODate = (value) => {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const formatDateLong = (value) => new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(parseISODate(value));
  const formatMonth = (date) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  const formatTime = (value) => String(value || '').slice(0, 5);

  const deriveWhatsappUrl = () => {
    const phone = String(config.whatsapp || '').replace(/\D/g, '');
    if (!/^[1-9]\d{9,14}$/.test(phone)) return '';
    const text = state.date && state.time
      ? `Olá, Silvana. Acabei de agendar meu atendimento para ${formatDateLong(state.date)}, às ${formatTime(state.time)}, na modalidade ${state.modality}.`
      : (config.mensagemWhatsapp || 'Olá, Silvana. Gostaria de conversar sobre um atendimento.');
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const clearStatus = () => { statusBox.textContent = ''; };
  const setStatus = (message) => { statusBox.textContent = message || ''; };

  const updateProgress = () => {
    progressItems.forEach((item, index) => {
      const step = index + 1;
      item.classList.toggle('is-active', step === currentStep);
      item.classList.toggle('is-done', step < currentStep);
      if (step === currentStep) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
  };

  const renderStep = () => {
    unavailable.hidden = true;
    success.hidden = true;
    steps.forEach((step) => { step.hidden = Number(step.dataset.bookingStep) !== currentStep; });
    backButton.hidden = currentStep === 1;
    nextButton.hidden = false;
    nextButton.textContent = currentStep === 4 ? 'Confirmar agendamento' : 'Continuar';
    updateProgress();
    clearStatus();

    if (currentStep === 2) loadAvailableDays();
    if (currentStep === 4) renderSummary();

    const heading = $(`[data-booking-step="${currentStep}"] h2`);
    if (heading) requestAnimationFrame(() => heading.focus?.({ preventScroll: true }));
  };

  const reset = () => {
    currentStep = 1;
    Object.assign(state, { modality: '', date: '', time: '', name: '', phone: '', email: '', appointmentId: '' });
    availableDays = new Set();
    viewMonth = new Date();
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    $$('.booking-choice').forEach((choice) => { choice.classList.remove('is-selected'); choice.setAttribute('aria-pressed', 'false'); });
    form.reset();
    success.hidden = true;
    renderStep();
  };

  const showBackendUnavailable = () => {
    steps.forEach((step) => { step.hidden = true; });
    success.hidden = true;
    unavailable.hidden = false;
    nextButton.hidden = true;
    backButton.hidden = true;
    progressItems.forEach((item) => item.classList.remove('is-active', 'is-done'));
    const instagram = (() => {
      try { const url = new URL(config.instagram); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
    })();
    const fallback = $('[data-booking-fallback]');
    if (fallback) {
      fallback.hidden = !instagram;
      if (instagram) { fallback.href = instagram; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer'; }
    }
  };

  const open = (event) => {
    event?.preventDefault();
    opener = event?.currentTarget || doc.activeElement;
    reset();
    if (!client) showBackendUnavailable();
    dialog.showModal();
    doc.body.classList.add('booking-open');
    emit('booking_open', { source: opener?.dataset?.track || 'unknown' });
  };

  const close = () => {
    if (dialog.open) dialog.close();
    doc.body.classList.remove('booking-open');
    if (opener?.focus) requestAnimationFrame(() => opener.focus());
  };

  doc.querySelectorAll('[data-booking-open]').forEach((button) => button.addEventListener('click', open));
  closeButtons.forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('close', () => { doc.body.classList.remove('booking-open'); if (opener?.focus) opener.focus(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });

  $$('.booking-choice').forEach((choice) => {
    choice.addEventListener('click', () => {
      state.modality = choice.dataset.modality;
      $$('.booking-choice').forEach((item) => {
        const selected = item === choice;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      nextButton.disabled = false;
      emit('booking_modality_select', { modality: state.modality });
    });
  });

  const renderCalendar = () => {
    monthLabel.textContent = formatMonth(viewMonth);
    daysGrid.innerHTML = '';
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    prevMonth.disabled = viewMonth <= todayMonth;

    for (let i = 0; i < firstWeekday; i += 1) {
      const blank = doc.createElement('span');
      blank.className = 'booking-day';
      blank.setAttribute('aria-hidden', 'true');
      daysGrid.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const iso = localISO(date);
      const available = availableDays.has(iso);
      const element = doc.createElement(available ? 'button' : 'span');
      element.className = `booking-day${available ? ' is-available' : ''}${state.date === iso ? ' is-selected' : ''}`;
      element.textContent = String(day);
      if (available) {
        element.type = 'button';
        element.setAttribute('aria-label', `Escolher ${formatDateLong(iso)}`);
        element.setAttribute('aria-pressed', String(state.date === iso));
        element.addEventListener('click', () => selectDate(iso));
      } else {
        element.setAttribute('aria-disabled', 'true');
      }
      daysGrid.appendChild(element);
    }
  };

  const loadAvailableDays = async () => {
    if (!client || !state.modality) return;
    availableDays = new Set();
    daysGrid.innerHTML = '<p class="booking-loading">Carregando agenda…</p>';
    slotsGrid.innerHTML = '';
    slotsDate.textContent = 'Escolha um dia disponível.';
    state.date = '';
    state.time = '';
    nextButton.disabled = true;

    const monthStart = localISO(viewMonth);
    const { data, error } = await client.rpc('get_available_days', {
      p_month_start: monthStart,
      p_modality: state.modality
    });

    if (error) {
      renderCalendar();
      setStatus('Não foi possível carregar a agenda. Tente novamente em instantes.');
      return;
    }
    (data || []).forEach((row) => availableDays.add(row.available_date || row));
    renderCalendar();
  };

  const selectDate = async (iso) => {
    state.date = iso;
    state.time = '';
    renderCalendar();
    slotsDate.textContent = formatDateLong(iso);
    slotsGrid.innerHTML = '<p class="booking-loading">Carregando horários…</p>';
    nextButton.disabled = true;

    const { data, error } = await client.rpc('get_available_slots', {
      p_date: iso,
      p_modality: state.modality
    });
    if (error) {
      slotsGrid.innerHTML = '<p class="booking-empty">Não foi possível carregar os horários.</p>';
      return;
    }
    const slots = (data || []).map((row) => row.slot_time || row);
    if (!slots.length) {
      slotsGrid.innerHTML = '<p class="booking-empty">Não há horários disponíveis neste dia.</p>';
      return;
    }
    slotsGrid.innerHTML = '';
    slots.forEach((slot) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'booking-slot';
      button.textContent = formatTime(slot);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        state.time = slot;
        $$('.booking-slot').forEach((item) => {
          const selected = item === button;
          item.classList.toggle('is-selected', selected);
          item.setAttribute('aria-pressed', String(selected));
        });
        nextButton.disabled = false;
        emit('booking_slot_select', { modality: state.modality, date: state.date, time: formatTime(slot) });
      });
      slotsGrid.appendChild(button);
    });
  };

  prevMonth?.addEventListener('click', () => {
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
    loadAvailableDays();
  });
  nextMonth?.addEventListener('click', () => {
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    loadAvailableDays();
  });

  const validateClientForm = () => {
    const name = $('#booking-name');
    const phone = $('#booking-phone');
    const email = $('#booking-email');
    const phoneDigits = phone.value.replace(/\D/g, '');
    let valid = true;

    const setError = (input, message) => {
      const error = doc.getElementById(`${input.id}-error`);
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (error) error.textContent = message;
      if (message) valid = false;
    };

    setError(name, name.value.trim().length >= 2 ? '' : 'Informe seu nome.');
    setError(phone, /^[1-9]\d{9,14}$/.test(phoneDigits) ? '' : 'Informe um WhatsApp válido com DDD.');
    setError(email, !email.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? '' : 'Confira o e-mail informado.');

    if (valid) {
      state.name = name.value.trim();
      state.phone = phoneDigits;
      state.email = email.value.trim();
    }
    return valid;
  };

  const renderSummary = () => {
    $('[data-summary-modality]').textContent = state.modality === 'online' ? 'Online' : 'Presencial';
    $('[data-summary-date]').textContent = formatDateLong(state.date);
    $('[data-summary-time]').textContent = formatTime(state.time);
    $('[data-summary-name]').textContent = state.name;
    $('[data-summary-phone]').textContent = state.phone;
    const emailRow = $('[data-summary-email-row]');
    $('[data-summary-email]').textContent = state.email || 'Não informado';
    emailRow.hidden = !state.email;
  };

  const confirmBooking = async () => {
    if (!client) return;
    nextButton.disabled = true;
    backButton.disabled = true;
    setStatus('Confirmando seu horário…');

    const { data, error } = await client.rpc('book_appointment', {
      p_client_name: state.name,
      p_client_phone: state.phone,
      p_client_email: state.email || null,
      p_date: state.date,
      p_start_time: state.time,
      p_modality: state.modality
    });

    if (error) {
      backButton.disabled = false;
      if (String(error.message || '').includes('slot_unavailable')) {
        currentStep = 2;
        renderStep();
        setStatus('Esse horário acabou de ser reservado. Escolha outro horário.');
        if (state.date) selectDate(state.date);
      } else {
        nextButton.disabled = false;
        setStatus('Não foi possível concluir o agendamento. Tente novamente.');
      }
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    state.appointmentId = result?.appointment_id || '';
    steps.forEach((step) => { step.hidden = true; });
    progressItems.forEach((item) => item.classList.add('is-done'));
    success.hidden = false;
    nextButton.hidden = true;
    backButton.hidden = true;
    clearStatus();
    successDetails.textContent = `${formatDateLong(state.date)} · ${formatTime(state.time)} · ${state.modality === 'online' ? 'Online' : 'Presencial'}`;
    const wa = deriveWhatsappUrl();
    whatsappAfter.hidden = !wa;
    if (wa) { whatsappAfter.href = wa; whatsappAfter.target = '_blank'; whatsappAfter.rel = 'noopener noreferrer'; }
    emit('booking_confirmed', { modality: state.modality, date: state.date, time: formatTime(state.time) });
  };

  nextButton?.addEventListener('click', async () => {
    clearStatus();
    if (currentStep === 1) {
      if (!state.modality) { setStatus('Escolha uma modalidade para continuar.'); return; }
      currentStep = 2;
      renderStep();
      nextButton.disabled = true;
      return;
    }
    if (currentStep === 2) {
      if (!state.date || !state.time) { setStatus('Escolha uma data e um horário para continuar.'); return; }
      currentStep = 3;
      renderStep();
      return;
    }
    if (currentStep === 3) {
      if (!validateClientForm()) return;
      currentStep = 4;
      renderStep();
      return;
    }
    if (currentStep === 4) await confirmBooking();
  });

  backButton?.addEventListener('click', () => {
    if (currentStep <= 1) return;
    currentStep -= 1;
    renderStep();
    nextButton.disabled = currentStep === 2 ? !(state.date && state.time) : false;
  });

  form?.addEventListener('submit', (event) => event.preventDefault());
})();
