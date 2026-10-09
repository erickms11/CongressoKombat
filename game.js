// game.js - Congresso Kombat Game Loop with 10 Brazilian Politicians and Xbox Controller Support

import {
  engineInit,
  mainCanvas,
  mainContext,
  setCanvasFixedSize,
  setShowSplashScreen,
  vec2,
  time,
  timeDelta
} from './littlejs.esm.js';

import { CHARACTERS, SIDES, getCharacterById } from './characters.js';
import { Fighter, FIGHTER_STATE, DIFFICULTY_LEVELS } from './fighter.js';
import { Projectile } from './projectile.js';
import { particleSystem } from './particles.js';
import { arcadeAudio } from './audio.js';
import { gamepadManager } from './gamepad.js';
import { networkManager } from './network.js';
import { touchControls } from './touchControls.js';

// Game Screen States
const SCREEN = {
  TITLE: 'TITLE',
  MODE_SELECT: 'MODE_SELECT',
  CHAR_SELECT: 'CHAR_SELECT',
  VERSUS: 'VERSUS',
  FIGHT: 'FIGHT',
  MATCH_OVER: 'MATCH_OVER'
};

// Configurable Game Settings
export const GAME_SETTINGS = {
  difficulty: localStorage.getItem('ck_difficulty') || 'NORMAL',
  roundTime: parseInt(localStorage.getItem('ck_round_time') || '99')
};
window.gameSettings = GAME_SETTINGS;

window.setGameDifficulty = function(diff) {
  if (DIFFICULTY_LEVELS[diff]) {
    GAME_SETTINGS.difficulty = diff;
    localStorage.setItem('ck_difficulty', diff);
    if (player2 && player2.isCpu) {
      player2.difficulty = DIFFICULTY_LEVELS[diff];
    }
  }
};

window.setGameRoundTime = function(t) {
  GAME_SETTINGS.roundTime = t;
  localStorage.setItem('ck_round_time', t.toString());
};

// Canvas Resolution (16:9 1280x720)
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const ARENA_GROUND_Y = 590;

// Game State
let currentScreen = SCREEN.TITLE;
let gameMode = '1P'; // '1P', '2P', 'ONLINE', 'TRAIN'

// Remote Client Inputs (for Host)
let remoteClientInputs = {
  left: false, right: false, up: false, down: false,
  punchLight: false, punchHeavy: false, kick: false,
  special: false, super: false
};

// Selection State (10 characters: 0-4 Esquerda, 5-9 Direita)
let p1SelectIndex = 0; // Lula
let p2SelectIndex = 5; // Bolsonaro
let p1Confirmed = false;
let p2Confirmed = false;

// Active Fighters & Projectiles
let player1 = null;
let player2 = null;
let projectiles = [];

// Match Timers & Rounds
let matchTimer = 99;
let matchTimerAccum = 0;
let currentRound = 1;
const MAX_ROUNDS = 2; // Best of 3
let roundState = 'INTRO'; // 'INTRO', 'FIGHTING', 'KO', 'OUTRO'
let roundStateTimer = 0;
let matchWinner = null;

// Screen Shake & Hit Stop
let screenShake = 0;
let hitStopTimer = 0;

// Preloaded Images & Chroma-Keyed Spritesheets
const images = {};
const spriteCanvases = {};
window.spriteCanvases = spriteCanvases;

function preloadImage(key, src, chromaKey = null) {
  const img = new Image();
  img.src = src;
  images[key] = img;

  if (chromaKey) {
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const d = imgData.data;
        const [kr, kg, kb] = chromaKey;
        const w = c.width;
        const h = c.height;

        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const dr = r - kr;
          const dg = g - kg;
          const db = b - kb;
          const distSq = dr * dr + dg * dg + db * db;

          // Generous magenta threshold to cleanly remove JPEG compression artifacts
          if (distSq < 11500) {
            d[i + 3] = 0; // Transparent
          }
        }

        // Clear outer 2px perimeter of sheet to prevent any border artifact
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (x < 2 || x >= w - 2 || y < 2 || y >= h - 2) {
              const idx = (y * w + x) * 4;
              d[idx + 3] = 0;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        spriteCanvases[key] = c;
        console.log(`[Spritesheet] Pronto com chroma-key: ${key} (${img.width}x${img.height})`);
      } catch (err) {
        console.warn(`[Spritesheet] Erro ao aplicar chroma key em ${key}:`, err);
      }
    };
    img.onerror = () => {
      // Missing spritesheet image is silently ignored; fighter falls back to procedural caricature
    };
  }
}

// Input Manager for Keyboard
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  arcadeAudio.init(); // Initialize audio context on user interaction
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// Helper for single-press trigger
const prevKeys = {};
function wasKeyPressed(code) {
  return keys[code] && !prevKeys[code];
}

// Map Controls for P1 and P2 (Keyboard + Xbox Gamepad + Touch Controls Merged!)
function getPlayerInputs(playerNum) {
  const gp = gamepadManager.getInputs(playerNum - 1);
  const tc = (playerNum === 1) ? touchControls.getInputs() : {};

  if (playerNum === 1) {
    // Em 2P, P1 usa só WASD+JKLUI para não colidir com P2 (setas/ZXCV/Espaço)
    const solo = gameMode !== '2P';
    const kbLeft = keys['KeyA'] || (solo && keys['ArrowLeft']);
    const kbRight = keys['KeyD'] || (solo && keys['ArrowRight']);
    const kbUp = keys['KeyW'] || (solo && keys['ArrowUp']);
    const kbDown = keys['KeyS'] || (solo && keys['ArrowDown']);
    const kbPunchL = keys['KeyJ'] || (solo && keys['KeyZ']);
    const kbPunchH = keys['KeyK'] || (solo && keys['KeyX']);
    const kbKick = keys['KeyL'] || (solo && keys['KeyC']);
    const kbSpecial = keys['KeyU'] || (solo && keys['KeyV']);
    const kbSuper = keys['KeyI'] || (solo && keys['Space']);

    return {
      left: kbLeft || gp.left || tc.left,
      right: kbRight || gp.right || tc.right,
      up: kbUp || gp.up || tc.up,
      down: kbDown || gp.down || tc.down,
      punchLight: kbPunchL || gp.punchLight || tc.punchLight,
      punchHeavy: kbPunchH || gp.punchHeavy || tc.punchHeavy,
      kick: kbKick || gp.kick || tc.kick,
      special: kbSpecial || gp.special || tc.special,
      super: kbSuper || gp.super || tc.super,
      block: gp.block || tc.block,
      start: keys['Enter'] || gp.start
    };
  } else {
    // Player 2 controls (Setas+ZXCV/Espaço, Numpad + Gamepad 1)
    const kbLeft = keys['ArrowLeft'] || keys['Numpad4'];
    const kbRight = keys['ArrowRight'] || keys['Numpad6'];
    const kbUp = keys['ArrowUp'] || keys['Numpad8'];
    const kbDown = keys['ArrowDown'] || keys['Numpad5'];
    const kbPunchL = keys['KeyZ'] || keys['Numpad1'];
    const kbPunchH = keys['KeyX'] || keys['Numpad2'];
    const kbKick = keys['KeyC'] || keys['Numpad3'];
    const kbSpecial = keys['KeyV'] || keys['Numpad0'];
    const kbSuper = keys['Space'] || keys['NumpadEnter'];

    return {
      left: kbLeft || gp.left,
      right: kbRight || gp.right,
      up: kbUp || gp.up,
      down: kbDown || gp.down,
      punchLight: kbPunchL || gp.punchLight,
      punchHeavy: kbPunchH || gp.punchHeavy,
      kick: kbKick || gp.kick,
      special: kbSpecial || gp.special,
      super: kbSuper || gp.super,
      block: gp.block,
      start: keys['Enter'] || gp.start
    };
  }
}

