function setup() {
    createCanvas(400, 400);
    background(220);
}

function draw() {
    circle(mouseX, mouseY, 50);

    const v = p5.Vector.fromAngle(0, 100);
}
