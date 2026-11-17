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
  // Usa el backend propio (/api/counters/*) cuando está disponible,
  // y soporta CounterAPI v2 si se configura window.COUNTERAPI_V2_WORKSPACE en static hosting.
  const VISIT_SESSION_KEY = 'portfolio_visit_counted';
  const VISIT_CACHE_KEY = 'portfolio_visit_cached';
  let visitPromise = null;

  function parseCounterValue(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.data && typeof payload.data.up_count === 'number') return payload.data.up_count;
    if (typeof payload.up_count === 'number') return payload.up_count;
    if (typeof payload.count === 'number') return payload.count;
    return null;
  }

  async function fetchCounterEndpoint(localPath, counterApiV2Path) {
    try {
      const res = await fetch(localPath, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback abajo si no hay backend local
    }

    const v2Workspace = window.COUNTERAPI_V2_WORKSPACE || '';
    if (v2Workspace && counterApiV2Path) {
      const v2Url = `https://api.counterapi.dev/v2/${encodeURIComponent(v2Workspace)}/${counterApiV2Path}`;
      const res = await fetch(v2Url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`CounterAPI v2 HTTP ${res.status}`);
      return await res.json();
    }

    throw new Error('Counter service unavailable');
  }

  async function ensureVisitCounted() {
    if (visitPromise) return visitPromise;

    visitPromise = (async () => {
      const alreadyCounted = sessionStorage.getItem(VISIT_SESSION_KEY) === '1';
      try {
        if (!alreadyCounted) {
          const res = await fetch('/api/counters/visits/up', {
            method: 'POST',
            headers: { Accept: 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            const count = parseCounterValue(data);
            if (count !== null) {
              sessionStorage.setItem(VISIT_SESSION_KEY, '1');
              sessionStorage.setItem(VISIT_CACHE_KEY, String(count));
              return count;
            }
          }
          // Si no hay backend local, intentar CounterAPI v2 si está configurado
          const v2Data = await fetchCounterEndpoint('/api/counters/visits/up', 'visits/up');
          const v2Count = parseCounterValue(v2Data);
          if (v2Count !== null) {
            sessionStorage.setItem(VISIT_SESSION_KEY, '1');
            sessionStorage.setItem(VISIT_CACHE_KEY, String(v2Count));
            return v2Count;
          }
        } else {
          const data = await fetchCounterEndpoint('/api/counters/visits', 'visits');
          const count = parseCounterValue(data);
          if (count !== null) {
            sessionStorage.setItem(VISIT_CACHE_KEY, String(count));
            return count;
          }
        }
      } catch {
        const cached = sessionStorage.getItem(VISIT_CACHE_KEY);
        if (cached !== null) return Number(cached);
      }
      return null;
    })();

    return visitPromise;
  }

  async function getSummary(projectIds = []) {
    try {
      const res = await fetch('/api/counters/summary', { headers: { Accept: 'application/json' } });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback a CounterAPI v2 si está configurado
    }

    const v2Workspace = window.COUNTERAPI_V2_WORKSPACE || '';
    if (v2Workspace) {
      let visits = 0;
      let totalLikes = 0;
      const likes = {};

      try {
        const vData = await fetchCounterEndpoint('/api/counters/visits', 'visits');
        visits = parseCounterValue(vData) ?? 0;
      } catch {
        visits = 0;
      }

      await Promise.all(
        projectIds.map(async (id) => {
          try {
            const lData = await fetchCounterEndpoint(`/api/counters/likes/${id}`, `likes-${id}`);
            const c = parseCounterValue(lData) ?? 0;
            likes[id] = c;
            totalLikes += c;
          } catch {
            likes[id] = 0;
          }
        })
      );

      return { visits, totalLikes, likes };
    }

    return null;
  }

  async function getProjectLikes(id) {
    try {
      const data = await fetchCounterEndpoint(
        `/api/counters/likes/${encodeURIComponent(id)}`,
        `likes-${encodeURIComponent(id)}`
      );
      return parseCounterValue(data) ?? 0;
    } catch {
      return null;
    }
  }

  async function setProjectLike(id, shouldLike) {
    const action = shouldLike ? 'up' : 'down';
    const localUrl = `/api/counters/likes/${encodeURIComponent(id)}/${action}`;
    try {
      const res = await fetch(localUrl, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const count = parseCounterValue(data);
        if (count !== null) return count;
      }
    } catch {
      // Fallback a CounterAPI v2 si está configurado
    }

    const v2Workspace = window.COUNTERAPI_V2_WORKSPACE || '';
    if (v2Workspace) {
      const v2Data = await fetchCounterEndpoint(localUrl, `likes-${encodeURIComponent(id)}/${action}`);
      const count = parseCounterValue(v2Data);
      if (count !== null) return count;
    }

    throw new Error('No se pudo actualizar el like');
  }

  window.PortfolioCounters = {
    ensureVisitCounted,
    getSummary,
    getProjectLikes,
    setProjectLike,
    escapeHtml,
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
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const initialTheme = savedTheme || (systemPrefersLight ? 'light' : 'dark');

    function updateAssets(theme) {
      if (dynamicFavicon) {
        const newIcon = theme === 'dark' ? '/assets/img/favicon_oscuro.png' : '/assets/img/favicon_claro.png';
        if (!dynamicFavicon.href.includes(newIcon)) {
          dynamicFavicon.href = `${newIcon}?v=${Date.now()}`;
        }
      }
      if (logoDinamico) {
        logoDinamico.src = theme === 'dark' ? '/assets/img/logo_oscuro.png' : '/assets/img/logo_claro.png';
      }
    }

    function updateIcon(theme) {
      if (themeToggle) {
        const iconSrc = theme === 'dark' ? '/assets/img/boton_oscuro.png' : '/assets/img/boton_claro.png';
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
        localStorage.setItem('theme', newTheme);
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