// Check single menu action from Keyboard, Xbox controller, or Touch Controls
function checkMenuAction(playerIndex, action) {
  // Em 2P, setas são exclusivas do P2 apenas em telas onde P2 é consultado (não em TITLE/MODE_SELECT)
  const p2Consulted = gameMode === '2P' && currentScreen !== SCREEN.TITLE && currentScreen !== SCREEN.MODE_SELECT;
  const solo = !p2Consulted;
  if (playerIndex === 0) {
    if (action === 'up') return wasKeyPressed('KeyW') || (solo && wasKeyPressed('ArrowUp')) || gamepadManager.wasButtonPressed(0, 'up') || touchControls.wasAction('up');
    if (action === 'down') return wasKeyPressed('KeyS') || (solo && wasKeyPressed('ArrowDown')) || gamepadManager.wasButtonPressed(0, 'down') || touchControls.wasAction('down');
    if (action === 'left') return wasKeyPressed('KeyA') || (solo && wasKeyPressed('ArrowLeft')) || gamepadManager.wasButtonPressed(0, 'left') || touchControls.wasAction('left');
    if (action === 'right') return wasKeyPressed('KeyD') || (solo && wasKeyPressed('ArrowRight')) || gamepadManager.wasButtonPressed(0, 'right') || touchControls.wasAction('right');
    if (action === 'confirm') return wasKeyPressed('Enter') || (!p2Consulted && wasKeyPressed('Space')) || wasKeyPressed('KeyJ') || gamepadManager.wasButtonPressed(0, 'punchLight') || gamepadManager.wasButtonPressed(0, 'start') || touchControls.wasAction('confirm');
    if (action === 'back') return wasKeyPressed('Escape') || gamepadManager.wasButtonPressed(0, 'kick') || touchControls.wasAction('back');
  } else {
    if (action === 'up') return wasKeyPressed('ArrowUp') || wasKeyPressed('Numpad8') || gamepadManager.wasButtonPressed(1, 'up');
    if (action === 'down') return wasKeyPressed('ArrowDown') || wasKeyPressed('Numpad5') || gamepadManager.wasButtonPressed(1, 'down');
    if (action === 'left') return wasKeyPressed('ArrowLeft') || wasKeyPressed('Numpad4') || gamepadManager.wasButtonPressed(1, 'left');
    if (action === 'right') return wasKeyPressed('ArrowRight') || wasKeyPressed('Numpad6') || gamepadManager.wasButtonPressed(1, 'right');
    if (action === 'confirm') return wasKeyPressed('NumpadEnter') || wasKeyPressed('KeyZ') || gamepadManager.wasButtonPressed(1, 'punchLight') || gamepadManager.wasButtonPressed(1, 'start');
    if (action === 'back') return gamepadManager.wasButtonPressed(1, 'kick');
  }
  return false;
}

// Touch contract: LP confirms and LK goes back in menus; both revert to attacks in fights.
function setTouchContext(context) {
  if (typeof touchControls.setContext === 'function') touchControls.setContext(context);
}

// Network packet handler
function handleNetworkData(data) {
  if (!data) return;

  if (data.type === 'p1_select') {
    p1SelectIndex = data.index;
    p1Confirmed = data.confirmed;
    if (data.confirmed) arcadeAudio.menuConfirm();
  } else if (data.type === 'p2_select') {
    p2SelectIndex = data.index;
    p2Confirmed = data.confirmed;
    if (data.confirmed) arcadeAudio.menuConfirm();
  } else if (data.type === 'start_match') {
    p1SelectIndex = data.p1Index;
    p2SelectIndex = data.p2Index;
    versusTimer = 0;
    currentScreen = SCREEN.VERSUS;
    arcadeAudio.speak(`${CHARACTERS[p1SelectIndex].name} contra ${CHARACTERS[p2SelectIndex].name}!`);
  } else if (data.type === 'client_input') {
    if (data.inputs) remoteClientInputs = data.inputs;
  } else if (data.type === 'sync') {
    // Client receives authoritative simulation state from Host
    if (player1 && data.p1) {
      player1.x = data.p1.x;
      player1.y = data.p1.y;
      player1.hp = data.p1.hp;
      player1.displayHp = data.p1.displayHp;
      player1.state = data.p1.state;
      player1.facing = data.p1.facing;
      player1.superMeter = data.p1.superMeter;
      player1.roundsWon = data.p1.roundsWon;
      player1.animFrame = data.p1.animFrame;
    }
    if (player2 && data.p2) {
      player2.x = data.p2.x;
      player2.y = data.p2.y;
      player2.hp = data.p2.hp;
      player2.displayHp = data.p2.displayHp;
      player2.state = data.p2.state;
      player2.facing = data.p2.facing;
      player2.superMeter = data.p2.superMeter;
      player2.roundsWon = data.p2.roundsWon;
      player2.animFrame = data.p2.animFrame;
    }
    if (data.matchTimer !== undefined) matchTimer = data.matchTimer;
    if (data.roundState !== undefined) roundState = data.roundState;
    if (data.roundStateTimer !== undefined) roundStateTimer = data.roundStateTimer;
    if (data.currentRound !== undefined) currentRound = data.currentRound;
    if (data.screen === SCREEN.MATCH_OVER && currentScreen !== SCREEN.MATCH_OVER) {
      matchWinner = data.winner === 1 ? player1 : player2;
      currentScreen = SCREEN.MATCH_OVER;
    } else if (data.screen === SCREEN.CHAR_SELECT && currentScreen === SCREEN.MATCH_OVER) {
      p1Confirmed = false;
      p2Confirmed = false;
      currentScreen = SCREEN.CHAR_SELECT;
    }

    // Sync projectiles visually
    if (data.projs) {
      projectiles = data.projs.map(pd => new Projectile({
        owner: null,
        x: pd.x,
        y: pd.y,
        vx: pd.vx,
        type: pd.type,
        color: pd.color,
        radius: pd.radius,
        damage: 0
      }));
    }
  }
}

function handleNetworkDisconnect() {
  alert('Conexão perdida com o oponente no plenário!');
  currentScreen = SCREEN.MODE_SELECT;
  gameMode = '1P';
}

