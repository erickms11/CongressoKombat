// fighter.js - 2D Fighting Game character logic, animations, hitboxes and AI

import { particleSystem } from './particles.js';
import { Projectile } from './projectile.js';
import { arcadeAudio } from './audio.js';

export const FIGHTER_STATE = {
  IDLE: 'IDLE',
  WALK_FWD: 'WALK_FWD',
  WALK_BACK: 'WALK_BACK',
  JUMP: 'JUMP',
  CROUCH: 'CROUCH',
  PUNCH_LIGHT: 'PUNCH_LIGHT',
  PUNCH_HEAVY: 'PUNCH_HEAVY',
  PUNCH: 'PUNCH_LIGHT',
  HEAVY_PUNCH: 'PUNCH_HEAVY',
  KICK: 'KICK',
  LOW_KICK: 'LOW_KICK',
  JUMP_ATTACK: 'JUMP_ATTACK',
  SPECIAL: 'SPECIAL',
  SUPER: 'SUPER',
  BLOCK: 'BLOCK',
  HIT: 'HIT',
  HURT: 'HIT',
  KNOCKDOWN: 'KNOCKDOWN',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT'
};

// Configurable Difficulty System
export const DIFFICULTY_LEVELS = {
  EASY: {
    id: 'EASY',
    name: 'Fácil',
    label: 'Estagiário',
    timerMin: 0.65,
    timerRange: 0.35,
    blockChance: 0.10,
    hesitateChance: 0.45,
    superChance: 0.15,
    specialChance: 0.15
  },
  NORMAL: {
    id: 'NORMAL',
    name: 'Médio',
    label: 'Deputado Titular',
    timerMin: 0.45,
    timerRange: 0.25,
    blockChance: 0.25,
    hesitateChance: 0.25,
    superChance: 0.35,
    specialChance: 0.25
  },
  HARD: {
    id: 'HARD',
    name: 'Difícil',
    label: 'Líder de Bancada',
    timerMin: 0.25,
    timerRange: 0.15,
    blockChance: 0.45,
    hesitateChance: 0.10,
    superChance: 0.55,
    specialChance: 0.40
  },
  EXTREME: {
    id: 'EXTREME',
    name: 'Extremo',
    label: 'Presidente do Senado',
    timerMin: 0.12,
    timerRange: 0.10,
    blockChance: 0.65,
    hesitateChance: 0.02,
    superChance: 0.85,
    specialChance: 0.55
  }
};

export class Fighter {
  constructor({
    charData,
    x,
    groundY,
    facing = 1,
    isCpu = false,
    playerNum = 1,
    difficulty = 'NORMAL'
  }) {
    this.charData = charData;
    this.x = x;
    this.y = groundY;
    this.groundY = groundY;
    this.facing = facing; // 1 = right, -1 = left
    this.isCpu = isCpu;
    this.playerNum = playerNum;
    this.difficultyKey = difficulty;
    this.difficulty = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.NORMAL;

    // Movement & Physics
    this.vx = 0;
    this.vy = 0;
    this.walkSpeed = (180 + charData.stats.speed * 0.8);
    this.jumpForce = -520;
    this.gravity = 1300;
    this.isGrounded = true;

    // Combat Stats
    this.maxHp = 100;
    this.hp = 100;
    this.displayHp = 100; // Smooth decaying health bar
    this.superMeter = 0; // 0 to 100
    this.roundsWon = 0;

    // State & Timers
    this.state = FIGHTER_STATE.IDLE;
    this.stateTimer = 0;
    this.attackCooldown = 0;
    this.hitStunTimer = 0;
    this.invulnerableTimer = 0;
    this.hasHitThisAttack = false;
    this.animFrame = 0;

    // Opponent reference
    this.opponent = null;

    // Combo counter
    this.comboCount = 0;
    this.comboTimer = 0;

    // CPU AI behavior timer
    this.aiTimer = 0;
    this.aiAction = 'idle';
  }

  setOpponent(opp) {
    this.opponent = opp;
  }

  resetRound(startX, facing) {
    this.x = startX;
    this.y = this.groundY;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.isGrounded = true;
    this.hp = this.maxHp;
    this.displayHp = this.maxHp;
    this.state = FIGHTER_STATE.IDLE;
    this.stateTimer = 0;
    this.hitStunTimer = 0;
    this.invulnerableTimer = 0;
    this.hasHitThisAttack = false;
    this.comboCount = 0;
  }

  get isDead() {
    return this.hp <= 0;
  }

  get isAttacking() {
    return [
      FIGHTER_STATE.PUNCH_LIGHT,
      FIGHTER_STATE.PUNCH_HEAVY,
      FIGHTER_STATE.KICK,
      FIGHTER_STATE.LOW_KICK,
      FIGHTER_STATE.JUMP_ATTACK,
      FIGHTER_STATE.SPECIAL,
      FIGHTER_STATE.SUPER
    ].includes(this.state);
  }

