(() => {
  const nav = document.querySelector(".nav");
  const navLinks = document.querySelector(".nav__links");
  const toggle = document.querySelector(".nav__toggle");
  const sections = document.querySelectorAll("main section[id]");
  const linkMap = new Map();
  document.querySelectorAll(".nav__links a").forEach((a) => {
    const id = a.getAttribute("href").slice(1);
    if (id) linkMap.set(id, a);
  });

  const onScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 8);

    let current = "";
    const probe = window.scrollY + 120;
    sections.forEach((s) => {
      if (s.offsetTop <= probe) current = s.id;
    });
    linkMap.forEach((link, id) => {
      link.classList.toggle("is-active", id === current);
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  toggle?.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  navLinks?.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      navLinks.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
    }
  });

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------ *
   * ASCII screens                                                       *
   * Shared plumbing for the <pre> animations: each "screen" object just *
   * provides an `el`, an optional `init()`, and a `frame()`.            *
   * ------------------------------------------------------------------ */

  // A monospace cell at 12px / 1.3 line-height is ~7.2px wide, ~15.6px tall.
  const gridSize = (el) => ({
    W: Math.max(Math.floor(el.clientWidth / 7.2), 20),
    H: Math.max(Math.floor(el.clientHeight / 15.6), 10),
  });

  // Flatten a W*H cell array into rows of text.
  const rowsToText = (cells, W, H) => {
    const rows = new Array(H);
    for (let r = 0; r < H; r++) {
      rows[r] = cells.slice(r * W, (r + 1) * W).join("");
    }
    return rows.join("\n");
  };

  const startLoop = (screen) => {
    if (screen.timer || !screen.el) return;
    screen.init?.();
    screen.frame();
    screen.timer = setInterval(() => screen.frame(), 50);
  };

  const stopLoop = (screen) => {
    clearInterval(screen.timer);
    screen.timer = null;
  };

  // Run a screen only while it's on-screen and the tab is visible.
  const runWhenVisible = (screen) => {
    if (!screen.el) return;
    let inView = false;
    const sync = () =>
      inView && !document.hidden ? startLoop(screen) : stopLoop(screen);

    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.05 }).observe(screen.el);

    document.addEventListener("visibilitychange", sync);
  };

  // Astro-travel starfield (ported from lcp-forge).
  const starfield = {
    el: document.getElementById("starfield"),
    timer: null,
    stars: [],
    speed: 18,
    N: 160,
    MAX_Z: 700,
    BRIGHT: " .,+*oO#@",

    spawn(fullRange) {
      const z = fullRange
        ? this.MAX_Z * (0.05 + Math.random() * 0.95)
        : this.MAX_Z;
      return {
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 1600,
        z,
        pz: z,
      };
    },

    init() {
      if (!this.stars.length) {
        this.stars = Array.from({ length: this.N }, () => this.spawn(true));
      }
    },

    frame() {
      const { W, H } = gridSize(this.el);
      this.el.textContent = this.render(W, H);
      for (const s of this.stars) {
        s.pz = s.z;
        s.z -= this.speed;
        if (s.z < 1) Object.assign(s, this.spawn(false));
      }
    },

    render(W, H) {
      const out = new Array(W * H).fill(" ");
      const FOV = 28;
      const K = 11 / 26;
      const B = this.BRIGHT;

      for (const s of this.stars) {
        const sx = Math.floor((s.x / s.z) * FOV + W / 2);
        const sy = Math.floor((s.y / s.z) * FOV * K + H / 2);
        if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;

        const t = 1 - s.z / this.MAX_Z;
        const ci = Math.min(Math.floor(t * t * (B.length - 1)) + 1, B.length - 1);
        out[sx + W * sy] = B[ci];

        if (s.pz > s.z) {
          const px = Math.floor((s.x / s.pz) * FOV + W / 2);
          const py = Math.floor((s.y / s.pz) * FOV * K + H / 2);
          if (px >= 0 && px < W && py >= 0 && py < H) {
            const pi = px + W * py;
            if (out[pi] === " ") out[pi] = ".";
          }
          if (t > 0.55) {
            const mx = Math.floor(((s.x / s.z + s.x / s.pz) / 2) * FOV + W / 2);
            const my = Math.floor(((s.y / s.z + s.y / s.pz) / 2) * FOV * K + H / 2);
            if (mx >= 0 && mx < W && my >= 0 && my < H && out[mx + W * my] === " ")
              out[mx + W * my] = ".";
          }
        }
      }

      return rowsToText(out, W, H);
    },
  };

  // Rotating, lit ASCII torus: the classic "donut" (Andy Sloane's math).
  // A surface point is built on the tube circle, rotated about two axes,
  // perspective-projected, z-buffered, and shaded by its normal · light.
  const torus = {
    el: document.getElementById("torus"),
    timer: null,
    A: 0, // rotation about the x-axis
    B: 0, // rotation about the z-axis
    SHADE: ".,-~:;=!*#$@",

    frame() {
      const { W, H } = gridSize(this.el);
      this.el.textContent = this.render(W, H);
      this.A += 0.07;
      this.B += 0.03;
    },

    render(W, H) {
      const { SHADE } = this;
      const cA = Math.cos(this.A), sA = Math.sin(this.A);
      const cB = Math.cos(this.B), sB = Math.sin(this.B);

      const out = new Array(W * H).fill(" ");
      const zbuf = new Array(W * H).fill(0);

      const R1 = 1; // tube radius
      const R2 = 2; // center-to-tube radius
      const K2 = 5; // viewer distance
      // Scale so the donut fits; y is halved because cells are ~2:1.
      const K1 = Math.min(W / 3, H / 1.5) * 1.3;
      const ASPECT = 0.46;

      for (let theta = 0; theta < 6.28; theta += 0.07) {
        const ct = Math.cos(theta), st = Math.sin(theta);
        const cx = R2 + R1 * ct; // point on the tube circle
        const cy = R1 * st;

        for (let phi = 0; phi < 6.28; phi += 0.02) {
          const cp = Math.cos(phi), sp = Math.sin(phi);

          const x = cx * (cB * cp + sA * sB * sp) - cy * cA * sB;
          const y = cx * (sB * cp - sA * cB * sp) + cy * cA * cB;
          const ooz = 1 / (K2 + cA * cx * sp + cy * sA);

          const xp = Math.floor(W / 2 + K1 * ooz * x);
          const yp = Math.floor(H / 2 - K1 * ooz * y * ASPECT);
          if (xp < 0 || xp >= W || yp < 0 || yp >= H) continue;

          // Luminance: surface normal dotted with the light direction.
          const lum =
            cp * ct * sB - cA * ct * sp - sA * st +
            cB * (cA * st - ct * sA * sp);

          const idx = xp + W * yp;
          if (lum > 0 && ooz > zbuf[idx]) {
            zbuf[idx] = ooz;
            out[idx] = SHADE[Math.min((lum * 8) | 0, SHADE.length - 1)];
          }
        }
      }

      return rowsToText(out, W, H);
    },
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reducedMotion) {
    runWhenVisible(starfield);
    runWhenVisible(torus);
  }
})();
