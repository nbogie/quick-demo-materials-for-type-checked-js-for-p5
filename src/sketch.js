function setup() {
    createCanvas(400, 400);
    background(220);
}

function draw() {
    circle(mouseX, mouseY, 10);
}

function mousePressed() {
    rectMode(SQAURE);
    square(width / 2, hieght / 2, 100);
}

function mouseDragged() {
    fill(random(255), random(255), random(255), random(255), 100);
    circle(mouseX, mouseY, random(50, 100));
}
