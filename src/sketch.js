function setup() {
    createCanvas(400, 400);
    background(100);
    rectMode(CENTRE);
}

function draw() {
    circle(mouseX, mouseY, 10);
}

function mousePressed() {
    const colour = randomColour();
    fill(colour);
    square(mouseX, mouseY, 100);
}

function mouseDragged() {
    fill(random(255), random(255), random(255), random(255), 100);
    circle(mouseX, mouseY, random(50, 100));
}

function randomColour() {
    color(random(255), random(255), random(255));
}
