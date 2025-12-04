const Ending = {
    show() {
        document.getElementById("game").style.display = "none";
        document.getElementById("menu").style.display = "none";
        document.getElementById("ending").style.display = "block";
    },

    loadImage(e) {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = function(event) {
            document.getElementById("finalImage").innerHTML =
                `<img src="${event.target.result}" style="max-width:300px;">`;
        };
        reader.readAsDataURL(file);
    }
};