// --- INIT ---
function gameInit() {
  setShowSplashScreen(false);
  setCanvasFixedSize(vec2(CANVAS_WIDTH, CANVAS_HEIGHT));

  // Preload Background & Title
  preloadImage('bg_congress', 'assets/bg_congress.jpg');
  preloadImage('logo_title', 'assets/logo_title.jpg');

  // Preload all 10 Politician Portraits
  preloadImage('portrait_lula', 'assets/portrait_lula.jpg');
  preloadImage('portrait_dilma', 'assets/portrait_dilma.jpg');
  preloadImage('portrait_haddad', 'assets/portrait_haddad.jpg');
  preloadImage('portrait_boulos', 'assets/portrait_boulos.jpg');
  preloadImage('portrait_jones', 'assets/portrait_jones.jpg');

  preloadImage('portrait_bolsonaro', 'assets/portrait_bolsonaro.jpg');
  preloadImage('portrait_tarcisio', 'assets/portrait_tarcisio.jpg');
  preloadImage('portrait_nikolas', 'assets/portrait_nikolas.jpg');
  preloadImage('portrait_flavio', 'assets/portrait_flavio.jpg');
  preloadImage('portrait_campopiano', 'assets/portrait_campopiano.jpg');

  // Preload High-Resolution 16-Bit Fighter Spritesheets (Chroma-Keyed) for all 10 politicians
  const ALL_POLITICIAN_IDS = [
    'lula', 'dilma', 'haddad', 'boulos', 'jones',
    'bolsonaro', 'tarcisio', 'nikolas', 'flavio', 'campopiano'
  ];
  ALL_POLITICIAN_IDS.forEach(id => {
    preloadImage(`spritesheet_${id}`, `assets/spritesheet_${id}.jpg`, [255, 0, 255]);
  });

  // Setup Online Multiplayer Modal Events
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const onlineModalClose = document.getElementById('online-modal-close');
  const modalOnline = document.getElementById('modal-online');

  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', () => {
      document.getElementById('host-status').textContent = 'Conectando ao PeerJS...';
      networkManager.createRoom(
        (code) => {
          document.getElementById('host-room-code').textContent = code;
          document.getElementById('host-code-display').style.display = 'flex';
          document.getElementById('host-status').textContent = 'Sala aberta! Aguardando oponente entrar...';
        },
        (isHost) => {
          document.getElementById('host-status').textContent = 'Oponente conectado! Iniciando...';
          setTimeout(() => {
            if (modalOnline) modalOnline.classList.remove('active');
            gameMode = 'ONLINE';
            p1Confirmed = false;
            p2Confirmed = false;
            currentScreen = SCREEN.CHAR_SELECT;
            arcadeAudio.menuConfirm();
          }, 600);
        },
        handleNetworkData,
        handleNetworkDisconnect
      );
    });
  }

  if (btnJoinRoom) {
    btnJoinRoom.addEventListener('click', () => {
      const input = document.getElementById('input-room-code');
      const code = input ? input.value.trim().toUpperCase() : '';
      if (!code) {
        alert('Digite o código da sala!');
        return;
      }
      document.getElementById('join-status').textContent = 'Conectando à sala ' + code + '...';
      networkManager.joinRoom(
        code,
        (isHost) => {
          document.getElementById('join-status').textContent = 'Conectado com sucesso!';
          setTimeout(() => {
            if (modalOnline) modalOnline.classList.remove('active');
            gameMode = 'ONLINE';
            p1Confirmed = false;
            p2Confirmed = false;
            currentScreen = SCREEN.CHAR_SELECT;
            arcadeAudio.menuConfirm();
          }, 600);
        },
        handleNetworkData,
        handleNetworkDisconnect,
        () => {
          document.getElementById('join-status').textContent = 'Erro ao conectar. Código inválido ou sala fechada.';
        }
      );
    });
  }

  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      const code = document.getElementById('host-room-code').textContent;
      if (code && code !== '---') {
        navigator.clipboard.writeText(code).then(() => {
          btnCopyCode.textContent = 'Copiado!';
          setTimeout(() => { btnCopyCode.textContent = 'Copiar'; }, 2000);
        }).catch(() => {});
      }
    });
  }

  // Direct Canvas Touch / Click Support for Mobile UI & Character Selection
  if (mainCanvas) {
    const handleCanvasTap = (e) => {
      // Don't intercept if touching virtual control buttons
      if (e.target && e.target.closest && e.target.closest('.touch-controls-wrapper')) return;

      const rect = mainCanvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const touchEv = (e.touches && e.touches[0]) ? e.touches[0] : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : e);
      const tapX = (touchEv.clientX - rect.left) * scaleX;
      const tapY = (touchEv.clientY - rect.top) * scaleY;

      if (currentScreen === SCREEN.TITLE) {
        currentScreen = SCREEN.MODE_SELECT;
        arcadeAudio.menuConfirm();
        return;
      }

      if (currentScreen === SCREEN.MODE_SELECT) {
        MODES.forEach((m, i) => {
          const y = 135 + i * 102;
          if (tapX >= CANVAS_WIDTH / 2 - 380 && tapX <= CANVAS_WIDTH / 2 + 380 && tapY >= y && tapY <= y + 90) {
            modeIndex = i;
            const selected = MODES[modeIndex].id;
            arcadeAudio.menuConfirm();
            if (selected === 'ONLINE') {
              const modal = document.getElementById('modal-online');
              if (modal) modal.classList.add('active');
              return;
            }
            if (selected === 'SETTINGS') {
              const modal = document.getElementById('modal-settings');
              if (modal) modal.classList.add('active');
              return;
            }
            gameMode = selected;
            p1SelectIndex = 0;
            p2SelectIndex = 5;
            p1Confirmed = false;
            p2Confirmed = false;
            currentScreen = SCREEN.CHAR_SELECT;
          }
        });
        return;
      }

      if (currentScreen === SCREEN.CHAR_SELECT) {
        CHARACTERS.forEach((c, i) => {
          const cardX = (i < 5) ? (40 + i * 116) : (670 + (i - 5) * 116);
          const cardY = 108;
          const cardW = 104;
          const cardH = 145;

          if (tapX >= cardX && tapX <= cardX + cardW && tapY >= cardY && tapY <= cardY + cardH) {
            if (!p1Confirmed) {
              if (p1SelectIndex === i) {
                p1Confirmed = true;
                arcadeAudio.menuConfirm();
                arcadeAudio.speak(CHARACTERS[p1SelectIndex].name);
                p2SelectIndex = (p1SelectIndex < 5) ? 5 : 0;
                p2Confirmed = false;
              } else {
                p1SelectIndex = i;
                arcadeAudio.menuSelect();
              }
            } else if (!p2Confirmed && gameMode !== 'ONLINE') {
              if (p2SelectIndex === i) {
                p2Confirmed = true;
                arcadeAudio.menuConfirm();
                arcadeAudio.speak(CHARACTERS[p2SelectIndex].name);
                setTimeout(() => {
                  versusTimer = 0;
                  currentScreen = SCREEN.VERSUS;
                  arcadeAudio.speak(`${CHARACTERS[p1SelectIndex].name} contra ${CHARACTERS[p2SelectIndex].name}!`);
                }, 400);
              } else {
                p2SelectIndex = i;
                arcadeAudio.menuSelect();
              }
            }
          }
        });
        return;
      }

      if (currentScreen === SCREEN.MATCH_OVER) {
        currentScreen = SCREEN.CHAR_SELECT;
        p1Confirmed = false;
        p2Confirmed = false;
        arcadeAudio.menuConfirm();
      }
    };

    mainCanvas.addEventListener('click', handleCanvasTap);
    mainCanvas.addEventListener('touchend', (e) => {
      // Prevent unwanted double-firing with click
      handleCanvasTap(e);
      e.preventDefault();
    }, { passive: false });
  }

  console.log('[Congresso Kombat] 10 Personagens, Xbox, Touch Mobile e PWA prontos!');
}

// --- UPDATE ---
function gameUpdate() {
  const dt = timeDelta;

  // Hit Stop (Freeze frame effect on heavy hit)
  if (hitStopTimer > 0) {
    hitStopTimer -= dt;
    return;
  }

  // Decay Screen Shake
  if (screenShake > 0) {
    screenShake = Math.max(0, screenShake - dt * 25);
  }

  setTouchContext(currentScreen === SCREEN.FIGHT ? 'fight' : 'menu');

  // State Updates
  switch (currentScreen) {
    case SCREEN.TITLE:
      updateTitleScreen();
      break;
    case SCREEN.MODE_SELECT:
      updateModeSelect();
      break;
    case SCREEN.CHAR_SELECT:
      updateCharSelect();
      break;
    case SCREEN.VERSUS:
      updateVersusScreen(dt);
      break;
    case SCREEN.FIGHT:
      if (updatePauseState()) {
        if (gamepadManager.wasButtonPressed(0, 'kick')) {
          paused = false;
          currentScreen = SCREEN.CHAR_SELECT;
          p1Confirmed = false;
          p2Confirmed = false;
          arcadeAudio.menuSelect();
        }
      } else {
        updateFight(dt);
      }
      break;
    case SCREEN.MATCH_OVER:
      updateMatchOver();
      break;
  }

  // Save previous key states for single-press detection
  for (const k in keys) {
    prevKeys[k] = keys[k];
  }
  touchControls.endFrame();
}

