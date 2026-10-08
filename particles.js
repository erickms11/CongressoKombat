// particles.js - Combat visual effects, hitsparks and flying money satire particles

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
      p.rotation = (p.rotation || 0) + (p.vRot || 0) * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    ctx.save();
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation) ctx.rotate(p.rotation);
      ctx.globalAlpha = alpha;

      if (p.type === 'spark') {
        ctx.fillStyle = p.color || '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'money') {
        // Cédula de Real brasileira (R$ 100 azul-turquesa ou R$ 50 dourado)
        const is100 = p.billType === 100;
        ctx.fillStyle = is100 ? '#00cec9' : '#e17055';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.strokeRect(-p.size, -p.size * 0.5, p.size * 2, p.size);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(is100 ? '100' : '50', 0, 0);
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color || '#ffd32a';
        ctx.lineWidth = 3 * alpha;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 + (1 - alpha)), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'dust') {
        ctx.fillStyle = 'rgba(200, 214, 229, ' + (alpha * 0.5) + ')';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color || '#ff3838';
        this.drawStar(ctx, 0, 0, 5, p.size, p.size * 0.5);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  // Spawn Hit Sparks
  spawnHitSparks(x, y, count = 12, color = '#ffd32a') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 240;
      this.particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 200,
        size: 3 + Math.random() * 3,
        color: Math.random() > 0.4 ? color : '#ffffff',
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.4
      });
    }

    // Impact ring
    this.particles.push({
      type: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      size: 16,
      color: '#fff',
      life: 0.2,
      maxLife: 0.2
    });
  }

  // Spawn Flying Brazilian Money Notes (R$ 100 e R$ 50)
  spawnFlyingMoney(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.5;
      const speed = 150 + Math.random() * 180;
      this.particles.push({
        type: 'money',
        billType: Math.random() > 0.5 ? 100 : 50,
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vRot: (Math.random() - 0.5) * 10,
        rotation: Math.random() * Math.PI * 2,
        gravity: 380,
        size: 9 + Math.random() * 3,
        life: 0.9 + Math.random() * 0.4,
        maxLife: 1.2
      });
    }
  }

  // Spawn Dust Cloud (jump/land)
  spawnDust(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const speed = 40 + Math.random() * 60;
      const dir = (Math.random() - 0.5) * 2;
      this.particles.push({
        type: 'dust',
        x: x + (Math.random() - 0.5) * 15,
        y,
        vx: dir * speed,
        vy: -20 - Math.random() * 30,
        gravity: 10,
        size: 5 + Math.random() * 5,
        life: 0.4,
        maxLife: 0.4
      });
    }
  }

  // Spawn Block Sparks
  spawnBlockSparks(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.random() - 0.5) * Math.PI;
      const speed = 90 + Math.random() * 120;
      this.particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 150,
        size: 2.5,
        color: '#70a1ff',
        life: 0.2,
        maxLife: 0.2
      });
    }
  }

  // Clear all
  clear() {
    this.particles = [];
  }
}

export const particleSystem = new ParticleSystem();
