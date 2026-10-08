// projectile.js - Special move projectiles for all 10 politicians

import { particleSystem } from './particles.js';
import { arcadeAudio } from './audio.js';

export class Projectile {
  constructor({
    owner,
    x,
    y,
    vx,
    type,
    color,
    damage,
    radius = 16,
    isSuper = false
  }) {
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.type = type;
    this.color = color;
    this.damage = damage;
    this.radius = radius;
    this.isSuper = isSuper;
    this.life = 2.5; // seconds
    this.alive = true;
    this.animTime = 0;
  }

  update(dt, arenaWidth) {
    if (!this.alive) return;
    this.animTime += dt;
    this.x += this.vx * dt;
    this.life -= dt;

    if (this.life <= 0 || this.x < -50 || this.x > arenaWidth + 50) {
      this.alive = false;
    }
  }

  checkCollision(target) {
    if (!this.alive || !target || target === this.owner) return false;
    if (target.isDead || target.isInvulnerable) return false;

    const hurtBox = target.getHurtBox();
    const hit = (
      this.x + this.radius >= hurtBox.x &&
      this.x - this.radius <= hurtBox.x + hurtBox.w &&
      this.y + this.radius >= hurtBox.y &&
      this.y - this.radius <= hurtBox.y + hurtBox.h
    );

    if (hit) {
      this.alive = false;
      arcadeAudio.specialHit();
      target.takeHit({
        damage: this.damage,
        isHeavy: this.isSuper,
        knockback: this.vx > 0 ? 300 : -300,
        hitY: this.y,
        isProjectile: true
      });
      particleSystem.spawnHitSparks(this.x, this.y, 16, this.color);
      particleSystem.spawnFlyingMoney(this.x, this.y, this.isSuper ? 6 : 3);
      return true;
    }
    return false;
  }

  render(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x, this.y);

    const facing = Math.sign(this.vx) || 1;

    if (this.type === 'lula_star') {
      // Estrela Vermelha flamejante
      const rot = this.animTime * 12 * facing;
      ctx.rotate(rot);
      ctx.shadowColor = '#ff3838';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ff3838';
      particleSystem.drawStar(ctx, 0, 0, 5, this.radius, this.radius * 0.45);
      ctx.fillStyle = '#fff';
      particleSystem.drawStar(ctx, 0, 0, 5, this.radius * 0.5, this.radius * 0.22);

    } else if (this.type === 'dilma_wind') {
      // Ciclone / Vento Estocado em espiral
      ctx.shadowColor = '#00cec9';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#81ecec';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const off = ((this.animTime * 6 + i * 0.25) % 1) * this.radius * 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, off + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

    } else if (this.type === 'haddad_bill') {
      // Boleto Voador / Imposto giratório
      ctx.rotate(this.animTime * 10 * facing);
      ctx.shadowColor = '#9b59b6';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#8e44ad';
      ctx.lineWidth = 2;
      ctx.fillRect(-this.radius * 0.9, -this.radius * 0.6, this.radius * 1.8, this.radius * 1.2);
      ctx.strokeRect(-this.radius * 0.9, -this.radius * 0.6, this.radius * 1.8, this.radius * 1.2);
      // Linhas do boleto
      ctx.fillStyle = '#8e44ad';
      ctx.fillRect(-this.radius * 0.7, -4, this.radius * 1.4, 2);
      ctx.fillRect(-this.radius * 0.7, 1, this.radius * 1.4, 2);

    } else if (this.type === 'boulos_sound') {
      // Megafone Sônico - Ondas sonoras concêntricas
      ctx.strokeStyle = '#ff793f';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff5252';
      ctx.shadowBlur = 12;
      for (let i = 0; i < 3; i++) {
        const offset = ((this.animTime * 4 + i * 0.3) % 1) * this.radius * 1.5;
        ctx.beginPath();
        if (facing > 0) ctx.arc(0, 0, offset + 6, -Math.PI * 0.35, Math.PI * 0.35);
        else ctx.arc(0, 0, offset + 6, Math.PI * 0.65, Math.PI * 1.35);
        ctx.stroke();
      }

    } else if (this.type === 'jones_book') {
      // Livro Vermelho de Teoria
      ctx.rotate(this.animTime * 8 * facing);
      ctx.shadowColor = '#d63031';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-this.radius, -this.radius * 0.7, this.radius * 2, this.radius * 1.4);
      // Páginas brancas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-this.radius + 3, -this.radius * 0.5, this.radius * 1.6, this.radius);
      // Estrela amarela na capa
      ctx.fillStyle = '#ffd32a';
      particleSystem.drawStar(ctx, 0, 0, 5, 5, 2.5);

    } else if (this.type === 'bolsonaro_gun') {
      // Disparo da Arminha duplo verde e amarelo
      ctx.shadowColor = '#ffd32a';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffd32a';
      ctx.beginPath();
      ctx.ellipse(0, -6, this.radius * 1.2, this.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2ed573';
      ctx.beginPath();
      ctx.ellipse(-10 * facing, 6, this.radius * 1.1, this.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(8 * facing, -6, 4, 0, Math.PI * 2);
      ctx.arc((-2) * facing, 6, 3, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'tarcisio_hammer') {
      // Asfalto / Detrito pesado
      ctx.rotate(this.animTime * 8 * facing);
      ctx.shadowColor = '#fa983a';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#485460';
      ctx.fillRect(-this.radius, -this.radius * 0.8, this.radius * 2, this.radius * 1.6);
      ctx.fillStyle = '#ffd32a';
      ctx.fillRect(-this.radius * 0.7, -2, this.radius * 1.4, 4);

    } else if (this.type === 'nikolas_post') {
      // Lacre Virtual / Like elétrico
      ctx.shadowColor = '#00d2d3';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#0984e3';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius * 1.2, this.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Polegar / Símbolo de like branco
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👍', 0, 0);

    } else if (this.type === 'flavio_chocolate') {
      // Caixa de Trufas Kopenhagen dourada
      ctx.rotate(this.animTime * 6 * facing);
      ctx.shadowColor = '#fbc531';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#533519'; // chocolate
      ctx.fillRect(-this.radius, -this.radius * 0.8, this.radius * 2, this.radius * 1.6);
      ctx.strokeStyle = '#fbc531';
      ctx.lineWidth = 2;
      ctx.strokeRect(-this.radius, -this.radius * 0.8, this.radius * 2, this.radius * 1.6);
      // Moeda de ouro
      ctx.fillStyle = '#ffd32a';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'campopiano_discourse') {
      // Megafone / Ondas sonoras de discurso vibrante
      ctx.shadowColor = '#00cec9';
      ctx.shadowBlur = 14;
      // Corpo do megafone
      ctx.fillStyle = '#0984e3';
      ctx.beginPath();
      ctx.moveTo(-10 * facing, -5);
      ctx.lineTo(8 * facing, -13);
      ctx.lineTo(8 * facing, 13);
      ctx.lineTo(-10 * facing, 5);
      ctx.closePath();
      ctx.fill();
      // Bocal e detalhe
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-12 * facing, -4, 4 * facing, 8);
      // Ondas sonoras expansivas verde-água
      ctx.strokeStyle = '#55efc4';
      ctx.lineWidth = 2.5;
      for (let i = 1; i <= 3; i++) {
        const rad = ((this.animTime * 8 + i * 0.3) % 1) * 20 + 6;
        ctx.beginPath();
        ctx.arc(10 * facing, 0, rad, -Math.PI * 0.3, Math.PI * 0.3);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