// Pausa local: Escape/Start alternam; nunca ativa no ONLINE
let paused = false;
function updatePauseState() {
  if (gameMode === 'ONLINE') {
    paused = false;
    return false;
  }

  if (wasKeyPressed('Escape') || gamepadManager.wasButtonPressed(0, 'start') || gamepadManager.wasButtonPressed(1, 'start')) {
    paused = !paused;
    arcadeAudio.menuSelect();
  } else if (!paused && gamepadManager.wasButtonPressed(0, 'kick')) {
    // Botão B durante a luta abre a pausa
    paused = true;
    arcadeAudio.menuSelect();
  }
  return paused;
}

// --- TITLE SCREEN ---
let titleBlink = 0;
function updateTitleScreen() {
  titleBlink += timeDelta * 3;
  if (checkMenuAction(0, 'confirm')) {
    arcadeAudio.menuConfirm();
    arcadeAudio.startBGM();
    currentScreen = SCREEN.MODE_SELECT;
  }
}

// --- MODE SELECT SCREEN ---
let modeIndex = 0;
const MODES = [
  { id: '1P', name: '1P vs CPU (Modo Arcade)', desc: 'Escolha seu político e enfrente a oposição com dificuldade balanceada!' },
  { id: '2P', name: '2 Jogadores (Versus Local)', desc: 'Dois jogadores no mesmo teclado ou controles de Xbox!' },
  { id: 'ONLINE', name: 'Versus Online (PeerJS WebRTC)', desc: 'Dispute contra outro jogador online via código de sala P2P sem lag!' },
  { id: 'TRAIN', name: 'Modo Treino (Prática)', desc: 'Treine socos, rasteiras, projéteis e especiais à vontade.' },
  { id: 'SETTINGS', name: '⚙️ Configurações & Dificuldade', desc: 'Ajuste a dificuldade da IA da CPU, tempo de round e controles.' }
];

function updateModeSelect() {
  if (checkMenuAction(0, 'up')) {
    modeIndex = (modeIndex - 1 + MODES.length) % MODES.length;
    arcadeAudio.menuSelect();
  }
  if (checkMenuAction(0, 'down')) {
    modeIndex = (modeIndex + 1) % MODES.length;
    arcadeAudio.menuSelect();
  }
  if (checkMenuAction(0, 'confirm')) {
    const selected = MODES[modeIndex].id;
    arcadeAudio.menuConfirm();

    if (selected === 'ONLINE') {
      // Open Online Lobby Modal
      const modal = document.getElementById('modal-online');
      if (modal) modal.classList.add('active');
      return;
    }

    if (selected === 'SETTINGS') {
      // Open Settings Modal
      const modal = document.getElementById('modal-settings');
      if (modal) modal.classList.add('active');
      return;
    }

    gameMode = selected;
    p1SelectIndex = 0;
    p2SelectIndex = 5;
    p1Confirmed = false;
    p2Confirmed = false;
    currentScreen = SCREEN.CHAR_SELECT;
  }
  if (checkMenuAction(0, 'back')) {
    currentScreen = SCREEN.TITLE;
    arcadeAudio.menuSelect();
  }
}

