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
        const dy = v.y - center.y;
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
            addStick(br, bl);
            addStick(bl, tl);
            addStick(tl, br, true);
            addStick(tr, bl, true);
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
class Game {
    constructor() {
        this.canvas = document.getElementById('world');
        this.ctx = this.canvas.getContext('2d');
        this.width = CONFIG.cols * CONFIG.cellSize;
        this.height = CONFIG.rows * CONFIG.cellSize;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.shapes = [];
        this.activeShape = null;
        this.score = 0;
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.draggedParticle = null;
        this.isMouseDown = false;
        window.addEventListener('keydown', e => this.handleInput(e));
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
        this.canvas.addEventListener('touchmove', e => this.handleTouchMove(e), {passive: false});
        this.canvas.addEventListener('touchstart', e => this.handleTouchStart(e), {passive: false});
        window.addEventListener('touchend', e => this.handleMouseUp(e));
        this.spawn();
        this.loop();
    }
    spawn() {
        const types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.activeShape = new JellyShape(this.width/2 - CONFIG.cellSize, -CONFIG.cellSize * 2, type);
        this.shapes.push(this.activeShape);
    }
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
    }
    handleTouchMove(e) {
        e.preventDefault();
        const pos = this.getTouchPos(e);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
    }
    handleMouseDown(e) {
        this.isMouseDown = true;
        const pos = this.getMousePos(e);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        this.draggedParticle = this.findNearestParticle(this.mouseX, this.mouseY);
    }
    handleTouchStart(e) {
        e.preventDefault();
        this.isMouseDown = true;
        const pos = this.getTouchPos(e);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        this.draggedParticle = this.findNearestParticle(this.mouseX, this.mouseY);
    }
    handleMouseUp(e) {
        this.isMouseDown = false;
        this.draggedParticle = null;
    }
    findNearestParticle(x, y) {
        let nearest = null;
        let minDistSq = 30 * 30;
        if (this.activeShape) {
            for (let p of this.activeShape.particles) {
                const dx = p.pos.x - x;
                const dy = p.pos.y - y;
                const distSq = dx*dx + dy*dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearest = p;
                }
            }
        }
        for (let s of this.shapes) {
            for (let p of s.particles) {
                const dx = p.pos.x - x;
                const dy = p.pos.y - y;
                const distSq = dx*dx + dy*dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearest = p;
                }
            }
        }
        return nearest;
    }
    handleInput(e) {
        this.keys[e.code] = true;
        if (!this.activeShape) return;
        if (e.code === 'ArrowUp') {
            this.activeShape.rotate();
        }
    }
    applyInput() {
        if (!this.activeShape) return;
        const force = 1.5;
        if (this.keys['ArrowLeft']) {
            this.activeShape.particles.forEach(p => p.pos.x -= force);
        }
        if (this.keys['ArrowRight']) {
            this.activeShape.particles.forEach(p => p.pos.x += force);
        }
        if (this.keys['ArrowDown']) {
            this.activeShape.particles.forEach(p => p.pos.y += force);
        }
    }
    resolveCollisions() {
        if (!this.activeShape) return;
        const minDist = 15;
        for (const shape of this.shapes) {
            if (shape === this.activeShape) continue;
            for (const p1 of this.activeShape.particles) {
                for (const p2 of shape.particles) {
                    const dx = p1.pos.x - p2.pos.x;
                    const dy = p1.pos.y - p2.pos.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq === 0 || distSq >= minDist * minDist) continue;
                    const dist = Math.sqrt(distSq);
                    const pen = (minDist - dist) * 0.5;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    if (!p1.pinned) {
                        p1.pos.x += nx * pen;
                        p1.pos.y += ny * pen;
                    }
                    if (!p2.pinned) {
                        p2.pos.x -= nx * pen;
                        p2.pos.y -= ny * pen;
                    }
                    const vxRel = (p1.pos.x - p1.oldPos.x) - (p2.pos.x - p2.oldPos.x);
                    const vyRel = (p1.pos.y - p1.oldPos.y) - (p2.pos.y - p2.oldPos.y);
                    p1.pos.x -= vxRel * 0.1;
                    p1.pos.y -= vyRel * 0.1;
                }
            }
        }
    }
    checkSettled() {
        if (!this.activeShape) return;
        let maxY = 0;
        let moving = false;
        for (let p of this.activeShape.particles) {
            if (p.pos.y > maxY) maxY = p.pos.y;
            const vel = Math.hypot(p.pos.x - p.oldPos.x, p.pos.y - p.oldPos.y);
            if (vel > 0.3) moving = true;
        }
        if (!moving && maxY > this.height - 10) {
            this.lockShape();
            return;
        }
    }
    lockTimer = 0;
    updateLockLogic() {
        if (!this.activeShape) return;
        let totalVel = 0;
        let touchingFloor = false;
        for (let p of this.activeShape.particles) {
            totalVel += Math.hypot(p.pos.x - p.oldPos.x, p.pos.y - p.oldPos.y);
            if (p.pos.y >= this.height - 5) touchingFloor = true;
        }
        if (totalVel < 2.0) {
            this.lockTimer++;
        } else {
            this.lockTimer = 0;
        }
        if (this.lockTimer > 40) {
            this.lockShape();
        }
    }
    lockShape() {
        this.activeShape.settled = true;
        this.activeShape = null;
        this.lockTimer = 0;
        this.checkLines();
        this.spawn();
    }
    checkLines() {
        const sliceHeight = CONFIG.cellSize;
        const threshold = CONFIG.cols * 2;
        for (let y = this.height - sliceHeight; y > 0; y -= sliceHeight) {
            let count = 0;
            for (let s of this.shapes) {
                for (let p of s.particles) {
                    if (p.pos.y >= y && p.pos.y < y + sliceHeight) {
                        count++;
                    }
                }
            }
            if (count > 25) {
                this.score += 100;
                document.getElementById('score-display').innerText = `Score: ${this.score}`;
                this.explodeSlice(y, sliceHeight);
            }
        }
    }
    explodeSlice(y, height) {
        for (const shape of this.shapes) {
            const particlesToRemove = new Set();
            for (const p of shape.particles) {
                if (p.pos.y >= y && p.pos.y < y + height) {
                    particlesToRemove.add(p);
                }
            }
            if (particlesToRemove.size === 0) continue;
            if (this.draggedParticle && particlesToRemove.has(this.draggedParticle)) {
                this.draggedParticle = null;
                this.isMouseDown = false;
            }
            shape.sticks = shape.sticks.filter(stick =>
                !particlesToRemove.has(stick.p1) && !particlesToRemove.has(stick.p2)
            );
            shape.particles = shape.particles.filter(p => !particlesToRemove.has(p));
        }
        this.shapes = this.shapes.filter(shape => shape.particles.length > 0);
    }
    update() {
        this.applyInput();
        this.updateLockLogic();
        for (let i = 0; i < CONFIG.iterationCount; i++) {
            this.shapes.forEach(shape => {
                shape.particles.forEach(p => {
                    p.update();
                    if (p === this.draggedParticle) {
                        p.pos.x = this.mouseX;
                        p.pos.y = this.mouseY;
                    }
                    p.constrainBounds(this.width, this.height);
                });
                shape.sticks.forEach(s => s.update());
            });
            this.resolveCollisions();
        }
    }
    draw() {
        this.ctx.fillStyle = 'rgba(10, 10, 10, 0.3)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.shapes.forEach(s => s.draw(this.ctx));
        if (this.draggedParticle) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.setLineDash([5, 5]);
            this.ctx.moveTo(this.draggedParticle.pos.x, this.draggedParticle.pos.y);
            this.ctx.lineTo(this.mouseX, this.mouseY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, 10, 0, Math.PI*2);
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.stroke();
        }
    }
    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}
window.onload = () => {
    new Game();
};