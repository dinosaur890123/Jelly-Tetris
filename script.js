const CONFIG = {
    gravity: 0.15,
    friction: 0.98,
    groundFriction: 0.7,
    stiffness: 0.4,
    iterationCount: 5,
    cellSize: 35,
    cols: 10,
    rows: 16
};
const Vec2 = {
    add: (v1, v2) => ({x: v1.x + v2.x, y: v1.y + v2.y}),
    sub: (v1, v2) => ({x: v1.x - v2.x, y: v1.y - v2.y}),
    mult: (v, s) => ({x: v.x * s, y: v.y * s}),
    dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y,
    dist: (v1, v2) => Math.hypot(v1.x - v2.x, v1.y - v2.y),
    rotate: (v, center, angle) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = v.x - center.x;
        const dy = v.y - enter.y;
        return{
            x: center.x + (dx * cos - dy * sin),
            y: center.y + (dx * sin + dy * cos)
        };
    }
};
class Particle {
    constructor(x, y) {
        this.pos = {x, y};
        this.oldPos = {x, y};
        this.radius = 4;
        this.mass = 1;
        this.pinned = false;
    }
    update() {
        if (this.pinned) return;
        const vx = (this.pos.x - this.oldPos.x) * CONFIG.friction;
        const vy = (this.pos.y - this.oldPos.y) * CONFIG.friction;
        this.oldPos = { ...this.pos };
        this.pos.x += vx;
        this.pos.y += vy + CONFIG.gravity;
    }
    constrainBounds(width, height) {
        const bounce = 0.3;
        if (this.pos.y > height - this.radius) {
            const dy = this.pos.y - (height - this.radius);
            this.pos.y = height - this.radius;
            const vx = (this.pos.x - this.oldPos.x) * CONFIG.groundFriction;
            this.oldPos.x = this.pos.x - vx;
        }
        if (this.pos.x < this.radius) {
            this.pos.x = this.radius;
            const vx = (this.pos.x - this.oldPos.x) * -bounce;
            this.oldPos.x = this.pos.x - vx;
        }
        if (this.pos.x > width - this.radius) {
            this.pos.x = width - this.radius;
            const vx = (this.pos.x - this.oldPos.x) * -bounce;
            this.oldPos.x = this.pos.x - vx;
        }
    }
}
class Stick {
    constructor(p1, p2, stiffness = CONFIG.stiffness) {
        this.p1 = p1;
        this.p2 = p2;
        this.length = Vec2.dist(p1.pos, p2.pos);
        this.stiffness = stiffness;
    }
    update() {
        const dx = this.p2.pos.x - this.p1.pos.x;
        const dy = this.p2.pos.y - this.p1.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return;
        const difference = this.length - dist;
        const percent = (difference / dist) * 0.5 * this.stiffness;
        const offsetX = dx * percent;
        const offsetY = dy * percent;
        if (!this.p1.pinned) {
            this.p1.pos.x -= offsetX;
            this.p1.pos.y -= offsetY;
        }
        if (!this.p2.pinned) {
            this.p2.pos.x += offsetX;
            this.p2.pos.y += offsetY;
        }
    }
    draw(ctx, color) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.moveTo(this.p1.pos.x, this.p1.pos.y);
        ctx.lineTo(this.p2.pos.x, this.p2.pos.y);
        ctx.stroke();
    }
}
class JellyShape {
    constructor(x, y, type) {
        this.particles = [];
        this.sticks = [];
        this.type = type;
        this.color = this.getColor(type);
        this.glow = this.getGlow(type);
        this.settled = false;
        this.buildShape(x, y, type);
    }
    getColor(type) {
        const colors = {I: '#00f0f0', O: '#f0f000', T: '#a000f0', S: '#00f000', Z: '#f00000', J: '#0000f0', L: '#f0a000'};
        return colors[type] || '#ffffff';
    }
    getGlow(type) {
        return this.getColor(type);
    }
    buildShape(startX, startY, type) {
        const shapes = {
            O: [[0,0], [1,0], [0,1], [1,1]],
            I: [[0,0], [0,1],[0,2], [0,3]],
            T: [[0,0], [1,0], [2,0], [1,1]],
            L: [[0,0], [0,1], [0,2], [1,2]],
            J: [[1,0], [1,1], [1,2], [0,2]],
            S: [[1,0], [2,0], [0,1], [1,1]],
            Z: [[0,0], [1,0], [1,1], [2,1]]
        };
        const blocks = shapes[type] || shapes['O'];
        const s = CONFIG.cellSize;
        let nodes = {};
        blocks.forEach(b => {
            const bx = b[0], by = b[1];
            const corners = [
                [bx, by], [bx+1, by], [bx+1, by+1], [bx, by+1]
            ];
            corners.forEach(c => {
                const key = `${c[0]},${c[1]}`;
                if (!nodes[key]) {
                    const px = startX + c[0] * s;
                    const py = startY + c[1] * s;
                    const p = new Particle(px, py);
                    this.particles.push(p);
                    nodes[key] = this.particles.length - 1;
                }
            });
        });
        const connectedPairs = new Set();
        const addStick = (idx1, idx2, isCross = false) => {
            const key = idx1 < idx2 ? `${idx1}-${idx2}` : `${idx2}-${idx1}`;
            if (connectedPairs.has(key)) return;
            this.sticks.push(new Stick(
                this.particles[idx1],
                this.particles[idx2], 
                isCross ? CONFIG.stiffness * 0.5 : CONFIG.stiffness
            ));
            connectedPairs.add(key);
        };
        blocks.forEach(b => {
            const bx = b[0], by = b[1];
            const tl = nodes[`${bx},${by}`];
            const tr = nodes[`${bx+1},${by}`];
            const br = nodes[`${bx+1},${by+1}`];
            const bl = nodes[`${bx},${by+1}`];
            addStick(tl, tr);
            addStick(tr, br);
        });
    }
    rotate() {
        let cx = 0, cy = 0;
        this.particles.forEach(p => {cx += p.pos.x; cy += p.pos.y;});
        cx /= this.particles.length;
        cy /= this.particles.length;
        const center = {x: cx, y: cy};
        this.particles.forEach(p => {
            const newPos = Vec2.rotate(p.pos, center, Math.PI / 2);
            const vel = Vec2.sub(p.pos, p.oldPos);
            const rotVel = Vec2.rotate(vel, {x:0, y:0}, Math.PI/2);
            p.pos = newPos;
            p.oldPos = Vec2.sub(newPos, rotVel);
        });
    }
    move(x, y) {
        this.particles.forEach(p => {
            p.pos.x += x;
            p.pos.y += y;
            p.oldPos.x += x;
            p.oldPos.y += y;
        });
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.glow;
        ctx.beginPath();
        this.sticks.forEach(s => {
            ctx.moveTo(s.p1.pos.x, s.p1.pos.y);
            ctx.lineTo(s.p2.pos.x, s.p2.pos.y);
        });
        ctx.stroke();
        ctx.fillStyle = '#fff';
        this.particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.pos.x, p.pos.y, 2, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;
    }
    
}