  get isInvulnerable() {
    return this.invulnerableTimer > 0;
  }

  getHurtBox() {
    const isCrouching = this.state === FIGHTER_STATE.CROUCH || this.state === FIGHTER_STATE.LOW_KICK;
    const height = isCrouching ? 105 : 170;
    const width = 80;
    return {
      x: this.x - width / 2,
      y: this.y - height,
      w: width,
      h: height
    };
  }

  getHitBox() {
    if (!this.isAttacking || this.hasHitThisAttack) return null;

    const reach = 85;
    let attackX = this.x + (this.facing > 0 ? 25 : -25 - reach);
    let attackY = this.y - 110; // Chest level

    if (this.state === FIGHTER_STATE.PUNCH_LIGHT) {
      attackY = this.y - 120;
      return { x: attackX, y: attackY, w: reach, h: 42, damage: 6, isHeavy: false, isSuper: false };
    }
    if (this.state === FIGHTER_STATE.PUNCH_HEAVY) {
      attackY = this.y - 115;
      return { x: attackX, y: attackY, w: reach + 25, h: 48, damage: 14, isHeavy: true, isSuper: false };
    }
    if (this.state === FIGHTER_STATE.KICK) {
      attackY = this.y - 105;
      return { x: attackX, y: attackY, w: reach + 35, h: 52, damage: 16, isHeavy: true, isSuper: false };
    }
    if (this.state === FIGHTER_STATE.LOW_KICK) {
      attackY = this.y - 45;
      return { x: attackX, y: attackY, w: reach + 30, h: 40, damage: 10, isHeavy: false, isSuper: false };
    }
    if (this.state === FIGHTER_STATE.JUMP_ATTACK) {
      attackY = this.y - 95;
      return { x: attackX, y: attackY, w: reach + 25, h: 60, damage: 15, isHeavy: true, isSuper: false };
    }
    if (this.state === FIGHTER_STATE.SUPER) {
      attackY = this.y - 130;
      return { x: attackX, y: attackY, w: reach + 60, h: 110, damage: 32, isHeavy: true, isSuper: true };
    }

    return null;
  }

  update(dt, arenaWidth, projectilesList, inputs) {
    this.stateTimer += dt;
    this.animFrame += dt * 8;

    // Decay health bar smoothly
    if (this.displayHp > this.hp) {
      this.displayHp = Math.max(this.hp, this.displayHp - dt * 35);
    }

    // Timers
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Auto-face opponent when grounded and not in attack
    if (this.opponent && this.isGrounded && !this.isAttacking && this.state !== FIGHTER_STATE.HIT && this.state !== FIGHTER_STATE.KNOCKDOWN) {
      this.facing = this.opponent.x > this.x ? 1 : -1;
    }

    // State machine updates
    this.handlePhysics(dt, arenaWidth);

    // AI or Input handling
    if (!this.isDead && this.state !== FIGHTER_STATE.VICTORY && this.state !== FIGHTER_STATE.DEFEAT) {
      if (this.isCpu) {
        this.updateAI(dt, arenaWidth, projectilesList);
      } else if (inputs) {
        this.handleInputs(inputs, projectilesList);
      }
    }

    // Check melee attacks
    this.checkAttackCollision(projectilesList);

    // Check state timeouts
    this.checkStateTransitions();
  }

  handlePhysics(dt, arenaWidth) {
    // Gravity
    if (!this.isGrounded) {
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;

      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        this.isGrounded = true;
        particleSystem.spawnDust(this.x, this.groundY, 6);
        if (this.state === FIGHTER_STATE.JUMP || this.state === FIGHTER_STATE.JUMP_ATTACK) {
          this.state = FIGHTER_STATE.IDLE;
        }
      }
    }

    // Horizontal Movement
    this.x += this.vx * dt;

    // Arena bounds (keep within stage)
    const margin = 50;
    if (this.x < margin) this.x = margin;
    if (this.x > arenaWidth - margin) this.x = arenaWidth - margin;

    // Body pushbox between opponents so fighters don't overlap awkwardly
    if (this.opponent && this.isGrounded && this.opponent.isGrounded &&
        this.state !== FIGHTER_STATE.KNOCKDOWN && this.opponent.state !== FIGHTER_STATE.KNOCKDOWN) {
      const dx = this.x - this.opponent.x;
      const minDist = 80;
      if (Math.abs(dx) < minDist) {
        const push = (minDist - Math.abs(dx)) * 0.5;
        const dir = dx === 0 ? (this.facing > 0 ? -1 : 1) : Math.sign(dx);
        this.x += dir * push;
        this.opponent.x -= dir * push;
      }
    }

