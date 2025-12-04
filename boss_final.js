const FinalBoss = {
    drinks: [],
    timer: 0,

    update(player) {
        this.timer++;

        // lancia drink ogni 20 frame
        if (this.timer % 20 === 0) {
            this.drinks.push({ x: 900, y: 100 + Math.random() * 300, w: 20, h: 20 });
        }

        // movimento drink
        this.drinks.forEach(d => d.x -= 10);

        // collisione
        this.drinks.forEach(d => {
            if (
                player.x < d.x + d.w &&
                player.x + player.width > d.x &&
                player.y < d.y + d.h &&
                player.y + player.height > d.y
            ) {
                alert("Colpito da un drink di Golruk!");
                location.reload();
            }
        });
    },

    render(ctx) {
        ctx.fillStyle = "purple";
        this.drinks.forEach(d => ctx.fillRect(d.x, d.y, d.w, d.h));
    }
};