// --- CHARACTER SELECT SCREEN ---
function updateCharSelect() {
  if (gameMode === 'ONLINE') {
    // Online selection: Host controls P1, Client controls P2
    if (networkManager.isHost && !p1Confirmed) {
      let changed = false;
      if (checkMenuAction(0, 'left')) {
        p1SelectIndex = (p1SelectIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
        changed = true;
      }
      if (checkMenuAction(0, 'right')) {
        p1SelectIndex = (p1SelectIndex + 1) % CHARACTERS.length;
        changed = true;
      }
      if (checkMenuAction(0, 'up') || checkMenuAction(0, 'down')) {
        p1SelectIndex = (p1SelectIndex + 5) % CHARACTERS.length;
        changed = true;
      }
      if (changed) {
        arcadeAudio.menuSelect();
        networkManager.send({ type: 'p1_select', index: p1SelectIndex, confirmed: false });
      }
      if (checkMenuAction(0, 'confirm')) {
        p1Confirmed = true;
        arcadeAudio.menuConfirm();
        arcadeAudio.speak(CHARACTERS[p1SelectIndex].name);
        networkManager.send({ type: 'p1_select', index: p1SelectIndex, confirmed: true });
      }
    } else if (!networkManager.isHost && !p2Confirmed) {
      let changed = false;
      if (checkMenuAction(0, 'left')) {
        p2SelectIndex = (p2SelectIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
        changed = true;
      }
      if (checkMenuAction(0, 'right')) {
        p2SelectIndex = (p2SelectIndex + 1) % CHARACTERS.length;
        changed = true;
      }
      if (checkMenuAction(0, 'up') || checkMenuAction(0, 'down')) {
        p2SelectIndex = (p2SelectIndex + 5) % CHARACTERS.length;
        changed = true;
      }
      if (changed) {
        arcadeAudio.menuSelect();
        networkManager.send({ type: 'p2_select', index: p2SelectIndex, confirmed: false });
      }
      if (checkMenuAction(0, 'confirm')) {
        p2Confirmed = true;
        arcadeAudio.menuConfirm();
        arcadeAudio.speak(CHARACTERS[p2SelectIndex].name);
        networkManager.send({ type: 'p2_select', index: p2SelectIndex, confirmed: true });
      }
    }

    // When both confirmed online, Host triggers match start
    if (networkManager.isHost && p1Confirmed && p2Confirmed && currentScreen === SCREEN.CHAR_SELECT) {
      versusTimer = 0;
      currentScreen = SCREEN.VERSUS;
      networkManager.send({
        type: 'start_match',
        p1Index: p1SelectIndex,
        p2Index: p2SelectIndex
      });
      arcadeAudio.speak(`${CHARACTERS[p1SelectIndex].name} contra ${CHARACTERS[p2SelectIndex].name}!`);
    }
    return;
  }

  // --- LOCAL 2-STEP SELECTION (1P Arcade, 2P Versus, Modo Treino) ---

  // PASSO 1: Escolha do Jogador 1 (P1)
  if (!p1Confirmed) {
    if (checkMenuAction(0, 'left')) {
      p1SelectIndex = (p1SelectIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
      arcadeAudio.menuSelect();
    }
    if (checkMenuAction(0, 'right')) {
      p1SelectIndex = (p1SelectIndex + 1) % CHARACTERS.length;
      arcadeAudio.menuSelect();
    }
    if (checkMenuAction(0, 'up') || checkMenuAction(0, 'down')) {
      // Pula instantaneamente entre Ala Esquerda (0-4) e Ala Direita (5-9)
      p1SelectIndex = (p1SelectIndex + 5) % CHARACTERS.length;
      arcadeAudio.menuSelect();
    }
    if (checkMenuAction(0, 'confirm')) {
      p1Confirmed = true;
      arcadeAudio.menuConfirm();
      arcadeAudio.speak(CHARACTERS[p1SelectIndex].name);

      // Sugestão inicial do Oponente: primeiro da ala oposta
      p2SelectIndex = (p1SelectIndex < 5) ? 5 : 0;
      p2Confirmed = false;
    }
    if (checkMenuAction(0, 'back')) {
      currentScreen = SCREEN.MODE_SELECT;
      arcadeAudio.menuSelect();
    }
    return;
  }

  // PASSO 2: Escolha do Oponente (CPU no 1P / Jogador 2 no 2P)
  if (p1Confirmed && !p2Confirmed) {
    // Ambos os controles podem navegar a escolha do oponente
    const navLeft = checkMenuAction(0, 'left') || (gameMode === '2P' && checkMenuAction(1, 'left'));
    const navRight = checkMenuAction(0, 'right') || (gameMode === '2P' && checkMenuAction(1, 'right'));
    const navJump = checkMenuAction(0, 'up') || checkMenuAction(0, 'down') || (gameMode === '2P' && (checkMenuAction(1, 'up') || checkMenuAction(1, 'down')));
    const doConfirm = checkMenuAction(0, 'confirm') || (gameMode === '2P' && checkMenuAction(1, 'confirm'));
    const doBack = checkMenuAction(0, 'back') || (gameMode === '2P' && checkMenuAction(1, 'back'));

    if (navLeft) {
      p2SelectIndex = (p2SelectIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
      arcadeAudio.menuSelect();
    }
    if (navRight) {
      p2SelectIndex = (p2SelectIndex + 1) % CHARACTERS.length;
      arcadeAudio.menuSelect();
    }
    if (navJump) {
      p2SelectIndex = (p2SelectIndex + 5) % CHARACTERS.length;
      arcadeAudio.menuSelect();
    }

    // Cancelar e voltar para escolher o P1 novamente
    if (doBack) {
      p1Confirmed = false;
      arcadeAudio.menuSelect();
      return;
    }

    if (doConfirm) {
      p2Confirmed = true;
      arcadeAudio.menuConfirm();
      arcadeAudio.speak(CHARACTERS[p2SelectIndex].name);
    }
  }

  // Ambos confirmados -> Inicia a luta e vai para a tela de Versus!
  if (p1Confirmed && p2Confirmed) {
    versusTimer = 0;
    currentScreen = SCREEN.VERSUS;
    arcadeAudio.speak(`${CHARACTERS[p1SelectIndex].name} contra ${CHARACTERS[p2SelectIndex].name}!`);
  }
}

// --- VERSUS SCREEN ---
let versusTimer = 0;
function updateVersusScreen(dt) {
  versusTimer += dt;
  if (versusTimer >= 2.8) {
    startNewMatch();
  }
}

function startNewMatch() {
  currentRound = 1;
  const char1 = CHARACTERS[p1SelectIndex];
  const char2 = CHARACTERS[p2SelectIndex];

  player1 = new Fighter({
    charData: char1,
    x: 350,
    groundY: ARENA_GROUND_Y,
    facing: 1,
    isCpu: false,
    playerNum: 1
  });

  player2 = new Fighter({
    charData: char2,
    x: 930,
    groundY: ARENA_GROUND_Y,
    facing: -1,
    isCpu: (gameMode === '1P'),
    playerNum: 2,
    difficulty: (gameMode === 'TRAIN') ? 'EASY' : (GAME_SETTINGS.difficulty || 'NORMAL')
  });

  player1.setOpponent(player2);
  player2.setOpponent(player1);

  projectiles = [];
  particleSystem.clear();
  paused = false;

  startRound();
  currentScreen = SCREEN.FIGHT;
}

function startRound() {
  roundState = 'INTRO';
  roundStateTimer = 0;
  matchTimer = GAME_SETTINGS.roundTime || 99;
  matchTimerAccum = 0;
  projectiles = [];
  particleSystem.clear();

  player1.resetRound(350, 1);
  player2.resetRound(930, -1);

  arcadeAudio.roundBell();
  arcadeAudio.speak(`Round ${currentRound}! Lute!`);
}

// --- FIGHT SCREEN UPDATE ---
function updateFight(dt) {
  if (gameMode === 'ONLINE' && !networkManager.isHost) {
    // Client only sends input and animates; timer/KO/round flow come from Host sync
    networkManager.send({
      type: 'client_input',
      inputs: getPlayerInputs(1)
    });
    particleSystem.update(dt);
    player1.animFrame += dt * 8;
    player2.animFrame += dt * 8;
    return;
  }

  particleSystem.update(dt);

  // Update projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.update(dt, CANVAS_WIDTH);
    proj.checkCollision(player1);
    proj.checkCollision(player2);
    if (!proj.alive) {
      projectiles.splice(i, 1);
    }
  }

  roundStateTimer += dt;

  if (roundState === 'INTRO') {
    if (roundStateTimer >= 1.8) {
      roundState = 'FIGHTING';
    }
  } else if (roundState === 'FIGHTING') {
    if (gameMode !== 'TRAIN') {
      matchTimerAccum += dt;
      if (matchTimerAccum >= 1) {
        matchTimerAccum = 0;
        matchTimer--;
        if (matchTimer <= 0) {
          timeOver();
          broadcastOnlineSync();
          return;
        }
      }
    }

    // Update Fighters
    let p1Inputs = null;
    let p2Inputs = null;

    if (gameMode === 'ONLINE') {
      // Host controls Player 1, remote client controls Player 2
      p1Inputs = getPlayerInputs(1);
      p2Inputs = remoteClientInputs;

      player1.setInputs(p1Inputs);
      player2.setInputs(p2Inputs);
      player1.update(dt, CANVAS_WIDTH, projectiles, p1Inputs);
      player2.update(dt, CANVAS_WIDTH, projectiles, p2Inputs);
    } else {
      // Local 1P vs CPU, 2P local, or Training (dummy passivo: P2 sem inputs)
      p1Inputs = getPlayerInputs(1);
      p2Inputs = gameMode === '2P' ? getPlayerInputs(2) : null;

      player1.setInputs(p1Inputs);
      player2.setInputs(p2Inputs);
      player1.update(dt, CANVAS_WIDTH, projectiles, p1Inputs);
      player2.update(dt, CANVAS_WIDTH, projectiles, p2Inputs);
    }

    if (gameMode === 'TRAIN') {
      for (const f of [player1, player2]) {
        f.hp = f.maxHp;
        f.displayHp = f.maxHp;
        if (f.state === FIGHTER_STATE.DEFEAT) {
          // Recuperação: knockdown com física válida (mesmo caminho de golpe pesado), sem KO
          f.state = FIGHTER_STATE.KNOCKDOWN;
          f.stateTimer = 0;
          f.vy = -200;
          f.isGrounded = false;
          f.invulnerableTimer = 0.8;
        }
      }
      player1.superMeter = 100;
    }

    // Check KO
    if (player1.isDead || player2.isDead) {
      roundState = 'KO';
      roundStateTimer = 0;
      screenShake = 14;
      hitStopTimer = 0.25;

      if (player1.isDead && !player2.isDead) {
        player2.roundsWon++;
        arcadeAudio.speak(`${player2.charData.name} vence o round!`);
      } else if (player2.isDead && !player1.isDead) {
        player1.roundsWon++;
        arcadeAudio.speak(`${player1.charData.name} vence o round!`);
      }
    }
  } else if (roundState === 'KO') {
    player1.handlePhysics(dt, CANVAS_WIDTH);
    player2.handlePhysics(dt, CANVAS_WIDTH);

    if (roundStateTimer >= 3.0) {
      if (player1.roundsWon >= MAX_ROUNDS) {
        matchWinner = player1;
        currentScreen = SCREEN.MATCH_OVER;
      } else if (player2.roundsWon >= MAX_ROUNDS) {
        matchWinner = player2;
        currentScreen = SCREEN.MATCH_OVER;
      } else {
        currentRound++;
        startRound();
      }
    }
  }

  broadcastOnlineSync();
}

// Host envia o estado autoritativo (round, KO, próximo round, MATCH_OVER) ao cliente
function broadcastOnlineSync() {
  if (gameMode !== 'ONLINE' || !networkManager.isHost) return;

  networkManager.send({
    type: 'sync',
    screen: currentScreen,
    winner: matchWinner === player1 ? 1 : (matchWinner === player2 ? 2 : 0),
    p1: { x: player1.x, y: player1.y, hp: player1.hp, displayHp: player1.displayHp, state: player1.state, facing: player1.facing, superMeter: player1.superMeter, roundsWon: player1.roundsWon, animFrame: player1.animFrame },
    p2: { x: player2.x, y: player2.y, hp: player2.hp, displayHp: player2.displayHp, state: player2.state, facing: player2.facing, superMeter: player2.superMeter, roundsWon: player2.roundsWon, animFrame: player2.animFrame },
    matchTimer,
    roundState,
    roundStateTimer,
    currentRound,
    projs: projectiles.map(p => ({ x: p.x, y: p.y, vx: p.vx, type: p.type, color: p.color, radius: p.radius, alive: p.alive }))
  });
}

function timeOver() {
  roundState = 'KO';
  roundStateTimer = 0;
  arcadeAudio.koGong();

  if (player1.hp > player2.hp) {
    player1.roundsWon++;
    arcadeAudio.speak(`Tempo esgotado! ${player1.charData.name} vence!`);
  } else if (player2.hp > player1.hp) {
    player2.roundsWon++;
    arcadeAudio.speak(`Tempo esgotado! ${player2.charData.name} vence!`);
  } else {
    arcadeAudio.speak('Empate na votação!');
  }
}

// --- MATCH OVER SCREEN ---
function updateMatchOver() {
  // Online: apenas o host decide saída/revanche; o cliente aguarda o sync
  if (gameMode === 'ONLINE' && !networkManager.isHost) return;
  if (checkMenuAction(0, 'confirm') || checkMenuAction(0, 'back')) {
    arcadeAudio.menuConfirm();
    p1Confirmed = false;
    p2Confirmed = false;
    currentScreen = SCREEN.CHAR_SELECT;
    broadcastOnlineSync();
  }
}

// --- RENDER PIPELINE ---
function gameRender() {
  const ctx = mainContext;
  ctx.save();

  if (screenShake > 0) {
    const rx = (Math.random() - 0.5) * screenShake;
    const ry = (Math.random() - 0.5) * screenShake;
    ctx.translate(rx, ry);
  }

  switch (currentScreen) {
    case SCREEN.TITLE:
      renderTitleScreen(ctx);
      break;
    case SCREEN.MODE_SELECT:
      renderModeSelect(ctx);
      break;
    case SCREEN.CHAR_SELECT:
      renderCharSelect(ctx);
      break;
    case SCREEN.VERSUS:
      renderVersusScreen(ctx);
      break;
    case SCREEN.FIGHT:
      renderFightScreen(ctx);
      if (paused) renderPauseOverlay(ctx);
      break;
    case SCREEN.MATCH_OVER:
      renderMatchOverScreen(ctx);
      break;
  }

  ctx.restore();
}

function gameRenderPost() {}

// --- SCREEN RENDERERS ---

function renderTitleScreen(ctx) {
  if (images.logo_title && images.logo_title.complete) {
    ctx.drawImage(images.logo_title, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  const alpha = 0.5 + 0.5 * Math.sin(titleBlink);
  ctx.save();
  ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
  ctx.font = 'bold 28px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 10;
  ctx.fillText('PRESSIONE [ENTER], [ESPAÇO] OU BOTÃO [A] DO XBOX', CANVAS_WIDTH / 2, 630);

  ctx.fillStyle = '#ffffff';
  ctx.font = '16px monospace';
  ctx.fillText('10 POLÍTICOS • SUPORTE A CONTROLE DE XBOX • POWERED BY LITTLEJS', CANVAS_WIDTH / 2, 670);
  ctx.restore();
}

function renderModeSelect(ctx) {
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, CANVAS_WIDTH, 100);
  ctx.fillStyle = '#ffd32a';
  ctx.font = 'bold 34px "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SELECIONE O MODO DE JOGO', CANVAS_WIDTH / 2, 60);

  MODES.forEach((m, i) => {
    const isSelected = i === modeIndex;
    const y = 130 + i * 104;

    ctx.save();
    if (isSelected) {
      ctx.fillStyle = 'rgba(255, 211, 42, 0.15)';
      ctx.strokeStyle = '#ffd32a';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffd32a';
      ctx.shadowBlur = 18;
    } else {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
    }

    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH / 2 - 380, y, 760, 92, 10);
    ctx.fill();
    ctx.stroke();

    let titleText = (isSelected ? '▶ ' : '   ') + m.name;
    if (m.id === 'SETTINGS') {
      const curDiffName = DIFFICULTY_LEVELS[GAME_SETTINGS.difficulty]?.name || 'Médio';
      titleText += ` [${curDiffName}]`;
    }

    ctx.fillStyle = isSelected ? '#ffd32a' : '#ffffff';
    ctx.font = 'bold 24px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(titleText, CANVAS_WIDTH / 2 - 350, y + 40);

    ctx.fillStyle = isSelected ? '#e2e8f0' : '#94a3b8';
    ctx.font = '16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(m.desc, CANVAS_WIDTH / 2 - 315, y + 70);
    ctx.restore();
  });

  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('[W/S] ou D-PAD NAVEGAR • [ENTER/J] ou BOTÃO [A] CONFIRMAR', CANVAS_WIDTH / 2, 680);
}

function renderCharSelect(ctx) {
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Header with Step Indicator
  ctx.save();
  if (!p1Confirmed) {
    ctx.fillStyle = '#3498db';
    ctx.font = 'bold 28px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ [PASSO 1/2] ESCOLHA SEU PERSONAGEM (P1) ★', CANVAS_WIDTH / 2, 35);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('Navegue com [← / → / ↑ / ↓] ou D-PAD • Pressione [ENTER / A] para confirmar', CANVAS_WIDTH / 2, 54);
  } else {
    ctx.fillStyle = '#e67e22';
    ctx.font = 'bold 28px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    const rivalName = gameMode === '1P' ? 'CPU' : (gameMode === 'TRAIN' ? 'BONECO DE TREINO' : 'JOGADOR 2');
    ctx.fillText(`★ [PASSO 2/2] ESCOLHA SEU OPONENTE (${rivalName}) ★`, CANVAS_WIDTH / 2, 35);
    ctx.fillStyle = '#ffd32a';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('Pressione [ENTER / A] para Iniciar Luta • Pressione [ESC / B] para voltar ao P1', CANVAS_WIDTH / 2, 54);
  }
  ctx.restore();

  // Wings Headers
  // Left Wing (Indices 0..4)
  ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
  ctx.fillRect(40, 65, 570, 32);
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ ALA ESQUERDA (5) ★', 325, 87);

  // Right Wing (Indices 5..9)
  ctx.fillStyle = 'rgba(46, 204, 113, 0.25)';
  ctx.fillRect(670, 65, 570, 32);
  ctx.fillStyle = '#2ecc71';
  ctx.fillText('★ ALA DIREITA (5) ★', 955, 87);

  // Roster Cards (5 on left, 5 on right)
  const cardW = 104;
  const cardH = 145;
  const cardY = 108;

  CHARACTERS.forEach((c, i) => {
    const isP1 = i === p1SelectIndex;
    const isP2 = p1Confirmed && (i === p2SelectIndex);

    let cardX = 0;
    if (i < 5) {
      // Ala Esquerda (0: Lula, 1: Dilma, 2: Haddad, 3: Boulos, 4: Jones)
      cardX = 40 + i * 116;
    } else {
      // Ala Direita (5: Bolsonaro, 6: Tarcisio, 7: Nikolas, 8: Flavio, 9: Campopiano)
      cardX = 670 + (i - 5) * 116;
    }

    ctx.save();
    ctx.translate(cardX, cardY);

    // Card background
    ctx.fillStyle = '#161d2b';
    ctx.beginPath();
    ctx.roundRect(0, 0, cardW, cardH, 6);
    ctx.fill();

    // Portrait image
    const pKey = 'portrait_' + c.id;
    if (images[pKey] && images[pKey].complete) {
      ctx.drawImage(images[pKey], 6, 6, cardW - 12, 102);
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(6, 6, cardW - 12, 102);
    }

    // Character Name Bar
    ctx.fillStyle = c.side === SIDES.LEFT ? '#c0392b' : '#27ae60';
    ctx.fillRect(6, 110, cardW - 12, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.name.split(' ')[0].toUpperCase(), cardW / 2, 128);

    // Selection Highlights
    if (isP1) {
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#3498db';
      ctx.shadowBlur = 12;
      ctx.strokeRect(-2, -2, cardW + 4, cardH + 4);

      // P1 Badge
      ctx.fillStyle = '#3498db';
      ctx.fillRect(6, -14, 46, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(p1Confirmed ? 'P1 OK' : '1P', 29, 0);
    }

    if (isP2) {
      ctx.strokeStyle = '#e67e22';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#e67e22';
      ctx.shadowBlur = 14;
      ctx.strokeRect(-4, -4, cardW + 8, cardH + 8);

      // P2 / CPU Badge
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(cardW - 52, -14, 46, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(gameMode === '1P' ? 'CPU' : (p2Confirmed ? 'P2 OK' : '2P'), cardW - 29, 0);
    }

    ctx.restore();
  });

  // Selected Character Details Preview (Bottom Panel)
  const currentInspect = (!p1Confirmed) ? CHARACTERS[p1SelectIndex] : CHARACTERS[p2SelectIndex];
  const inspectRoleLabel = (!p1Confirmed) ? '★ SEU PERSONAGEM (P1)' : (gameMode === '1P' ? '⚔ OPONENTE (CPU)' : '⚔ JOGADOR 2 (P2)');
  const inspectRoleColor = (!p1Confirmed) ? '#3498db' : '#e67e22';

  ctx.save();
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(40, 275, 1200, 395, 10);
  ctx.fill();
  ctx.strokeStyle = inspectRoleColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Big Portrait Preview on the left of bottom card
  const pInspectKey = 'portrait_' + currentInspect.id;
  if (images[pInspectKey] && images[pInspectKey].complete) {
    ctx.drawImage(images[pInspectKey], 65, 300, 200, 200);
    ctx.strokeStyle = inspectRoleColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(65, 300, 200, 200);
  }

  // Role Badge (P1 or Opponent)
  const textX = 295;
  ctx.fillStyle = inspectRoleColor;
  ctx.fillRect(textX, 296, 210, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(inspectRoleLabel, textX + 12, 311);

  // Character Title and Bio
  ctx.fillStyle = '#ffd32a';
  ctx.font = 'bold 26px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${currentInspect.name.toUpperCase()} - ${currentInspect.title} (${currentInspect.side})`, textX, 342);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'italic 16px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(currentInspect.quote, textX, 355);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '16px "Segoe UI", Roboto, sans-serif';
  ctx.fillText(currentInspect.bio, textX, 390);

  // Moves list
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`GOLPE ESPECIAL: ${currentInspect.moves.specialName}`, textX, 435);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px sans-serif';
  ctx.fillText(currentInspect.moves.specialDesc, textX, 458);

  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`SUPER CPI (100%): ${currentInspect.moves.superName}`, textX, 492);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px sans-serif';
  ctx.fillText(currentInspect.moves.superDesc, textX, 514);

  // Stats Bars
  const statsX = 890;
  const stats = currentInspect.stats;
  drawStatBar(ctx, 'FORÇA', stats.power, statsX, 330, '#e74c3c');
  drawStatBar(ctx, 'VELOCIDADE', stats.speed, statsX, 380, '#3498db');
  drawStatBar(ctx, 'DEFESA', stats.defense, statsX, 430, '#2ecc71');
  drawStatBar(ctx, 'ESPECIAL', stats.special, statsX, 480, '#f1c40f');

  // Xbox Gamepad Quick Legend
  ctx.fillStyle = '#ffd32a';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('🎮 CONTROLE XBOX:', 65, 540);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px monospace';
  ctx.fillText('[D-PAD / STICK] Mover • [A] Soco Rápido/OK • [X] Soco Forte • [B] Chute • [Y] Especial • [RB/RT] Super CPI', 65, 565);

  ctx.restore();

  // Footer instructions
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NAVEGAR: [A/D] ou D-PAD • MUDAR ALA: [W/S] • CONFIRMAR: [J/ENTER] ou BOTÃO [A]', CANVAS_WIDTH / 2, 695);
}

function drawStatBar(ctx, label, val, x, y, color) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y);

  ctx.fillStyle = '#334155';
  ctx.fillRect(x + 110, y - 12, 170, 14);

  ctx.fillStyle = color;
  ctx.fillRect(x + 110, y - 12, (val / 100) * 170, 14);
}

