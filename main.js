(() => {
  'use strict';

  const config = window.SITE_CONFIG || {};
  const doc = document;
  doc.documentElement.classList.add('js');

  const safeHttps = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };

  const emitAnalytics = (eventName, params = {}) => {
    const payload = { event: eventName, ...params };
    if (Array.isArray(window.dataLayer)) window.dataLayer.push(payload);
    window.dispatchEvent(new CustomEvent('site:analytics', { detail: payload }));
  };

  doc.querySelectorAll('[data-field]').forEach((element) => {
    const value = config[element.dataset.field];
    if (typeof value === 'string' && value.trim()) element.textContent = value;
  });

  doc.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  const instagram = safeHttps(config.instagram);
  const phone = String(config.whatsapp || '').replace(/\D/g, '');
  const whatsapp = /^[1-9]\d{9,14}$/.test(phone)
    ? `https://wa.me/${phone}?text=${encodeURIComponent(config.mensagemWhatsapp || '')}`
    : '';
  const email = typeof config.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email.trim())
    ? `mailto:${config.email.trim()}`
    : '';

  doc.querySelectorAll('[data-whatsapp]').forEach((link) => {
    const destination = whatsapp || instagram;
    link.dataset.contactDestination = whatsapp ? 'whatsapp' : (instagram ? 'instagram' : 'anchor');
    if (!destination) {
      link.href = '#contato';
      return;
    }
    link.href = destination;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  doc.querySelectorAll('[data-contact="instagram"]').forEach((link) => {
    if (!instagram) {
      link.hidden = true;
      return;
    }
    link.hidden = false;
    link.href = instagram;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  doc.querySelectorAll('[data-contact="whatsapp"]').forEach((link) => {
    if (!whatsapp) {
      link.hidden = true;
      return;
    }
    link.hidden = false;
    link.href = whatsapp;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  doc.querySelectorAll('[data-contact="email"]').forEach((link) => {
    if (!email) {
      link.hidden = true;
      return;
    }
    link.hidden = false;
    link.href = email;
  });

  // SEO que depende do domínio oficial: só é ativado depois que siteUrl for configurado.
  const siteUrl = safeHttps(config.siteUrl);
  if (siteUrl) {
    const canonicalUrl = new URL('.', siteUrl).href;
    let canonical = doc.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = doc.createElement('link');
      canonical.rel = 'canonical';
      doc.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const ensureMeta = (selector, attribute, key, content) => {
      let meta = doc.head.querySelector(selector);
      if (!meta) {
        meta = doc.createElement('meta');
        meta.setAttribute(attribute, key);
        doc.head.appendChild(meta);
      }
      meta.content = content;
    };

    ensureMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    const ogImage = typeof config.ogImage === 'string' && config.ogImage.trim()
      ? new URL(config.ogImage, canonicalUrl).href
      : '';
    if (ogImage) {
      ensureMeta('meta[property="og:image"]', 'property', 'og:image', ogImage);
      ensureMeta('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage);
    }
  }

  doc.querySelectorAll('[data-track]').forEach((element) => {
    element.addEventListener('click', () => {
      emitAnalytics(element.dataset.track, {
        label: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 120),
        destination: element.dataset.contactDestination || element.getAttribute('href') || ''
      });
    });
  });

  const toggle = doc.querySelector('.menu-toggle');
  const nav = doc.querySelector('.main-nav');
  if (toggle && nav) {
    const closeMenu = ({ restoreFocus = false } = {}) => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
      doc.body.classList.remove('menu-open');
      if (restoreFocus) toggle.focus();
    };

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      doc.body.classList.toggle('menu-open', open);
      if (open) emitAnalytics('menu_open');
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });

    doc.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) closeMenu({ restoreFocus: true });
    });

    const desktopQuery = matchMedia('(min-width: 981px)');
    const onDesktopChange = () => {
      if (desktopQuery.matches) closeMenu();
    };
    if (desktopQuery.addEventListener) desktopQuery.addEventListener('change', onDesktopChange);
    else desktopQuery.addListener(onDesktopChange);
  }

  doc.querySelectorAll('details').forEach((details, index) => {
    const summary = details.querySelector('summary');
    if (!summary) return;
    summary.setAttribute('aria-expanded', String(details.open));
    summary.dataset.track = summary.dataset.track || 'faq_toggle';
    summary.dataset.faqIndex = String(index + 1);

    details.addEventListener('toggle', () => {
      summary.setAttribute('aria-expanded', String(details.open));
      if (!details.open) return;

      emitAnalytics('faq_open', {
        question: summary.textContent.trim().replace(/\s+/g, ' ').slice(0, 160),
        position: index + 1
      });

      doc.querySelectorAll('details[open]').forEach((other) => {
        if (other !== details) other.open = false;
      });
    });
  });

  const revealItems = doc.querySelectorAll('[data-reveal]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -7% 0px' });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const sections = [...doc.querySelectorAll('main section[id]')];
  const navLinks = [...doc.querySelectorAll('.main-nav a')];
  if ('IntersectionObserver' in window && sections.length && navLinks.length) {
    const navObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        const active = link.getAttribute('href') === `#${visible.target.id}`;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-30% 0px -55% 0px', threshold: [0.01, 0.2, 0.5] });
    sections.forEach((section) => navObserver.observe(section));
  }
})();
