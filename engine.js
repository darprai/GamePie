const Engine = {
    canvas: null,
    ctx: null,
    width: 960,
    height: 540,
    currentLevel: 1,

    start() {
        this.canvas = document.getElementById("game");
        this.ctx = this.canvas.getContext("2d");
        this.loop();
    },

    loop() {
        requestAnimationFrame(() => Engine.loop());
        Game.update();
        Game.render();
    }
};
