class Pie {
    constructor() {
        this.x = 50;
        this.y = 400;
        this.vx = 0;
        this.vy = 0;
        this.width = 40;
        this.height = 60;
    }

    update() {
        this.vy += 0.8;
        this.x += this.vx;
        this.y += this.vy;

        Game.collisionWithPlatforms(this);
    }
}

class Platform {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
}