    // Damping horizontal speed when not moving
    if (this.state !== FIGHTER_STATE.WALK_FWD && this.state !== FIGHTER_STATE.WALK_BACK) {
      this.vx *= 0.8;
      if (Math.abs(this.vx) < 5) this.vx = 0;
    }
  }

  handleInputs(inpt, projectilesList) {
    if (this.state === FIGHTER_STATE.HIT || this.state === FIGHTER_STATE.KNOCKDOWN) return;
    if (this.isAttacking) return;

    // Crouch
    if (inpt.down && this.isGrounded) {
      this.state = FIGHTER_STATE.CROUCH;
      this.vx = 0;

      // Low attacks from crouch
      if (inpt.kick) {
        this.startAttack(FIGHTER_STATE.LOW_KICK, 0.35);
        arcadeAudio.kick();
        return;
      }
      if (inpt.punchLight) {
        this.startAttack(FIGHTER_STATE.PUNCH_LIGHT, 0.25);
        arcadeAudio.punchLight();
        return;
      }
      return;
    }

    // Jump
    if (inpt.up && this.isGrounded) {
      this.isGrounded = false;
      this.vy = this.jumpForce;
      this.state = FIGHTER_STATE.JUMP;
      if (inpt.left) this.vx = -this.walkSpeed * 0.9;
      else if (inpt.right) this.vx = this.walkSpeed * 0.9;
      particleSystem.spawnDust(this.x, this.groundY, 8);
      arcadeAudio.swoosh();
      return;
    }

    // Attacks in mid-air
    if (!this.isGrounded) {
      if ((inpt.punchLight || inpt.punchHeavy || inpt.kick) && this.state !== FIGHTER_STATE.JUMP_ATTACK) {
        this.startAttack(FIGHTER_STATE.JUMP_ATTACK, 0.4);
        arcadeAudio.kick();
      }
      return;
    }

    // Super Special (requires full meter)
    if (inpt.super && this.superMeter >= 100) {
      this.useSuper();
      return;
    }

    // Special Move (Hadouken-style projectile)
    if (inpt.special && this.attackCooldown <= 0) {
      this.useSpecial(projectilesList);
      return;
    }

    // Normal Attacks with clean, visible frame timing
    if (inpt.punchLight) {
      this.startAttack(FIGHTER_STATE.PUNCH_LIGHT, 0.26);
      arcadeAudio.punchLight();
      return;
    }
    if (inpt.punchHeavy) {
      this.startAttack(FIGHTER_STATE.PUNCH_HEAVY, 0.40);
      arcadeAudio.punchHeavy();
      return;
    }
    if (inpt.kick) {
      this.startAttack(FIGHTER_STATE.KICK, 0.42);
      arcadeAudio.kick();
      return;
    }

    // Ground Walking & Guard
    if (inpt.left) {
      this.vx = -this.walkSpeed;
      if (this.facing === 1) {
        // Moving backward = Guard / Walk back
        this.state = FIGHTER_STATE.WALK_BACK;
      } else {
        this.state = FIGHTER_STATE.WALK_FWD;
      }
    } else if (inpt.right) {
      this.vx = this.walkSpeed;
      if (this.facing === -1) {
        this.state = FIGHTER_STATE.WALK_BACK;
      } else {
        this.state = FIGHTER_STATE.WALK_FWD;
      }
    } else {
      this.state = FIGHTER_STATE.IDLE;
    }
  }

  startAttack(state, duration) {
    this.state = state;
    this.stateTimer = 0;
    this.attackDuration = duration;
    this.hasHitThisAttack = false;
  }

  useSpecial(projectilesList) {
    this.startAttack(FIGHTER_STATE.SPECIAL, 0.45);
    this.attackCooldown = 0.8;
    this.vx = 0;
    arcadeAudio.specialShoot();

    // Spawn projectile midway through anim
    setTimeout(() => {
      if (this.isDead) return;
      let pType = 'lula_star';
      if (this.charData.id === 'dilma') pType = 'dilma_wind';
      else if (this.charData.id === 'haddad') pType = 'haddad_bill';
      else if (this.charData.id === 'boulos') pType = 'boulos_sound';
      else if (this.charData.id === 'jones') pType = 'jones_book';
      else if (this.charData.id === 'bolsonaro') pType = 'bolsonaro_gun';
      else if (this.charData.id === 'tarcisio') pType = 'tarcisio_hammer';
      else if (this.charData.id === 'nikolas') pType = 'nikolas_post';
      else if (this.charData.id === 'flavio') pType = 'flavio_chocolate';
      else if (this.charData.id === 'campopiano') pType = 'campopiano_discourse';

      const proj = new Projectile({
        owner: this,
        x: this.x + this.facing * 35,
        y: this.y - 80,
        vx: this.facing * 480,
        type: pType,
        color: this.charData.colors.projectile,
        damage: 15,
        radius: 18,
        isSuper: false
      });
      projectilesList.push(proj);
      this.addSuperMeter(10);
    }, 150);
  }

  useSuper() {
    this.superMeter = 0;
    this.startAttack(FIGHTER_STATE.SUPER, 0.9);
    this.attackCooldown = 1.2;
    this.vx = this.facing * 280; // Dash forward
    arcadeAudio.superActivate();
    arcadeAudio.speak(this.charData.moves.superName);

    particleSystem.spawnHitSparks(this.x, this.y - 70, 24, this.charData.colors.aura);
  }

  checkAttackCollision(projectilesList) {
    const hitbox = this.getHitBox();
    if (!hitbox || !this.opponent) return;

    const hurtbox = this.opponent.getHurtBox();
    const hit = (
      hitbox.x + hitbox.w >= hurtbox.x &&
      hitbox.x <= hurtbox.x + hurtbox.w &&
      hitbox.y + hitbox.h >= hurtbox.y &&
      hitbox.y <= hurtbox.y + hurtbox.h
    );

    if (hit) {
      this.hasHitThisAttack = true;
      const knockbackDir = this.facing;
      const knockbackForce = hitbox.isHeavy ? 260 : 120;

      this.opponent.takeHit({
        damage: hitbox.damage,
        isHeavy: hitbox.isHeavy,
        knockback: knockbackDir * knockbackForce,
        hitY: hitbox.y + hitbox.h / 2,
        isSuper: hitbox.isSuper
      });

      // Combo management
      this.comboCount++;
      this.comboTimer = 1.2;

      // Super meter build
      this.addSuperMeter(hitbox.isHeavy ? 12 : 6);

      // Effects
      particleSystem.spawnHitSparks(
        (hitbox.x + hurtbox.x + hurtbox.w) / 2,
        hitbox.y + hitbox.h / 2,
        hitbox.isHeavy ? 16 : 8,
        this.charData.colors.aura
      );

      // Brazilian money flying satire
      particleSystem.spawnFlyingMoney(this.opponent.x, this.opponent.y - 60, hitbox.isHeavy ? 5 : 2);
    }
  }

  takeHit({ damage, isHeavy, knockback, hitY, isProjectile = false, isSuper = false }) {
    if (this.isDead || this.isInvulnerable) return;

    // Check blocking (holding backward while facing opponent)
    const isHoldingBack = (this.facing === 1 && this.vx < 0) || (this.facing === -1 && this.vx > 0) || (this.state === FIGHTER_STATE.WALK_BACK);
    const canBlock = isHoldingBack && !this.isAttacking && this.state !== FIGHTER_STATE.KNOCKDOWN;

    if (canBlock && !isSuper) {
      // Guarded! Reduced damage & block spark
      const chipDamage = Math.max(1, Math.round(damage * 0.2));
      this.hp = Math.max(0, this.hp - chipDamage);
      this.vx = knockback * 0.3;
      this.state = FIGHTER_STATE.BLOCK;
      this.stateTimer = 0;
      arcadeAudio.block();
      particleSystem.spawnBlockSparks(this.x + this.facing * 20, hitY);
      this.addSuperMeter(5); // Meter on block
      return;
    }

    // Direct hit!
    this.hp = Math.max(0, this.hp - damage);
    this.vx = knockback;
    this.addSuperMeter(8); // Meter when taking damage

    if (isHeavy || isSuper || this.hp <= 0) {
      arcadeAudio.punchHeavy();
      this.state = FIGHTER_STATE.KNOCKDOWN;
      this.stateTimer = 0;
      this.vy = -200;
      this.isGrounded = false;
      this.invulnerableTimer = 0.8;
    } else {
      arcadeAudio.punchLight();
      this.state = FIGHTER_STATE.HIT;
      this.stateTimer = 0;
      this.hitStunTimer = 0.25;
    }

    // Check KO
    if (this.hp <= 0) {
      this.state = FIGHTER_STATE.DEFEAT;
      arcadeAudio.koGong();
    }
  }

  addSuperMeter(amount) {
    this.superMeter = Math.min(100, this.superMeter + amount);
  }

  checkStateTransitions() {
    if (this.state === FIGHTER_STATE.HIT) {
      if (this.stateTimer >= this.hitStunTimer) {
        this.state = FIGHTER_STATE.IDLE;
      }
    } else if (this.state === FIGHTER_STATE.KNOCKDOWN) {
      if (this.isGrounded && this.stateTimer >= 0.7) {
        if (this.isDead) {
          this.state = FIGHTER_STATE.DEFEAT;
        } else {
          this.state = FIGHTER_STATE.IDLE;
        }
      }
    } else if (this.state === FIGHTER_STATE.BLOCK) {
      if (this.stateTimer >= 0.25) {
        this.state = FIGHTER_STATE.IDLE;
      }
    } else if (this.isAttacking) {
      if (this.stateTimer >= this.attackDuration) {
        this.state = FIGHTER_STATE.IDLE;
      }
    }
  }

  // AI Logic for CPU opponent with dynamic difficulty
  updateAI(dt, arenaWidth, projectilesList) {
    if (!this.opponent || this.opponent.isDead) {
      this.state = FIGHTER_STATE.IDLE;
      return;
    }

    this.aiTimer -= dt;
    const dist = Math.abs(this.opponent.x - this.x);
    const inMeleeRange = dist < 120;
    const inMidRange = dist >= 120 && dist < 280;
    const oppIsAttacking = this.opponent.isAttacking;

    const diff = this.difficulty || DIFFICULTY_LEVELS.NORMAL;

    if (this.aiTimer <= 0) {
      this.aiTimer = diff.timerMin + Math.random() * diff.timerRange;

      // 1. Super attack
      if (this.superMeter >= 100 && dist < 220 && Math.random() < diff.superChance) {
        this.useSuper();
        return;
      }

      // 2. Defense: Chance to guard/block incoming attacks
      if (oppIsAttacking && inMeleeRange && Math.random() < diff.blockChance) {
        this.vx = -this.facing * this.walkSpeed;
        this.state = FIGHTER_STATE.WALK_BACK;
        return;
      }

      // 3. Melee Combat with hesitation openings based on difficulty
      if (inMeleeRange) {
        const roll = Math.random();
        if (roll < diff.hesitateChance) {
          // Hesitation / breathing room pause
          this.state = FIGHTER_STATE.IDLE;
          this.vx = 0;
        } else if (roll < diff.hesitateChance + 0.30) {
          this.startAttack(FIGHTER_STATE.PUNCH_LIGHT, 0.26);
          arcadeAudio.punchLight();
        } else if (roll < diff.hesitateChance + 0.55) {
          this.startAttack(FIGHTER_STATE.PUNCH_HEAVY, 0.40);
          arcadeAudio.punchHeavy();
        } else if (roll < diff.hesitateChance + 0.75) {
          this.startAttack(FIGHTER_STATE.KICK, 0.42);
          arcadeAudio.kick();
        } else {
          this.startAttack(FIGHTER_STATE.LOW_KICK, 0.35);
          arcadeAudio.kick();
        }
        return;
      }

      // 4. Mid range: projectile or jump
      if (inMidRange) {
        const roll = Math.random();
        if (roll < diff.specialChance && this.attackCooldown <= 0) {
          this.useSpecial(projectilesList);
          return;
        } else if (roll < diff.specialChance + 0.25 && this.isGrounded) {
          // Jump approach
          this.isGrounded = false;
          this.vy = this.jumpForce;
          this.vx = this.facing * this.walkSpeed * 0.8;
          this.state = FIGHTER_STATE.JUMP;
          arcadeAudio.swoosh();
          setTimeout(() => {
            if (!this.isGrounded && !this.isDead) {
              this.startAttack(FIGHTER_STATE.JUMP_ATTACK, 0.40);
            }
          }, 250);
          return;
        }
      }

      // 5. Long range: approach or projectile
      if (dist >= 220) {
        if (Math.random() < diff.specialChance && this.attackCooldown <= 0) {
          this.useSpecial(projectilesList);
          return;
        }
        this.vx = this.facing * this.walkSpeed * 0.75;
        this.state = FIGHTER_STATE.WALK_FWD;
        return;
      }
    }

    // Default movement towards opponent
    if (!this.isAttacking && this.state !== FIGHTER_STATE.HIT && this.state !== FIGHTER_STATE.KNOCKDOWN && this.isGrounded) {
      if (dist > 70) {
        this.vx = this.facing * this.walkSpeed;
        this.state = FIGHTER_STATE.WALK_FWD;
      } else {
        this.vx = 0;
        this.state = FIGHTER_STATE.IDLE;
      }
    }
  }

  // Render Fighter Visuals
  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const facing = this.facing;
    const colors = this.charData.colors;

    // Shadow on green carpet
    const shadowScale = Math.max(0.3, 1 - (this.groundY - this.y) / 400);
    ctx.fillStyle = 'rgba(0, 30, 10, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 32 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Invulnerability blink
    if (this.isInvulnerable && Math.floor(this.stateTimer * 20) % 2 === 0) {
      ctx.restore();
      return;
    }

    // Super Aura glow if meter >= 100 or during super (Organic energy aura, no square hitbox wireframe)
    if (this.superMeter >= 100 || this.state === FIGHTER_STATE.SUPER) {
      ctx.save();
      const pulse = 1 + Math.sin(this.animFrame * 3) * 0.18;
      const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, 52 * pulse);
      grad.addColorStop(0, colors.aura || '#ffd32a');
      grad.addColorStop(0.5, (colors.aura || '#ffd32a') + '88');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 52 * pulse, 16 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Flip context horizontally if facing left
    ctx.scale(facing, 1);

    // Check if high-resolution 16-bit arcade spritesheet is available
    const spriteSheet = window.spriteCanvases && window.spriteCanvases['spritesheet_' + this.charData.id];
    if (spriteSheet) {
      this.renderSprite(ctx, spriteSheet);
      ctx.restore();
      return;
    }

    // Stance breathing / idle bob
    const idleBob = this.state === FIGHTER_STATE.IDLE ? Math.sin(this.animFrame) * 2.5 : 0;
    const isCrouching = this.state === FIGHTER_STATE.CROUCH || this.state === FIGHTER_STATE.LOW_KICK;
    const crouchOffset = isCrouching ? 35 : 0;

    // Walk cycle leg rotation
    const walkSwing = (this.state === FIGHTER_STATE.WALK_FWD || this.state === FIGHTER_STATE.WALK_BACK)
      ? Math.sin(this.animFrame * 1.8) * 14 : 0;

    // --- LEGS & SHOES ---
    // Back leg
    ctx.fillStyle = colors.suit;
    ctx.fillRect(-14 - walkSwing * 0.5, -45 + crouchOffset, 12, 45 - crouchOffset);
    // Back shoe
    ctx.fillStyle = '#111';
    ctx.fillRect(-17 - walkSwing * 0.5, -8, 18, 9);

    // Front leg
    if (this.state === FIGHTER_STATE.KICK) {
      // High Roundhouse Kick extension
      ctx.save();
      ctx.translate(0, -50);
      ctx.rotate(-Math.PI * 0.45);
      ctx.fillStyle = colors.suit;
      ctx.fillRect(0, -6, 55, 13);
      ctx.fillStyle = '#111';
      ctx.fillRect(45, -8, 16, 16);
      ctx.restore();
    } else if (this.state === FIGHTER_STATE.LOW_KICK) {
      // Low sweep
      ctx.save();
      ctx.translate(0, -20);
      ctx.fillStyle = colors.suit;
      ctx.fillRect(0, -6, 60, 12);
      ctx.fillStyle = '#111';
      ctx.fillRect(50, -8, 16, 14);
      ctx.restore();
    } else if (this.state === FIGHTER_STATE.JUMP_ATTACK) {
      // Aerial kick
      ctx.save();
      ctx.translate(0, -40);
      ctx.rotate(-Math.PI * 0.35);
      ctx.fillStyle = colors.suit;
      ctx.fillRect(0, -6, 50, 13);
      ctx.fillStyle = '#111';
      ctx.fillRect(40, -8, 15, 15);
      ctx.restore();
    } else {
      ctx.fillStyle = colors.suit;
      ctx.fillRect(2 + walkSwing * 0.5, -45 + crouchOffset, 13, 45 - crouchOffset);
      ctx.fillStyle = '#111';
      ctx.fillRect(1 + walkSwing * 0.5, -8, 18, 9);
    }

    // --- TORSO / SUIT & TIE ---
    const torsoY = -85 + crouchOffset + idleBob;
    ctx.fillStyle = colors.suit;
    ctx.fillRect(-18, torsoY, 36, 42);

    // White shirt collar V-shape
    ctx.fillStyle = colors.shirt;
    ctx.beginPath();
    ctx.moveTo(-7, torsoY);
    ctx.lineTo(7, torsoY);
    ctx.lineTo(0, torsoY + 18);
    ctx.closePath();
    ctx.fill();

    // Tie
    ctx.fillStyle = colors.tie;
    ctx.beginPath();
    ctx.moveTo(-3, torsoY);
    ctx.lineTo(3, torsoY);
    ctx.lineTo(4, torsoY + 24);
    ctx.lineTo(0, torsoY + 28);
    ctx.lineTo(-4, torsoY + 24);
    ctx.closePath();
    ctx.fill();

    // Faixa Presidencial estilizada (verde e amarela) se for Lula ou Bolsonaro
    if (this.charData.id === 'lula' || this.charData.id === 'bolsonaro') {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2ecc71';
      ctx.beginPath();
      ctx.moveTo(-15, torsoY + 3);
      ctx.lineTo(12, torsoY + 38);
      ctx.stroke();

      ctx.strokeStyle = '#f1c40f';
      ctx.beginPath();
      ctx.moveTo(-13, torsoY + 5);
      ctx.lineTo(14, torsoY + 40);
      ctx.stroke();
    }

    // --- ARMS & FISTS ---
    const shoulderX = 4;
    const shoulderY = torsoY + 10;

    if (this.state === FIGHTER_STATE.PUNCH_LIGHT) {
      // Fast Jab Punch
      ctx.fillStyle = colors.suit;
      ctx.fillRect(shoulderX, shoulderY - 5, 42, 10);
      ctx.fillStyle = colors.skin;
      ctx.fillRect(shoulderX + 42, shoulderY - 7, 12, 14);
    } else if (this.state === FIGHTER_STATE.PUNCH_HEAVY || this.state === FIGHTER_STATE.SUPER) {
      // Strong Cross Punch
      ctx.fillStyle = colors.suit;
      ctx.fillRect(shoulderX, shoulderY - 8, 55, 14);
      ctx.fillStyle = colors.skin;
      ctx.fillRect(shoulderX + 55, shoulderY - 11, 16, 18);
    } else if (this.state === FIGHTER_STATE.BLOCK) {
      // Guarding arms crossed
      ctx.fillStyle = colors.suit;
      ctx.fillRect(8, torsoY - 5, 12, 30);
      ctx.fillStyle = colors.skin;
      ctx.fillRect(6, torsoY - 14, 14, 12);
    } else if (this.state === FIGHTER_STATE.SPECIAL) {
      // Special pose (Lula raising fist / Bolsonaro arminha pose)
      if (this.charData.id === 'bolsonaro') {
        // Arminha pose com as duas mãos
        ctx.fillStyle = colors.suit;
        ctx.fillRect(shoulderX, shoulderY - 12, 35, 10);
        ctx.fillRect(shoulderX - 5, shoulderY + 2, 32, 10);
        ctx.fillStyle = colors.skin;
        // Mãos em L estilo arma
        ctx.fillRect(shoulderX + 35, shoulderY - 16, 12, 10);
        ctx.fillRect(shoulderX + 37, shoulderY - 22, 5, 10); // dedo apontando
      } else {
        // Punho erguido
        ctx.fillStyle = colors.suit;
        ctx.fillRect(shoulderX, shoulderY - 25, 12, 32);
        ctx.fillStyle = colors.skin;
        ctx.fillRect(shoulderX - 2, shoulderY - 35, 16, 14);
      }
    } else {
      // Guard ready stance arms
      ctx.fillStyle = colors.suit;
      ctx.fillRect(shoulderX, shoulderY - 2, 22, 10);
      ctx.fillStyle = colors.skin;
      ctx.fillRect(shoulderX + 18, shoulderY - 7, 12, 12);
    }

    // --- CARICATURE HEAD & FACE ---
    const headY = torsoY - 24;
    // Neck
    ctx.fillStyle = colors.skin;
    ctx.fillRect(-5, torsoY - 4, 10, 6);

    // Head base
    ctx.fillStyle = colors.skin;
    ctx.beginPath();
    ctx.ellipse(0, headY, 15, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(6, headY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#111';
    ctx.fillRect(5, headY - 4, 3, 4);
    // Eyebrow
    ctx.fillStyle = colors.hair;
    ctx.fillRect(3, headY - 8, 8, 3);

    // Mouth / Expression
    if (this.state === FIGHTER_STATE.HIT || this.state === FIGHTER_STATE.KNOCKDOWN) {
      ctx.fillStyle = '#900';
      ctx.fillRect(3, headY + 7, 6, 5); // Pain open mouth
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(3, headY + 6, 5, 2);
    }

    // Distinctive Politician Caricature Features:
    if (this.charData.id === 'lula') {
      // Lula: Barba e bigode brancos/grisalhos volumosos + cabelo grisalho
      ctx.fillStyle = colors.beard;
      // Beard
      ctx.beginPath();
      ctx.ellipse(2, headY + 8, 14, 10, 0, 0, Math.PI);
      ctx.fill();
      // Mustache
      ctx.fillRect(1, headY + 4, 11, 4);

      // Hair
      ctx.fillStyle = colors.hair;
      ctx.beginPath();
      ctx.ellipse(-2, headY - 11, 16, 10, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (this.charData.id === 'bolsonaro') {
      // Bolsonaro: Cabelo partido lateral cinza-castanho, testa marcada
      ctx.fillStyle = colors.hair;
      ctx.beginPath();
      ctx.ellipse(-2, headY - 10, 16, 9, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Franja lateral
      ctx.fillRect(2, headY - 11, 10, 5);
    } else if (this.charData.id === 'boulos') {
      // Boulos: Barba preta cerrada cheia + cabelo escuro
      ctx.fillStyle = colors.beard;
      ctx.beginPath();
      ctx.ellipse(2, headY + 7, 13, 9, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(2, headY + 3, 10, 4);

      // Hair
      ctx.fillStyle = colors.hair;
      ctx.beginPath();
      ctx.ellipse(-2, headY - 11, 16, 9, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (this.charData.id === 'tarcisio') {
      // Tarcísio: Capacete de engenheiro de obra branco com selo do Brasil!
      ctx.fillStyle = colors.hair;
      ctx.fillRect(-13, headY - 10, 24, 6);

      // Helmet
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 4;
      // Dome
      ctx.beginPath();
      ctx.ellipse(0, headY - 16, 17, 11, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Brim
      ctx.fillRect(-18, headY - 16, 38, 4);
      // Small Brazil flag badge on helmet
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(-4, headY - 24, 8, 5);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-2, headY - 23, 4, 3);
    } else if (this.charData.id === 'dilma') {
      // Dilma: Cabelo castanho volumoso ondulado + óculos marcantes
      ctx.fillStyle = colors.hair;
      ctx.beginPath();
      ctx.ellipse(-1, headY - 11, 18, 12, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Óculos
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, headY - 7, 10, 8);
    } else if (this.charData.id === 'haddad') {
      // Haddad: Óculos retangulares e cabelo castanho escovado
      ctx.fillStyle = colors.hair;
      ctx.beginPath();
      ctx.ellipse(-1, headY - 11, 16, 9, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Óculos
      ctx.strokeStyle = '#1e272e';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, headY - 6, 9, 7);
    } else if (this.charData.id === 'jones') {
      // Jones Manoel: Barba cerrada e óculos
      ctx.fillStyle = colors.hair;
      ctx.beginPath();
      ctx.ellipse(-1, headY - 11, 16, 8, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Barba
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.ellipse(3, headY + 8, 12, 8, 0, 0, Math.PI);
      ctx.fill();
      // Óculos
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, headY - 6, 9, 7);
    } else if (this.charData.id === 'nikolas') {
      // Nikolas: Cabelo moderno com topete lateral
      ctx.fillStyle = colors.hair;
      ctx.beginPath();
      ctx.ellipse(0, headY - 11, 15, 9, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(4, headY - 13, 8, 5); // topete
      // Broche do Brasil na lapela
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(-12, torsoY + 8, 6, 5);
    } else if (this.charData.id === 'flavio') {
      // Flavio Bolsonaro: Cabelo partido com costeletas
      ctx.fillStyle = colors.hair;
      ctx.beginPath();
      ctx.ellipse(-2, headY - 10, 16, 9, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-12, headY - 6, 4, 10); // costeleta
    } else if (this.charData.id === 'campopiano') {
      // Eduarda Campopiano: Cabelo castanho escuro longo, mechas e lenço no blazer
      ctx.fillStyle = colors.hair;
      ctx.beginPath();
      ctx.ellipse(-1, headY - 10, 16, 12, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Mechas longas descendo nos ombros
      ctx.fillRect(-14, headY - 8, 6, 26);
      ctx.fillRect(8, headY - 8, 6, 26);
      // Lenço verde-amarelo elegante na gola do blazer
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(-6, torsoY + 4, 12, 5);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-3, torsoY + 6, 6, 4);
    }

    ctx.restore();
  }

  renderSprite(ctx, spriteSheet) {
    let col = 0;
    let row = 0;

    switch (this.state) {
      case FIGHTER_STATE.IDLE:
      case FIGHTER_STATE.WALK_FWD:
      case FIGHTER_STATE.WALK_BACK:
      case FIGHTER_STATE.CROUCH:
      case FIGHTER_STATE.BLOCK:
        col = 0;
        row = 0;
        break;
      case FIGHTER_STATE.PUNCH_LIGHT:
      case FIGHTER_STATE.PUNCH_HEAVY:
      case FIGHTER_STATE.PUNCH:
      case FIGHTER_STATE.HEAVY_PUNCH:
      case FIGHTER_STATE.SPECIAL:
      case FIGHTER_STATE.SUPER:
        col = 1;
        row = 0;
        break;
      case FIGHTER_STATE.KICK:
      case FIGHTER_STATE.LOW_KICK:
      case FIGHTER_STATE.JUMP_ATTACK:
        col = 0;
        row = 1;
        break;
      case FIGHTER_STATE.HIT:
      case FIGHTER_STATE.HURT:
      case FIGHTER_STATE.KNOCKDOWN:
        col = 1;
        row = 1;
        break;
      default:
        col = 0;
        row = 0;
    }

    const sw = spriteSheet.width / 2;
    const sh = spriteSheet.height / 2;
    const sx = col * sw;
    const sy = row * sh;

    // Subtle natural breathing / walk step bounce
    const bobY = (this.state === FIGHTER_STATE.IDLE)
      ? Math.sin(this.animFrame * 2) * 2.5
      : (this.state === FIGHTER_STATE.WALK_FWD || this.state === FIGHTER_STATE.WALK_BACK)
      ? Math.abs(Math.sin(this.animFrame * 2.5)) * 3.5
      : 0;

    const isCrouching = (this.state === FIGHTER_STATE.CROUCH || this.state === FIGHTER_STATE.LOW_KICK);
    const crouchOffset = isCrouching ? 28 : 0;

    // Attack slight forward push for punches and specials
    const isPunchAttack = (
      this.state === FIGHTER_STATE.PUNCH_LIGHT ||
      this.state === FIGHTER_STATE.PUNCH_HEAVY ||
      this.state === FIGHTER_STATE.SPECIAL ||
      this.state === FIGHTER_STATE.SUPER
    );
    const attackShiftX = isPunchAttack ? 14 : 0;

    const targetH = 205;
    const targetW = targetH * (sw / sh);
    const targetX = -targetW / 2 + attackShiftX;
    const targetY = -targetH + bobY + crouchOffset;

    // Blocking shield flash effect
    if (this.state === FIGHTER_STATE.BLOCK) {
      ctx.save();
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -90, 85, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      ctx.restore();
    }

    // Clean cell sampling with 2px safe inset to prevent border bleed
    const pad = 2;
    const srcX = sx + pad;
    const srcY = sy + pad;
    const srcW = Math.max(1, sw - pad * 2);
    const srcH = Math.max(1, sh - pad * 2);

    ctx.drawImage(spriteSheet, srcX, srcY, srcW, srcH, targetX, targetY, targetW, targetH);
  }
}
