/* ==========================================================================
   CRO landing — behaviour
   Self-contained. Every custom element is registration-guarded so the file
   is safe to include from more than one section on the same page.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function define(name, ctor) {
    if (!window.customElements.get(name)) window.customElements.define(name, ctor);
  }

  /* ---------------------------------------------------------------- reveal */
  var revealObserver = null;
  function observeReveals(root) {
    var nodes = (root || document).querySelectorAll('.cro-reveal:not([data-cro-observed])');
    if (!nodes.length) return;
    if (!('IntersectionObserver' in window) || reduceMotion) {
      nodes.forEach(function (n) { n.setAttribute('data-cro-observed', ''); n.classList.add('cro-in'); });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('cro-in');
          entry.target.dispatchEvent(new CustomEvent('cro:visible'));
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    }
    nodes.forEach(function (n) { n.setAttribute('data-cro-observed', ''); revealObserver.observe(n); });
  }

  /* ----------------------------------------------------------------- toast */
  function toast(message, href, linkLabel) {
    var host = document.querySelector('.cro-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'cro-toast-host';
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'cro-toast';
    el.innerHTML = '<span></span>';
    el.firstChild.textContent = message;
    if (href) {
      var a = document.createElement('a');
      a.href = href;
      a.textContent = linkLabel || 'Korpa';
      el.appendChild(a);
    }
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () { el.remove(); }, 300);
    }, 4200);
  }

  /* --------------------------------------------------------------- gallery */
  define('cro-gallery', class extends HTMLElement {
    connectedCallback() {
      this.viewport = this.querySelector('.cro-gallery__viewport');
      this.slides = Array.from(this.querySelectorAll('.cro-gallery__slide'));
      this.thumbs = Array.from(this.querySelectorAll('.cro-gallery__thumb'));
      this.counter = this.querySelector('.cro-gallery__counter-current');
      this.prev = this.querySelector('.cro-gallery__arrow--prev');
      this.next = this.querySelector('.cro-gallery__arrow--next');
      if (!this.viewport || !this.slides.length) return;

      this.index = 0;
      this.onScroll = this.debounce(this.syncFromScroll.bind(this), 90);
      this.viewport.addEventListener('scroll', this.onScroll, { passive: true });

      this.thumbs.forEach(function (thumb, i) {
        thumb.addEventListener('click', function () { this.goTo(i); }.bind(this));
      }, this);
      if (this.prev) this.prev.addEventListener('click', function () { this.goTo(this.index - 1); }.bind(this));
      if (this.next) this.next.addEventListener('click', function () { this.goTo(this.index + 1); }.bind(this));

      this.querySelectorAll('.cro-gallery__zoom').forEach(function (btn) {
        btn.addEventListener('click', this.openLightbox.bind(this));
      }, this);

      this.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { this.goTo(this.index - 1); }
        if (e.key === 'ArrowRight') { this.goTo(this.index + 1); }
      }.bind(this));

      // A variant change elsewhere in the section asks for a media id
      this.closest('[data-cro-product]')?.addEventListener('cro:variant', function (e) {
        if (e.detail && e.detail.mediaId) this.goToMedia(e.detail.mediaId);
      }.bind(this));

      this.update();
    }

    disconnectedCallback() {
      if (this.viewport) this.viewport.removeEventListener('scroll', this.onScroll);
    }

    debounce(fn, wait) {
      var t;
      return function () {
        clearTimeout(t);
        t = setTimeout(fn, wait);
      };
    }

    goTo(i) {
      i = Math.max(0, Math.min(this.slides.length - 1, i));
      this.index = i;
      this.viewport.scrollTo({ left: this.slides[i].offsetLeft - this.viewport.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
      this.update();
    }

    goToMedia(mediaId) {
      var i = this.slides.findIndex(function (s) { return s.dataset.mediaId === String(mediaId); });
      if (i > -1) this.goTo(i);
    }

    syncFromScroll() {
      var mid = this.viewport.scrollLeft + this.viewport.clientWidth / 2;
      var closest = 0;
      var best = Infinity;
      this.slides.forEach(function (slide, i) {
        var center = slide.offsetLeft - this.viewport.offsetLeft + slide.clientWidth / 2;
        var dist = Math.abs(center - mid);
        if (dist < best) { best = dist; closest = i; }
      }, this);
      if (closest !== this.index) { this.index = closest; this.update(); }
    }

    update() {
      this.thumbs.forEach(function (t, i) {
        t.setAttribute('aria-current', i === this.index ? 'true' : 'false');
        if (i === this.index && t.scrollIntoView) {
          t.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      }, this);
      if (this.counter) this.counter.textContent = this.index + 1;
      if (this.prev) this.prev.hidden = this.index === 0;
      if (this.next) this.next.hidden = this.index === this.slides.length - 1;
      // pause videos on slides that scrolled away
      this.slides.forEach(function (slide, i) {
        var v = slide.querySelector('video');
        if (!v) return;
        if (i === this.index) { v.play().catch(function () {}); } else { v.pause(); }
      }, this);
    }

    openLightbox(e) {
      var slide = e.currentTarget.closest('.cro-gallery__slide');
      var img = slide && slide.querySelector('img');
      if (!img) return;
      var box = document.createElement('div');
      box.className = 'cro-lightbox';
      box.setAttribute('open', '');
      box.innerHTML = '<button class="cro-lightbox__close" aria-label="Zatvori">&times;</button>';
      var big = document.createElement('img');
      big.src = img.currentSrc || img.src;
      big.alt = img.alt || '';
      box.appendChild(big);
      document.body.appendChild(box);
      document.body.style.overflow = 'hidden';
      function close() {
        box.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onKey);
      }
      function onKey(ev) { if (ev.key === 'Escape') close(); }
      box.addEventListener('click', function (ev) { if (ev.target !== big) close(); });
      document.addEventListener('keydown', onKey);
    }
  });

  /* ---------------------------------------------------------- product form */
  define('cro-product-form', class extends HTMLElement {
    connectedCallback() {
      var data = this.querySelector('[data-cro-variants]');
      this.variants = data ? JSON.parse(data.textContent) : [];
      this.form = this.querySelector('form');
      this.idInput = this.querySelector('[name="id"]');
      this.submit = this.querySelector('[data-cro-submit]');
      this.submitText = this.querySelector('[data-cro-submit-text]');
      this.priceNow = document.querySelector('[data-cro-price-now]');
      this.priceWas = document.querySelector('[data-cro-price-was]');
      this.priceSave = document.querySelector('[data-cro-price-save]');
      this.optionLabel = this.querySelector('[data-cro-option-value]');
      this.moneyFormat = this.dataset.moneyFormat || '{{amount}} RSD';
      this.mode = this.dataset.mode || 'cart';

      this.querySelectorAll('input[type="radio"]').forEach(function (input) {
        input.addEventListener('change', this.onOptionChange.bind(this));
      }, this);

      var qty = this.querySelector('.cro-qty');
      if (qty) {
        var field = qty.querySelector('input');
        qty.querySelectorAll('button').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var step = btn.dataset.step === 'up' ? 1 : -1;
            field.value = Math.max(1, (parseInt(field.value, 10) || 1) + step);
            field.dispatchEvent(new Event('change', { bubbles: true }));
          });
        });
      }

      if (this.form) this.form.addEventListener('submit', this.onSubmit.bind(this));
      this.onOptionChange();
    }

    selectedOptions() {
      return Array.from(this.querySelectorAll('input[type="radio"]:checked')).map(function (i) { return i.value; });
    }

    onOptionChange() {
      var chosen = this.selectedOptions();
      if (!chosen.length) return;
      var variant = this.variants.find(function (v) {
        return chosen.every(function (val, i) { return v.options[i] === val; });
      });
      this.variant = variant;

      if (this.optionLabel) this.optionLabel.textContent = chosen.join(' / ');

      if (!variant) {
        this.setSubmit(false, this.dataset.labelUnavailable || 'Nedostupno');
        return;
      }

      if (this.idInput) this.idInput.value = variant.id;

      if (this.priceNow) this.priceNow.textContent = this.money(variant.price);
      if (this.priceWas) {
        var onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
        this.priceWas.hidden = !onSale;
        if (onSale) this.priceWas.textContent = this.money(variant.compare_at_price);
        if (this.priceSave) {
          this.priceSave.hidden = !onSale;
          if (onSale) {
            var pct = Math.round((1 - variant.price / variant.compare_at_price) * 100);
            this.priceSave.textContent = '-' + pct + '%';
          }
        }
      }

      this.setSubmit(variant.available, variant.available
        ? (this.dataset.labelDefault || 'Dodaj u korpu')
        : (this.dataset.labelSoldOut || 'Rasprodato'));

      var mediaId = variant.featured_media && variant.featured_media.id;
      if (mediaId) {
        this.closest('[data-cro-product]')?.dispatchEvent(
          new CustomEvent('cro:variant', { detail: { mediaId: mediaId, variant: variant } })
        );
      }

      if (window.history.replaceState && variant.id) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }

      document.dispatchEvent(new CustomEvent('cro:variant:change', { detail: { variant: variant } }));
    }

    setSubmit(enabled, label) {
      if (!this.submit) return;
      this.submit.disabled = !enabled;
      if (this.submitText && label) this.submitText.textContent = label;
    }

    money(cents) {
      var amount = (cents / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      // shop.money_format uses placeholders such as {{amount_with_comma_separator}}
      return this.moneyFormat.replace(/\{\{\s*[a-z_]+\s*\}\}/i, amount);
    }

    onSubmit(e) {
      if (!window.fetch || !this.variant) return; // let the browser post normally
      e.preventDefault();
      var body = new FormData(this.form);
      this.setSubmit(false, this.dataset.labelAdding || 'Dodajem…');
      fetch('/cart/add.js', { method: 'POST', headers: { Accept: 'application/json' }, body: body })
        .then(function (r) { return r.json().then(function (json) { return { ok: r.ok, json: json }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.json.description || res.json.message || 'Greška');
          if (this.mode === 'checkout') { window.location.href = '/checkout'; return; }
          this.setSubmit(true, this.dataset.labelDefault || 'Dodaj u korpu');
          toast(this.dataset.labelAdded || 'Dodato u korpu', '/cart', this.dataset.labelCart || 'Idi na korpu');
          document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
          document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true, detail: { source: 'cro-product-form' } }));
        }.bind(this))
        .catch(function (err) {
          this.setSubmit(true, this.dataset.labelDefault || 'Dodaj u korpu');
          toast(err.message || 'Greška, pokušajte ponovo.');
        }.bind(this));
    }
  });

  /* ------------------------------------------------------------- sticky ATC */
  define('cro-sticky-atc', class extends HTMLElement {
    connectedCallback() {
      var anchor = document.querySelector(this.dataset.watch || '[data-cro-buy]');
      this.button = this.querySelector('[data-cro-sticky-button]');
      if (this.button && anchor) {
        this.button.addEventListener('click', function () {
          anchor.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
          var main = anchor.querySelector('[data-cro-submit]');
          if (main) setTimeout(function () { main.focus({ preventScroll: true }); }, 400);
        });
      }
      if (!anchor || !('IntersectionObserver' in window)) return;
      this.observer = new IntersectionObserver(function (entries) {
        this.classList.toggle('is-visible', !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0);
      }.bind(this), { threshold: 0 });
      this.observer.observe(anchor);

      document.addEventListener('cro:variant:change', function (e) {
        var p = this.querySelector('[data-cro-sticky-price]');
        if (p && e.detail.variant) {
          p.textContent = (e.detail.variant.price / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 }) + ' RSD';
        }
      }.bind(this));
    }
    disconnectedCallback() { if (this.observer) this.observer.disconnect(); }
  });

  /* ------------------------------------------------------------- countdown */
  define('cro-countdown', class extends HTMLElement {
    connectedCallback() {
      this.fields = {
        days: this.querySelector('[data-days]'),
        hours: this.querySelector('[data-hours]'),
        minutes: this.querySelector('[data-minutes]'),
        seconds: this.querySelector('[data-seconds]')
      };
      this.target = this.resolveTarget();
      this.tick();
      this.timer = setInterval(this.tick.bind(this), 1000);
    }
    disconnectedCallback() { clearInterval(this.timer); }

    resolveTarget() {
      var explicit = Date.parse(this.dataset.deadline || '');
      if (!isNaN(explicit)) return explicit;
      // Rolling deadline: always N hours ahead, persisted per browser
      var hours = parseFloat(this.dataset.rollingHours || '48');
      var key = 'cro-countdown-' + (this.dataset.key || 'default');
      var stored = parseInt(window.localStorage ? localStorage.getItem(key) : null, 10);
      if (stored && stored > Date.now()) return stored;
      var next = Date.now() + hours * 3600 * 1000;
      try { localStorage.setItem(key, String(next)); } catch (e) {}
      return next;
    }

    tick() {
      var diff = Math.max(0, this.target - Date.now());
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      this.set('days', d); this.set('hours', h); this.set('minutes', m); this.set('seconds', s);
      if (diff === 0) clearInterval(this.timer);
    }

    set(key, value) {
      var el = this.fields[key];
      if (!el) return;
      var next = String(value).padStart(2, '0');
      if (el.textContent === next) return;
      el.textContent = next;
      if (!reduceMotion) {
        el.classList.remove('is-tick');
        void el.offsetWidth;
        el.classList.add('is-tick');
      }
    }
  });

  /* ----------------------------------------------------------------- stats */
  define('cro-stats', class extends HTMLElement {
    connectedCallback() {
      this.rows = Array.from(this.querySelectorAll('[data-percent]'));
      if (!('IntersectionObserver' in window) || reduceMotion) return this.rows.forEach(this.fill.bind(this));
      var io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          this.fill(entry.target);
          obs.unobserve(entry.target);
        }, this);
      }.bind(this), { threshold: 0.4 });
      this.rows.forEach(function (r) { io.observe(r); });
    }
    fill(row) {
      var target = parseFloat(row.dataset.percent) || 0;
      var num = row.querySelector('[data-cro-count]');
      if (reduceMotion) {
        row.style.setProperty('--cro-shown', target);
        if (num) num.textContent = target + '%';
        return;
      }
      var start = performance.now();
      var dur = 1200;
      function step(now) {
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        var value = target * eased;
        row.style.setProperty('--cro-shown', value.toFixed(1));
        if (num) num.textContent = Math.round(value) + '%';
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
  });

  /* ---------------------------------------------------------- stock meter */
  define('cro-stock', class extends HTMLElement {
    connectedCallback() {
      var bar = this.querySelector('.cro-stock__bar span');
      if (!bar) return;
      var pct = Math.max(4, Math.min(100, parseFloat(this.dataset.percent) || 20));
      if (reduceMotion) { bar.style.width = pct + '%'; return; }
      this.addEventListener('cro:visible', function () { bar.style.width = pct + '%'; });
      setTimeout(function () { bar.style.width = pct + '%'; }, 600);
    }
  });

  /* ---------------------------------------------------------------- slider */
  define('cro-slider', class extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.cro-slider__track');
      this.slides = Array.from(this.querySelectorAll('.cro-slider__slide'));
      this.dots = Array.from(this.querySelectorAll('.cro-slider__dot'));
      if (!this.track || !this.slides.length) return;

      this.querySelector('.cro-slider__arrow--prev')?.addEventListener('click', function () { this.step(-1); }.bind(this));
      this.querySelector('.cro-slider__arrow--next')?.addEventListener('click', function () { this.step(1); }.bind(this));
      this.dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () { this.goTo(i); }.bind(this));
      }, this);

      this.track.addEventListener('scroll', this.throttle(this.sync.bind(this), 120), { passive: true });
      this.sync();

      if (this.dataset.autoplay === 'true' && !reduceMotion) {
        var delay = (parseFloat(this.dataset.autoplaySpeed) || 7) * 1000;
        this.timer = setInterval(function () {
          var last = this.slides.length - 1;
          this.goTo(this.current >= last ? 0 : this.current + 1);
        }.bind(this), delay);
        this.addEventListener('mouseenter', function () { clearInterval(this.timer); }.bind(this));
        this.addEventListener('touchstart', function () { clearInterval(this.timer); }.bind(this), { passive: true });
      }
    }
    disconnectedCallback() { clearInterval(this.timer); }

    throttle(fn, wait) {
      var last = 0;
      return function () {
        var now = Date.now();
        if (now - last < wait) return;
        last = now;
        fn();
      };
    }
    step(dir) { this.goTo((this.current || 0) + dir); }
    goTo(i) {
      i = Math.max(0, Math.min(this.slides.length - 1, i));
      this.track.scrollTo({ left: this.slides[i].offsetLeft - this.track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    sync() {
      var mid = this.track.scrollLeft + this.track.clientWidth / 2;
      var best = Infinity, idx = 0;
      this.slides.forEach(function (s, i) {
        var c = s.offsetLeft - this.track.offsetLeft + s.clientWidth / 2;
        var d = Math.abs(c - mid);
        if (d < best) { best = d; idx = i; }
      }, this);
      this.current = idx;
      this.dots.forEach(function (dot, i) { dot.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
    }
  });

  /* ---------------------------------------------------------------- ticker */
  define('cro-ticker', class extends HTMLElement {
    connectedCallback() {
      var track = this.querySelector('.cro-ticker__track');
      if (!track || track.dataset.cloned) return;
      // The keyframe translates by -50%, so the item list must be duplicated
      // exactly once and be at least twice the viewport wide.
      var original = track.innerHTML;
      var guard = 0;
      while (track.scrollWidth < this.offsetWidth * 2 && guard < 8) {
        track.innerHTML += original;
        guard++;
      }
      track.innerHTML += track.innerHTML;
      track.dataset.cloned = 'true';
    }
  });

  /* --------------------------------------------------------------- stories */
  define('cro-stories', class extends HTMLElement {
    connectedCallback() {
      this.stories = JSON.parse(this.querySelector('[data-cro-stories]').textContent);
      this.viewer = this.querySelector('.cro-stories__viewer');
      this.frame = this.querySelector('.cro-stories__frame');
      this.bars = this.querySelector('.cro-stories__bars');
      this.metaImg = this.querySelector('.cro-stories__meta img');
      this.metaName = this.querySelector('.cro-stories__meta span');
      this.cta = this.querySelector('.cro-stories__cta');

      this.querySelectorAll('.cro-stories__btn').forEach(function (btn) {
        btn.addEventListener('click', function () { this.open(parseInt(btn.dataset.index, 10)); }.bind(this));
      }, this);
      this.querySelector('.cro-stories__close')?.addEventListener('click', this.close.bind(this));
      this.querySelector('.cro-stories__nav--prev')?.addEventListener('click', function () { this.open(this.index - 1); }.bind(this));
      this.querySelector('.cro-stories__nav--next')?.addEventListener('click', function () { this.open(this.index + 1); }.bind(this));
      this.onKey = function (e) {
        if (e.key === 'Escape') this.close();
        if (e.key === 'ArrowRight') this.open(this.index + 1);
        if (e.key === 'ArrowLeft') this.open(this.index - 1);
      }.bind(this);
    }

    open(i) {
      if (i < 0) return;
      if (i >= this.stories.length) return this.close();
      this.index = i;
      var story = this.stories[i];

      this.frame.querySelectorAll('img.cro-stories__media, video.cro-stories__media').forEach(function (n) { n.remove(); });
      var media;
      if (story.video) {
        media = document.createElement('video');
        media.src = story.video;
        media.autoplay = true; media.muted = true; media.loop = false; media.playsInline = true;
      } else {
        media = document.createElement('img');
        media.src = story.image;
        media.alt = story.name || '';
      }
      media.className = 'cro-stories__media';
      this.frame.prepend(media);

      this.bars.innerHTML = '';
      this.stories.forEach(function (s, n) {
        var bar = document.createElement('div');
        bar.className = 'cro-stories__bar' + (n < i ? ' is-done' : n === i ? ' is-active' : '');
        bar.innerHTML = '<span></span>';
        this.bars.appendChild(bar);
      }, this);

      if (this.metaImg) this.metaImg.src = story.avatar || story.image;
      if (this.metaName) this.metaName.textContent = story.name || '';
      if (this.cta) {
        var link = this.cta.querySelector('a');
        if (story.link) { this.cta.hidden = false; link.href = story.link; link.textContent = story.link_label || 'Pogledaj proizvod'; }
        else { this.cta.hidden = true; }
      }

      this.viewer.setAttribute('open', '');
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', this.onKey);

      clearTimeout(this.advance);
      var duration = (parseFloat(this.dataset.duration) || 5) * 1000;
      this.frame.style.setProperty('--cro-story-duration', duration + 'ms');
      this.advance = setTimeout(function () { this.open(this.index + 1); }.bind(this), duration);
    }

    close() {
      clearTimeout(this.advance);
      this.viewer.removeAttribute('open');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', this.onKey);
    }
  });

  /* --------------------------------------------------------- video toggles */
  function wireVideos(root) {
    (root || document).querySelectorAll('.cro-video:not([data-cro-wired])').forEach(function (wrap) {
      wrap.setAttribute('data-cro-wired', '');
      var video = wrap.querySelector('video');
      var toggle = wrap.querySelector('.cro-video__toggle');
      if (!video) return;

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { video.play().catch(function () {}); }
            else { video.pause(); }
          });
        }, { threshold: 0.25 }).observe(video);
      }

      if (!toggle) return;
      toggle.addEventListener('click', function () {
        video.muted = !video.muted;
        toggle.setAttribute('aria-pressed', String(!video.muted));
        toggle.innerHTML = video.muted ? toggle.dataset.iconMuted : toggle.dataset.iconUnmuted;
      });
    });
  }

  /* ------------------------------------------------------------------ boot */
  function boot(root) {
    observeReveals(root);
    wireVideos(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(document); });
  } else {
    boot(document);
  }
  document.addEventListener('shopify:section:load', function (e) { boot(e.target); });
})();
