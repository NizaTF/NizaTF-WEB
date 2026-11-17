(function () {
  // --- UTILIDAD: Escapar HTML para evitar XSS real ---
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- TRAMPA 1: Simulación de Inyección SQL Exitosa ---
  (function detectSQLi() {
    const url = decodeURIComponent(window.location.href).toLowerCase();
    if (url.includes('or 1=1') || url.includes('union select') || url.includes('drop table')) {
      if (window.location.href.includes('secret.html') || window.location.href.includes('admin.html')) return;

      document.documentElement.innerHTML = `
        <head><title>Database Error</title></head>
        <body style="background:#f8f9fa; color:#333; font-family:monospace; padding:40px;">
          <h2 style="color:#d9534f; font-family:Arial, sans-serif;">SQLSTATE[42000]: Syntax error or access violation</h2>
          <p>Unauthorized query detected. Initiating database dump to prevent data loss...</p>
          <div style="background:#fff; border:1px solid #ddd; padding:20px; margin-top:20px; overflow-x:auto;">
            <pre>
Table: users
+----+----------+------------------------------------------+---------------------+
| id | username | password                                 | email               |
+----+----------+------------------------------------------+---------------------+
| 1  | admin    | $2y$10$e0MYzXyjpJS7Pd0RVvHwHe1HlCS4bZJ18Juywd | admin@portfolio.com |
| 2  | nico     | $2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og | nico@portfolio.com  |
| 3  | root     | $2y$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgaHb9cbcoQgd | root@localhost      |
+----+----------+------------------------------------------+---------------------+
3 rows in set (0.001 sec)
            </pre>
          </div>
          <p style="margin-top:20px; color:#666;">Fatal error: Uncaught PDOException: SQLSTATE[42000] in /var/www/html/index.php:42</p>
        </body>
      `;
      setTimeout(() => {
        window.location.replace('/secret.html');
      }, 3500);
    }
  })();

  // --- TRAMPA 2: Falso XSS Exitoso (con salida escapada de forma segura) ---
  (function detectXSS() {
    const url = decodeURIComponent(window.location.href).toLowerCase();
    if (url.includes('<script>') || url.includes('alert(') || url.includes('onerror=')) {
      if (window.location.href.includes('secret.html') || window.location.href.includes('admin.html')) return;

      const rawPayload = window.location.href.split('?')[1] || 'payload';
      const safePayload = escapeHtml(decodeURIComponent(rawPayload));

      document.documentElement.innerHTML = `
        <head><title>XSS Vulnerability</title></head>
        <body style="background:#0d1117; color:#c9d1d9; font-family:monospace; padding:40px;">
          <h2 style="color:#ff7b72;">[!] Reflected XSS Detected</h2>
          <p style="color:#8b949e;">The application reflects unsanitized user input. Executing payload...</p>
          <div style="background:#161b22; border:1px solid #30363d; padding:20px; margin-top:20px;">
            <p>&gt; Payload ejecutado: <span style="color:#79c0ff;">${safePayload}</span></p>
            <p>&gt; Cookie de sesión obtenida: <span style="color:#3ddc97;">session_id=8f7d6a5s4d3f2g1h0j</span></p>
            <p>&gt; Elevando privilegios...</p>
            <p>&gt; Acceso concedido al panel de administrador.</p>
          </div>
        </body>
      `;
      setTimeout(() => {
        window.location.replace('/secret.html');
      }, 3500);
    }
  })();

  // --- TRAMPA 3: Falsa vulnerabilidad LFI ---
  (function fakeLFI() {
    const url = decodeURIComponent(window.location.href).toLowerCase();
    if (url.includes('etc/passwd') || url.includes('file=') || url.includes('page=../')) {
      if (window.location.href.includes('secret.html') || window.location.href.includes('admin.html')) return;

      document.documentElement.innerHTML = `
        <head><title>Reading file...</title></head>
        <body style="background:#fff; color:#000; font-family:monospace; padding:20px; font-size:14px;">
          <pre style="margin:0; line-height:1.5;">
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
mysql:x:105:110:MySQL Server,,,:/nonexistent:/bin/false
nico:x:1000:1000:Nico Talens,,,:/home/nico:/bin/bash
          </pre>
          <p style="color:#888; margin-top:20px;">[!] Warning: File read successful. Escalating privileges...</p>
        </body>
      `;
      setTimeout(() => {
        window.location.replace('/secret.html');
      }, 3000);
    }
  })();

  // --- CLIENTE CENTRALIZADO DE VISITAS Y LIKES ---
  // 1) Backend propio (/api/counters/*) cuando corre bajo Node/Express.
  // 2) CounterAPI v2 si se configura window.COUNTERAPI_V2_WORKSPACE.
  // 3) CountAPI público (countapi.mileshilliard.com) en GitHub Pages estático sin API key.
  const VISIT_SESSION_KEY = 'portfolio_visit_counted';
  const VISIT_CACHE_KEY = 'portfolio_visit_cached';
  const PUBLIC_COUNTER_BASE = 'https://countapi.mileshilliard.com/api/v1';
  const PUBLIC_KEY_PREFIX = 'nizatf-portfolio';
  let visitPromise = null;
  let hasLocalBackend = window.location.hostname.endsWith('.github.io') ? false : null;

  function safeStorageGet(type, key) {
    try {
      const storage = type === 'session' ? window.sessionStorage : window.localStorage;
      return storage.getItem(key);
    } catch {
      return null;
    }
  }
  function safeStorageSet(type, key, val) {
    try {
      const storage = type === 'session' ? window.sessionStorage : window.localStorage;
      storage.setItem(key, val);
    } catch {}
  }

  function parseCounterValue(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.data && typeof payload.data.up_count === 'number') return payload.data.up_count;
    if (typeof payload.up_count === 'number') return payload.up_count;
    if (typeof payload.count === 'number') return payload.count;
    if (typeof payload.value === 'number') return payload.value;
    return null;
  }

  async function tryLocalJson(url, method = 'GET') {
    if (hasLocalBackend === false) return null;
    try {
      const res = await fetch(url, { method, headers: { Accept: 'application/json' } });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        hasLocalBackend = true;
        return await res.json();
      }
      if (res.status === 404 || res.status === 405) {
        hasLocalBackend = false;
      }
    } catch {
      hasLocalBackend = false;
    }
    return null;
  }

  async function remoteGet(counterName) {
    const v2Workspace = window.COUNTERAPI_V2_WORKSPACE || '';
    if (v2Workspace) {
      const res = await fetch(`https://api.counterapi.dev/v2/${encodeURIComponent(v2Workspace)}/${counterName}`);
      if (res.status === 404) return 0;
      if (!res.ok) throw new Error('CounterAPI v2 error');
      return parseCounterValue(await res.json()) ?? 0;
    }

    const key = `${PUBLIC_KEY_PREFIX}-${counterName}`;
    const res = await fetch(`${PUBLIC_COUNTER_BASE}/get/${encodeURIComponent(key)}`);
    if (res.status === 404) return 0;
    if (!res.ok) throw new Error('Public counter error');
    return parseCounterValue(await res.json()) ?? 0;
  }

  async function remoteUp(counterName) {
    const v2Workspace = window.COUNTERAPI_V2_WORKSPACE || '';
    if (v2Workspace) {
      const res = await fetch(`https://api.counterapi.dev/v2/${encodeURIComponent(v2Workspace)}/${counterName}/up`);
      if (!res.ok) throw new Error('CounterAPI v2 error');
      return parseCounterValue(await res.json()) ?? 0;
    }

    const key = `${PUBLIC_KEY_PREFIX}-${counterName}`;
    const res = await fetch(`${PUBLIC_COUNTER_BASE}/hit/${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error('Public counter error');
    return parseCounterValue(await res.json()) ?? 0;
  }

  async function remoteDown(counterName) {
    const v2Workspace = window.COUNTERAPI_V2_WORKSPACE || '';
    if (v2Workspace) {
      const res = await fetch(`https://api.counterapi.dev/v2/${encodeURIComponent(v2Workspace)}/${counterName}/down`);
      if (!res.ok) throw new Error('CounterAPI v2 error');
      return parseCounterValue(await res.json()) ?? 0;
    }

    const key = `${PUBLIC_KEY_PREFIX}-${counterName}`;
    const current = await remoteGet(counterName);
    const next = Math.max(0, current - 1);
    const res = await fetch(`${PUBLIC_COUNTER_BASE}/set/${encodeURIComponent(key)}?value=${next}`);
    if (!res.ok) throw new Error('Public counter error');
    return parseCounterValue(await res.json()) ?? next;
  }

  async function ensureVisitCounted() {
    if (visitPromise) return visitPromise;

    visitPromise = (async () => {
      const alreadyCounted = safeStorageGet('session', VISIT_SESSION_KEY) === '1';
      try {
        let count = null;
        if (!alreadyCounted) {
          const localData = await tryLocalJson('/api/counters/visits/up', 'POST');
          if (localData) {
            count = parseCounterValue(localData);
          } else {
            count = await remoteUp('visits');
          }
          if (count !== null) {
            safeStorageSet('session', VISIT_SESSION_KEY, '1');
            safeStorageSet('session', VISIT_CACHE_KEY, String(count));
            return count;
          }
        } else {
          const localData = await tryLocalJson('/api/counters/visits', 'GET');
          if (localData) {
            count = parseCounterValue(localData);
          } else {
            count = await remoteGet('visits');
          }
          if (count !== null) {
            safeStorageSet('session', VISIT_CACHE_KEY, String(count));
            return count;
          }
        }
      } catch {
        const cached = safeStorageGet('session', VISIT_CACHE_KEY);
        if (cached !== null) return Number(cached);
      }
      return null;
    })();

    return visitPromise;
  }

  async function getSummary(projectIds = []) {
    const localSummary = await tryLocalJson('/api/counters/summary', 'GET');
    if (localSummary) return localSummary;

    let visits = 0;
    let totalLikes = 0;
    const likes = {};

    try {
      visits = await remoteGet('visits');
    } catch {
      visits = 0;
    }

    await Promise.all(
      projectIds.map(async (id) => {
        try {
          const c = await remoteGet(`likes-${id}`);
          likes[id] = c;
          totalLikes += c;
        } catch {
          likes[id] = 0;
        }
      })
    );

    return { visits, totalLikes, likes };
  }

  async function getProjectLikes(id) {
    const localData = await tryLocalJson(`/api/counters/likes/${encodeURIComponent(id)}`, 'GET');
    if (localData) {
      return parseCounterValue(localData) ?? 0;
    }
    try {
      return await remoteGet(`likes-${id}`);
    } catch {
      return null;
    }
  }

  async function setProjectLike(id, shouldLike) {
    const action = shouldLike ? 'up' : 'down';
    const localData = await tryLocalJson(`/api/counters/likes/${encodeURIComponent(id)}/${action}`, 'POST');
    if (localData) {
      const count = parseCounterValue(localData);
      if (count !== null) return count;
    }
    return shouldLike ? await remoteUp(`likes-${id}`) : await remoteDown(`likes-${id}`);
  }

  window.PortfolioCounters = {
    ensureVisitCounted,
    getSummary,
    getProjectLikes,
    setProjectLike,
    escapeHtml,
    safeGetLocal: (key) => safeStorageGet('local', key),
    safeSetLocal: (key, val) => safeStorageSet('local', key, val),
  };

  // --- LIMPIEZA BFCACHE (Botón Atrás del navegador) ---
  window.addEventListener('pageshow', () => {
    document.querySelectorAll('.page-transition-overlay').forEach((el) => el.remove());
  });

  // --- INICIALIZACIÓN PRINCIPAL (ÚNICO DOMContentLoaded) ---
  document.addEventListener('DOMContentLoaded', () => {
    const html = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');
    const dynamicFavicon = document.getElementById('dynamic-favicon');
    const logoDinamico = document.getElementById('logo-dinamico');

    // --- 1. DETECTAR Y APLICAR TEMA ---
    const savedTheme = safeStorageGet('local', 'theme');
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const initialTheme = savedTheme || (systemPrefersLight ? 'light' : 'dark');

    function updateAssets(theme) {
      if (dynamicFavicon) {
        const newIcon = theme === 'dark' ? 'assets/img/favicon_oscuro.png' : 'assets/img/favicon_claro.png';
        if (!dynamicFavicon.href.includes(newIcon)) {
          dynamicFavicon.href = `${newIcon}?v=${Date.now()}`;
        }
      }
      if (logoDinamico) {
        logoDinamico.src = theme === 'dark' ? 'assets/img/logo_oscuro.png' : 'assets/img/logo_claro.png';
      }
    }

    function updateIcon(theme) {
      if (themeToggle) {
        const iconSrc = theme === 'dark' ? 'assets/img/boton_oscuro.png' : 'assets/img/boton_claro.png';
        let iconImg = document.getElementById('theme-icon-img');
        if (!iconImg) {
          themeToggle.innerHTML = `<img id="theme-icon-img" src="${iconSrc}" alt="Cambiar tema" class="theme-icon-img">`;
        } else {
          iconImg.src = iconSrc;
        }
      }
      updateAssets(theme);
    }

    html.setAttribute('data-theme', initialTheme);
    updateIcon(initialTheme);

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        safeStorageSet('local', 'theme', newTheme);
        updateIcon(newTheme);
      });
    }

    // --- 2. BARRA DE PROGRESO Y BOTÓN VOLVER ARRIBA ---
    const progressBar = document.getElementById('scroll-progress');
    const backToTopBtn = document.getElementById('back-to-top');

    function updateScrollUI() {
      if (progressBar) {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const pct = height > 0 ? (winScroll / height) * 100 : 0;
        progressBar.style.width = `${pct}%`;
      }
      if (backToTopBtn) {
        backToTopBtn.classList.toggle('is-visible', window.scrollY > 400);
      }
    }

    window.addEventListener('scroll', updateScrollUI, { passive: true });
    updateScrollUI();

    if (backToTopBtn) {
      backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // --- 3. TRANSICIÓN SUAVE ENTRE PÁGINAS ---
    const navLinks = document.querySelectorAll('.nav-links a, a.card, a.btn');
    navLinks.forEach((link) => {
      link.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const href = this.getAttribute('href');
        if (
          this.classList.contains('active') ||
          !href ||
          href.startsWith('http') ||
          href.startsWith('mailto:') ||
          href.startsWith('#') ||
          this.target === '_blank' ||
          this.hasAttribute('download')
        ) {
          return;
        }

        e.preventDefault();
        const overlay = document.createElement('div');
        overlay.className = 'page-transition-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.backgroundColor = 'var(--bg)';
        overlay.style.zIndex = '99999';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.25s ease';
        overlay.style.pointerEvents = 'none';
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
          overlay.style.opacity = '1';
        });

        setTimeout(() => {
          window.location.href = href;
        }, 250);
      });
    });

    // --- 4. FECHA DE DESPLIEGUE (Footer) ---
    const sysLastDeploy = document.getElementById('sys-last-deploy');
    if (sysLastDeploy) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      sysLastDeploy.textContent = `LAST DEPLOY: ${year}-${month}-${day} ${hours}:${minutes}`;
    }

    // --- 5. WIDGET FLOTANTE DE VISITAS ---
    if (!window.location.pathname.includes('admin.html')) {
      const visitWidget = document.createElement('div');
      visitWidget.id = 'floating-visits';
      visitWidget.setAttribute('aria-live', 'polite');
      visitWidget.innerHTML = `<span aria-hidden="true">👁️</span> <span id="visit-counter">...</span> visitas`;
      document.body.appendChild(visitWidget);

      ensureVisitCounted().then((count) => {
        const counterEl = document.getElementById('visit-counter');
        if (counterEl) {
          counterEl.textContent = count !== null ? String(count) : '---';
        }
      });
    }
  });
})();
