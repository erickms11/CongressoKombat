// touchControls.js - Virtual On-Screen Touch Controls for Mobile & PWA
// Provides multi-touch D-Pad and arcade action layout with haptics

class TouchControls {
  constructor() {
    this.enabled = false;
    this.isTouchDevice = false;

    // Continuous button states
    this.state = {
      up: false,
      down: false,
      left: false,
      right: false,
      punchLight: false,
      punchHeavy: false,
      kick: false,
      special: false,
      super: false,
      block: false
    };

    // Menu action edge triggers (true for 1 frame)
    this.actionPulses = {
      up: false,
      down: false,
      left: false,
      right: false,
      confirm: false,
      back: false,
      pause: false,
      pauseMenu: false
    };

    // Action buttons are contextual: menu/select or fight.
    this.context = 'menu';

    this.activeTouches = new Map(); // identifier -> button key
    this.container = null;
    this.init();
  }

  init() {
    // Detect touch device
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Auto-enable if touch device detected, or allow manual toggle
    const savedPref = localStorage.getItem('ck_touch_controls');
    if (savedPref !== null) {
      this.enabled = savedPref === 'true';
    } else {
      this.enabled = this.isTouchDevice;
    }

    this.bindFocusGuards();
    this.createDOM();
    this.updateVisibility();
  }

  toggle() {
    this.setEnabled(!this.enabled);
    localStorage.setItem('ck_touch_controls', this.enabled);
    return this.enabled;
  }

  // Enables/disables the overlay. Disabling releases every held or pulsed state.
  setEnabled(flag) {
    this.enabled = !!flag;
    if (!this.enabled) this.releaseAll();
    this.updateVisibility();
  }

  // Outside fights, LP selects and LK goes back. In fights they keep their attack actions.
  setContext(context) {
    if (context !== 'menu' && context !== 'fight') return;
    const contextChanged = this.context !== context;
    this.context = context;

    const punchButton = this.container?.querySelector('[data-key="punchLight"]');
    const kickButton = this.container?.querySelector('[data-key="kick"]');
    if (punchButton) {
      punchButton.querySelector('.btn-lbl').textContent = context === 'fight' ? 'LP' : 'OK';
      punchButton.querySelector('.btn-sub').textContent = context === 'fight' ? 'SOCO' : 'SELECIONAR';
      punchButton.setAttribute('aria-label', context === 'fight' ? 'Soco rápido' : 'Selecionar');
    }
    if (kickButton) {
      kickButton.querySelector('.btn-lbl').textContent = context === 'fight' ? 'LK' : '↩';
      kickButton.querySelector('.btn-sub').textContent = context === 'fight' ? 'CHUTE' : 'VOLTAR';
      kickButton.setAttribute('aria-label', context === 'fight' ? 'Chute' : 'Voltar');
    }

    if (contextChanged) {
      for (const key of ['punchLight', 'punchHeavy', 'kick', 'special', 'super', 'block']) {
        this.state[key] = false;
      }
      this.actionPulses.confirm = false;
      this.actionPulses.back = false;
      this.container?.querySelectorAll('.touch-action-btn.active').forEach((el) => el.classList.remove('active'));
    }
  }

  setPauseAvailable(available) {
    const controls = this.container?.querySelector('[data-role="pause-controls"]');
    if (controls) controls.hidden = !available;
    if (!available) {
      this.actionPulses.pause = false;
      this.actionPulses.pauseMenu = false;
      controls?.querySelectorAll('.active').forEach((button) => button.classList.remove('active'));
    }
  }

  setPaused(paused) {
    const pauseButton = this.container?.querySelector('[data-key="pause"]');
    const menuButton = this.container?.querySelector('[data-key="pauseMenu"]');
    const icon = pauseButton?.querySelector('.touch-pause-icon');
    const label = pauseButton?.querySelector('.touch-pause-label');
    if (icon) icon.textContent = paused ? '▶' : '⏸';
    if (label) label.textContent = paused ? 'CONTINUAR' : 'PAUSA';
    if (menuButton) menuButton.hidden = !paused;
    if (!paused) this.actionPulses.pauseMenu = false;
  }