function renderVersusScreen(ctx) {
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const char1 = CHARACTERS[p1SelectIndex];
  const char2 = CHARACTERS[p2SelectIndex];

  const p1Key = 'portrait_' + char1.id;
  if (images[p1Key] && images[p1Key].complete) {
    ctx.drawImage(images[p1Key], 120, 130, 380, 420);
  }

  const p2Key = 'portrait_' + char2.id;
  if (images[p2Key] && images[p2Key].complete) {
    ctx.drawImage(images[p2Key], 780, 130, 380, 420);
  }

  ctx.save();
  ctx.shadowColor = '#ffd32a';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffd32a';
  ctx.font = 'italic 900 110px "Impact", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VS', CANVAS_WIDTH / 2, 380);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(char1.name.toUpperCase(), 310, 600);
  ctx.fillText(char2.name.toUpperCase(), 970, 600);

  ctx.font = '20px sans-serif';
  ctx.fillStyle = char1.side === SIDES.LEFT ? '#e74c3c' : '#2ecc71';
  ctx.fillText(char1.side, 310, 635);
  ctx.fillStyle = char2.side === SIDES.LEFT ? '#e74c3c' : '#2ecc71';
  ctx.fillText(char2.side, 970, 635);
}

function renderPauseOverlay(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PAUSADO', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.font = '20px monospace';
  ctx.fillText('ESC / START: continuar   VOLTAR: menu de personagens', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
  ctx.restore();
}

function renderFightScreen(ctx) {
  if (images.bg_congress && images.bg_congress.complete) {
    ctx.drawImage(images.bg_congress, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#1e3799';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#0a3d62';
    ctx.fillRect(0, ARENA_GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - ARENA_GROUND_Y);
  }

  if (player1) player1.render(ctx);
  if (player2) player2.render(ctx);

  for (const proj of projectiles) {
    proj.render(ctx);
  }

  particleSystem.render(ctx);
  renderHUD(ctx);
  renderRoundAnnouncements(ctx);
}

function renderHUD(ctx) {
  ctx.save();

  const barWidth = 460;
  const barHeight = 28;
  const barY = 45;

  // P1 Health Bar
  const p1X = 130;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(p1X - 2, barY - 2, barWidth + 4, barHeight + 4);
  const p1DecayWidth = (player1.displayHp / player1.maxHp) * barWidth;
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(p1X + (barWidth - p1DecayWidth), barY, p1DecayWidth, barHeight);
  const p1HpWidth = (player1.hp / player1.maxHp) * barWidth;
  const p1Grad = ctx.createLinearGradient(p1X, 0, p1X + barWidth, 0);
  p1Grad.addColorStop(0, '#f1c40f');
  p1Grad.addColorStop(1, '#2ecc71');
  ctx.fillStyle = p1Grad;
  ctx.fillRect(p1X + (barWidth - p1HpWidth), barY, p1HpWidth, barHeight);

  // P1 Portrait Thumbnail
  const p1Thumb = 'portrait_' + player1.charData.id;
  if (images[p1Thumb] && images[p1Thumb].complete) {
    ctx.drawImage(images[p1Thumb], 45, 30, 70, 70);
  }
  ctx.strokeStyle = '#ffd32a';
  ctx.lineWidth = 3;
  ctx.strokeRect(45, 30, 70, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 6;
  ctx.fillText(player1.charData.name.toUpperCase(), p1X, barY - 8);

  for (let r = 0; r < MAX_ROUNDS; r++) {
    ctx.fillStyle = r < player1.roundsWon ? '#ffd32a' : '#334155';
    ctx.beginPath();
    ctx.arc(p1X + r * 22, barY + barHeight + 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // P1 Super Meter
  const p1SuperWidth = (player1.superMeter / 100) * 240;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(45, 665, 244, 20);
  ctx.fillStyle = player1.superMeter >= 100 ? '#f1c40f' : '#3498db';
  ctx.fillRect(47, 667, p1SuperWidth, 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(player1.superMeter >= 100 ? '★ PODER PRONTO! [I / RB]' : `CPI: ${Math.floor(player1.superMeter)}%`, 55, 680);

  // P2 Health Bar
  const p2X = CANVAS_WIDTH - 130 - barWidth;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(p2X - 2, barY - 2, barWidth + 4, barHeight + 4);
  const p2DecayWidth = (player2.displayHp / player2.maxHp) * barWidth;
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(p2X, barY, p2DecayWidth, barHeight);
  const p2HpWidth = (player2.hp / player2.maxHp) * barWidth;
  const p2Grad = ctx.createLinearGradient(p2X, 0, p2X + barWidth, 0);
  p2Grad.addColorStop(0, '#2ecc71');
  p2Grad.addColorStop(1, '#f1c40f');
  ctx.fillStyle = p2Grad;
  ctx.fillRect(p2X, barY, p2HpWidth, barHeight);

  // P2 Portrait Thumbnail
  const p2Thumb = 'portrait_' + player2.charData.id;
  if (images[p2Thumb] && images[p2Thumb].complete) {
    ctx.drawImage(images[p2Thumb], CANVAS_WIDTH - 115, 30, 70, 70);
  }
  ctx.strokeStyle = '#ffd32a';
  ctx.lineWidth = 3;
  ctx.strokeRect(CANVAS_WIDTH - 115, 30, 70, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(player2.charData.name.toUpperCase(), p2X + barWidth, barY - 8);

  for (let r = 0; r < MAX_ROUNDS; r++) {
    ctx.fillStyle = r < player2.roundsWon ? '#ffd32a' : '#334155';
    ctx.beginPath();
    ctx.arc(p2X + barWidth - r * 22, barY + barHeight + 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // P2 Super Meter
  const p2SuperWidth = (player2.superMeter / 100) * 240;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(CANVAS_WIDTH - 289, 665, 244, 20);
  ctx.fillStyle = player2.superMeter >= 100 ? '#f1c40f' : '#e67e22';
  ctx.fillRect(CANVAS_WIDTH - 287, 667, p2SuperWidth, 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(player2.superMeter >= 100 ? '★ PODER PRONTO!' : `CPI: ${Math.floor(player2.superMeter)}%`, CANVAS_WIDTH - 55, 680);

  // Center Timer
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(CANVAS_WIDTH / 2 - 45, 25, 90, 60, 8);
  ctx.fill();
  ctx.strokeStyle = '#ffd32a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = matchTimer <= 15 ? '#e74c3c' : '#ffd32a';
  ctx.font = 'bold 42px "Impact", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(gameMode === 'TRAIN' ? '∞' : String(matchTimer).padStart(2, '0'), CANVAS_WIDTH / 2, 70);

  // Combo Counters
  if (player1.comboCount > 1) {
    ctx.fillStyle = '#ffd32a';
    ctx.font = 'italic 900 32px "Impact", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${player1.comboCount} HITS!`, 130, 140);
  }
  if (player2.comboCount > 1) {
    ctx.fillStyle = '#ffd32a';
    ctx.font = 'italic 900 32px "Impact", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${player2.comboCount} HITS!`, CANVAS_WIDTH - 130, 140);
  }

  // Online Multiplayer HUD Badge
  if (gameMode === 'ONLINE') {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH / 2 - 110, 92, 220, 24, 6);
    ctx.fill();
    ctx.strokeStyle = networkManager.isConnected ? '#2ecc71' : '#e74c3c';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = networkManager.isConnected ? '#2ecc71' : '#e74c3c';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2 - 95, 104, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    const roleText = networkManager.isHost ? 'HOST' : 'CLIENT';
    const pingText = networkManager.ping > 0 ? ` • ${networkManager.ping}ms` : '';
    ctx.fillText(`P2P [${networkManager.roomCode || 'ONLINE'}] ${roleText}${pingText}`, CANVAS_WIDTH / 2 + 5, 108);
  }

  ctx.restore();
}

function renderRoundAnnouncements(ctx) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 20;

  if (roundState === 'INTRO') {
    if (roundStateTimer < 1.0) {
      ctx.fillStyle = '#ffd32a';
      ctx.font = 'italic 900 70px "Impact", sans-serif';
      ctx.fillText(`ROUND ${currentRound}`, CANVAS_WIDTH / 2, 320);
    } else {
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'italic 900 90px "Impact", sans-serif';
      ctx.fillText('LUTE!', CANVAS_WIDTH / 2, 330);
    }
  } else if (roundState === 'KO') {
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'italic 900 110px "Impact", sans-serif';
    ctx.fillText('K.O.!', CANVAS_WIDTH / 2, 320);

    ctx.fillStyle = '#ffd32a';
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    const victor = player1.isDead ? player2 : player1;
    ctx.fillText(`${victor.charData.name.toUpperCase()} VENCE O ROUND!`, CANVAS_WIDTH / 2, 390);
  }

  ctx.restore();
}

function renderMatchOverScreen(ctx) {
  ctx.fillStyle = 'rgba(10, 13, 20, 0.9)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ffd32a';
  ctx.shadowBlur = 25;

  ctx.fillStyle = '#ffd32a';
  ctx.font = 'italic 900 65px "Impact", sans-serif';
  ctx.fillText('VITORIOSO NO PLENÁRIO!', CANVAS_WIDTH / 2, 140);

  const winKey = 'portrait_' + matchWinner.charData.id;
  if (images[winKey] && images[winKey].complete) {
    ctx.drawImage(images[winKey], CANVAS_WIDTH / 2 - 130, 180, 260, 260);
    ctx.strokeStyle = '#ffd32a';
    ctx.lineWidth = 4;
    ctx.strokeRect(CANVAS_WIDTH / 2 - 130, 180, 260, 260);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px "Segoe UI", sans-serif';
  ctx.fillText(matchWinner.charData.name.toUpperCase(), CANVAS_WIDTH / 2, 490);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'italic 20px "Segoe UI", sans-serif';
  ctx.fillText(matchWinner.charData.victoryQuote, CANVAS_WIDTH / 2, 535);

  ctx.fillStyle = '#ffd32a';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('[ENTER] OU BOTÃO [A] PARA JOGAR NOVAMENTE', CANVAS_WIDTH / 2, 630);

  ctx.restore();
}

// Start Engine
engineInit(
  gameInit,
  gameUpdate,
  null,
  gameRender,
  gameRenderPost,
  [],
  document.getElementById('screen-container')
);
