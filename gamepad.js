// gamepad.js - Xbox and Standard Gamepad Controller Support

export class GamepadManager {
  constructor() {
    this.gamepads = [];
    this.prevButtons = {};
    this.activeGamepadName = null;

    window.addEventListener('gamepadconnected', (e) => {
      console.log(`[Congresso Kombat] Gamepad conectado no índice ${e.gamepad.index}: ${e.gamepad.id}`);
      this.activeGamepadName = e.gamepad.id;
      this.updateStatusUI();
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log(`[Congresso Kombat] Gamepad desconectado do índice ${e.gamepad.index}`);
      this.activeGamepadName = null;
      this.updateStatusUI();
    });
  }

  updateStatusUI() {
    const statusEl = document.getElementById('gamepad-status');
    const badgeEl = document.getElementById('gamepad-badge');
    if (statusEl && badgeEl) {
      const gp = this.getGamepad(0);
      if (gp) {
        statusEl.textContent = 'Conectado (Xbox/Gamepad)';
        badgeEl.style.display = 'inline-flex';
        badgeEl.className = 'marquee-badge green';
      } else {
        statusEl.textContent = 'Nenhum controle detectado';
        badgeEl.style.display = 'none';
      }
    }
  }

  getGamepad(playerIndex = 0) {
    const rawGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let count = 0;
    for (let i = 0; i < rawGamepads.length; i++) {
      const gp = rawGamepads[i];
      if (gp && gp.connected) {
        if (count === playerIndex) return gp;
        count++;
      }
    }
    return null;
  }

  // Poll current inputs for a fighter (combines D-pad and Analog stick)
  getInputs(playerIndex = 0) {
    const gp = this.getGamepad(playerIndex);
    if (!gp) {
      return {
        left: false, right: false, up: false, down: false,
        punchLight: false, punchHeavy: false, kick: false,
        special: false, super: false, start: false, back: false
      };
    }

    const deadzone = 0.35;
    const axisX = gp.axes[0] || 0;
    const axisY = gp.axes[1] || 0;

    const dpadUp = gp.buttons[12] && gp.buttons[12].pressed;
    const dpadDown = gp.buttons[13] && gp.buttons[13].pressed;
    const dpadLeft = gp.buttons[14] && gp.buttons[14].pressed;
    const dpadRight = gp.buttons[15] && gp.buttons[15].pressed;

    const stickLeft = axisX < -deadzone;
    const stickRight = axisX > deadzone;
    const stickUp = axisY < -deadzone;
    const stickDown = axisY > deadzone;

    // Xbox buttons mapping:
    // A (0) = Light Punch / Confirm
    // X (2) = Heavy Punch
    // B (1) = Kick / Back
    // Y (3) = Special Projectile
    // RB (5) or RT (7) = Super CPI
    // LB (4) or LT (6) = Guard / Crouch
    // Start / Menu (9) = Start
    const btnA = gp.buttons[0] && gp.buttons[0].pressed;
    const btnB = gp.buttons[1] && gp.buttons[1].pressed;
    const btnX = gp.buttons[2] && gp.buttons[2].pressed;
    const btnY = gp.buttons[3] && gp.buttons[3].pressed;
    const btnLB = gp.buttons[4] && gp.buttons[4].pressed;
    const btnRB = gp.buttons[5] && gp.buttons[5].pressed;
    const btnLT = gp.buttons[6] && (gp.buttons[6].value > 0.3 || gp.buttons[6].pressed);
    const btnRT = gp.buttons[7] && (gp.buttons[7].value > 0.3 || gp.buttons[7].pressed);
    const btnStart = gp.buttons[9] && gp.buttons[9].pressed;
    const btnBack = gp.buttons[8] && gp.buttons[8].pressed;

    return {
      left: dpadLeft || stickLeft,
      right: dpadRight || stickRight,
      up: dpadUp || stickUp,
      down: dpadDown || stickDown || btnLT,
      punchLight: !!btnA,
      punchHeavy: !!btnX,
      kick: !!btnB,
      special: !!btnY,
      super: !!(btnRB || btnRT),
      block: !!(btnLB || btnLT),
      start: !!btnStart,
      back: !!btnBack
    };
  }

  // Single-press detection for menu navigation
  wasButtonPressed(playerIndex, buttonName) {
    const inpt = this.getInputs(playerIndex);
    const key = `${playerIndex}_${buttonName}`;
    const isPressed = inpt[buttonName];
    const wasPressed = this.prevButtons[key];
    this.prevButtons[key] = isPressed;
    return isPressed && !wasPressed;
  }
}

export const gamepadManager = new GamepadManager();