  // Clears all held states, pulses and visual 'active' classes (stuck-state guard).
  releaseAll() {
    for (const key of Object.keys(this.state)) this.state[key] = false;
    for (const key of Object.keys(this.actionPulses)) this.actionPulses[key] = false;
    this.activeTouches.clear();
    if (this.container) {
      this.container.querySelectorAll('.active').forEach((el) => el.classList.remove('active'));
    }
  }

  bindFocusGuards() {
    const release = () => this.releaseAll();
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) release();
    });
  }

  triggerHaptic(ms = 15) {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  }

  createDOM() {
    if (document.getElementById('touch-controls-container')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'touch-controls-container';
    wrapper.className = 'touch-controls-wrapper';

    wrapper.innerHTML = `
      <div class="touch-pause-controls" data-role="pause-controls" hidden>
        <button type="button" class="touch-pause-btn" data-key="pause" aria-label="Pausar ou continuar luta">
          <span class="touch-pause-icon">⏸</span>
          <span class="touch-pause-label">PAUSA</span>
        </button>
        <button type="button" class="touch-pause-menu-btn" data-key="pauseMenu" aria-label="Voltar ao menu de personagens" hidden>
          <span class="touch-pause-icon">↩</span>
          <span class="touch-pause-label">MENU</span>
        </button>
      </div>

      <!-- Left D-Pad -->
      <div class="touch-dpad-container" id="touch-dpad">
        <div class="touch-dpad-center"></div>
        <button type="button" class="touch-dpad-btn dpad-up" data-key="up" aria-label="Cima / Pular">
          <span>▲</span>
        </button>
        <button type="button" class="touch-dpad-btn dpad-left" data-key="left" aria-label="Esquerda / Recuar">
          <span>◀</span>
        </button>
        <button type="button" class="touch-dpad-btn dpad-right" data-key="right" aria-label="Direita / Avançar">
          <span>▶</span>
        </button>
        <button type="button" class="touch-dpad-btn dpad-down" data-key="down" aria-label="Baixo / Agachar">
          <span>▼</span>
        </button>
      </div>

      <!-- Right Action Cluster (Arcade layout) -->
      <div class="touch-actions-container">
        <!-- Top Row -->
        <div class="touch-action-row">
          <button type="button" class="touch-action-btn btn-lp" data-key="punchLight">
            <span class="btn-lbl">LP</span>
            <span class="btn-sub">SOCO</span>
          </button>
          <button type="button" class="touch-action-btn btn-hp" data-key="punchHeavy">
            <span class="btn-lbl">HP</span>
            <span class="btn-sub">FORTE</span>
          </button>
          <button type="button" class="touch-action-btn btn-sp" data-key="special">
            <span class="btn-lbl">SP</span>
            <span class="btn-sub">MAGIA</span>
          </button>
        </div>

        <!-- Bottom Row -->
        <div class="touch-action-row">
          <button type="button" class="touch-action-btn btn-lk" data-key="kick">
            <span class="btn-lbl">LK</span>
            <span class="btn-sub">CHUTE</span>
          </button>
          <button type="button" class="touch-action-btn btn-block" data-key="block" aria-label="Defesa">
            <span class="btn-lbl">DEF</span>
            <span class="btn-sub">DEFESA</span>
          </button>
          <button type="button" class="touch-action-btn btn-super" data-key="super">
            <span class="btn-lbl">SUPER</span>
            <span class="btn-sub">CPI 100%</span>
          </button>
        </div>
      </div>
    `;

    // Append into screen-container or document.body
    const screenContainer = document.getElementById('screen-container') || document.body;
    screenContainer.appendChild(wrapper);
    this.container = wrapper;

    this.bindTouchEvents();
    this.setContext(this.context);
  }

  bindTouchEvents() {
    const buttons = this.container.querySelectorAll('[data-key]');

    buttons.forEach((btn) => {
      const key = btn.getAttribute('data-key');

      const handlePress = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setButtonState(key, true);
        btn.classList.add('active');
        this.triggerHaptic(18);
      };

      const handleRelease = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setButtonState(key, false);
        btn.classList.remove('active');
        // Re-derive D-Pad directions from the touches still on the pad
        if (key === 'up' || key === 'down' || key === 'left' || key === 'right') {
          this.syncDpadFromTouches(e.touches || []);
        }
      };

      btn.addEventListener('touchstart', handlePress, { passive: false });
      btn.addEventListener('touchend', handleRelease, { passive: false });
      btn.addEventListener('touchcancel', handleRelease, { passive: false });

      // Support mouse preview on desktop
      btn.addEventListener('mousedown', handlePress);
      btn.addEventListener('mouseup', handleRelease);
      btn.addEventListener('mouseleave', handleRelease);
    });

    // Handle D-Pad continuous sliding across directions
    const dpad = document.getElementById('touch-dpad');
    if (dpad) {
      const handleDpadMove = (e) => {
        if (!e.touches) return;
        e.preventDefault();
        this.syncDpadFromTouches(e.touches);
      };

      dpad.addEventListener('touchmove', handleDpadMove, { passive: false });
    }
  }

  // Derives D-Pad directions from the touches currently on the pad (all clear if none).
  syncDpadFromTouches(touches) {
    const dpad = document.getElementById('touch-dpad');
    if (!dpad) return;

    const rect = dpad.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deadzone = 12;
    let dir = { up: false, down: false, left: false, right: false };

    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      if (
        t.clientX >= rect.left - 15 &&
        t.clientX <= rect.right + 15 &&
        t.clientY >= rect.top - 15 &&
        t.clientY <= rect.bottom + 15
      ) {
        const dx = t.clientX - centerX;
        const dy = t.clientY - centerY;
        dir = {
          left: dx < -deadzone,
          right: dx > deadzone,
          up: dy < -deadzone,
          down: dy > deadzone
        };
        break;
      }
    }

    for (const k of ['up', 'down', 'left', 'right']) {
      this.state[k] = dir[k];
      dpad.querySelector(`.dpad-${k}`)?.classList.toggle('active', dir[k]);
    }
  }

  setButtonState(key, isPressed) {
    if (key === 'pause' || key === 'pauseMenu') {
      if (isPressed) this.actionPulses[key] = true;
      return;
    }

    if (this.state.hasOwnProperty(key)) {
      const wasFalse = !this.state[key];
      this.state[key] = isPressed;

      // Pulse menu action on press edge
      if (isPressed && wasFalse) {
        if (key === 'up') this.actionPulses.up = true;
        if (key === 'down') this.actionPulses.down = true;
        if (key === 'left') this.actionPulses.left = true;
        if (key === 'right') this.actionPulses.right = true;
        if (this.context === 'menu' && key === 'punchLight') this.actionPulses.confirm = true;
        if (this.context === 'menu' && key === 'kick') this.actionPulses.back = true;
      }
    }
  }

  updateVisibility() {
    if (!this.container) return;
    if (this.enabled) {
      this.container.classList.remove('hidden');
      this.container.style.display = 'flex';
    } else {
      this.releaseAll();
      this.container.classList.add('hidden');
      this.container.style.display = 'none';
    }
  }

  getInputs() {
    return {
      up: this.state.up,
      down: this.state.down,
      left: this.state.left,
      right: this.state.right,
      punchLight: this.state.punchLight,
      punchHeavy: this.state.punchHeavy,
      kick: this.state.kick,
      special: this.state.special,
      super: this.state.super,
      block: this.state.block
    };
  }

  // Called once per frame after game logic: pulses no screen consumed expire here,
  // so they cannot leak into a later screen (e.g. a D-Pad press made during a fight).
  endFrame() {
    for (const key of Object.keys(this.actionPulses)) this.actionPulses[key] = false;
  }

  // Returns true once per pulse ('up'|'down'|'left'|'right'|'confirm'|'back'|'pause'|'pauseMenu')
  wasAction(action) {
    if (this.actionPulses[action]) {
      this.actionPulses[action] = false;
      return true;
    }
    return false;
  }
}

export const touchControls = new TouchControls();
