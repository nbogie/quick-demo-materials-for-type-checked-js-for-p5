function setup() {
    createCanvas(400, 400);
    background(100);
}

function draw() {
    circle(mouseX, mouseY, 10);
}

function mousePressed() {
    rectMode(CENTER);
    const colour = randomColour();
    fill(colour);
    square(mouseX, mouseY, 100);
}

function mouseDragged() {
    const colour = random(["red", 255]);
    //@ts-ignore
    fill(colour);

    fill(random(255), random(255), random(255), 50);
    circle(mouseX, mouseY, random(50, 100));
}

/** @return {p5.Color} */
function randomColour() {
    return color(random(255), random(255), random(255));
}
