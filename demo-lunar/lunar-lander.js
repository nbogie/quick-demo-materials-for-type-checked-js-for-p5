/*
    Lunar Lander #WCCChallenge "Pump"
    https://openprocessing.org/sketch/2711492
    
    Also on github at https://github.com/nbogie/lunar-lander-p5js
	 
    This is a quick attempt at implementing a "lunar-lander"/"thrust" style game.
    So far, the pump theme isn't very strong in this one, but I though i'd submit for fun as I did write it for the challenge.     
    
    Currently, there's: 
      * fuel pumped from the tank to the ship,    
      * pump association with the winds that blow across the moon,
      (I can't decide how much atmosphere is, here!)
    
    Slow frame-rate?  
    If you're getting a frame rate below 60FPS, consider disabling wind with 'w' - wind is the main burden.
    (You can also enter zen mode with 'z')
    
    Credits: Palette is "Tundra3" from Kjetil Golid's chromotome collection https://chromotome-quicker.netlify.app/ and https://github.com/kgolid
    
    See all challenge submissions: 
    https://openprocessing.org/curation/78544

    Join the Birb's Nest Discord for friendly creative coding community
    and future challenges and contributions: https://discord.gg/S8c7qcjw2b
   
	 If you're curious, on the github repo, there is a work-in-progress branch there that allows you to fly into a the cavern.
	 I'm following the old game "Thrust" on BBC micro.  https://github.com/nbogie/lunar-lander-p5js/tree/new-terrain
*/

/**
 * @typedef {Object} Config
 * @property {number} turnSpeed speed at which ship turns
 * @property {number} thrust force with which ship is propelled
 * @property {number} gravity
 * @property {number} xStep how often in pixels a terrain point is created
 * @property {number} padWidth width of landing pad
 * @property {number} seed random/noise seed used to generate the world (e.g. its terrain)
 * @property {number} fuelUsedPerTick how quickly fuel is used up
 * @property {number} refuelPerTick how quickly we refuel
 * @property {boolean} windEnabled enable/disable wind system
 * @property {number} numWindParticles only relevant to the visualisation of the wind.  lower number for better performance
 * @property {boolean} screenShakeEnabled
 * @property {boolean} starsEnabled are stars visible?
 * @property {boolean} debugMessagesEnabled controls display of misc text output about the ship and world useful for debugging
 * @property {boolean} rainbowWindEnabled should the wind particles be rainbow coloured?
 * @property {boolean} drawSunAsLines how should the sun/planets be rendered?
 * @property {boolean} zenModeEnabled zen mode causes most non-essential visuals to be removed
 * @property {Object} zenModeBackup stores a copy of the config prior to toggling into zen mode, for later restoration
 */
/**
 *
 * @returns {Config}
 */
function createConfig() {
    return {
        turnSpeed: 0.18,
        thrust: 0.15,
        gravity: 0.01,
        xStep: 15,
        padWidth: 90, //should be a multiple of xStep
        fuelUsedPerTick: 0.005,
        refuelPerTick: 0.0035,
        windEnabled: true,
        numWindParticles: 500,
        screenShakeEnabled: true,
        seed: 123, //set later
        starsEnabled: true,
        debugMessagesEnabled: true,
        rainbowWindEnabled: true,
        drawSunAsLines: true,
        zenModeEnabled: false,
        zenModeBackup: {},
    };
}
function setup() {
    config = createConfig();
    p5Canvas = createCanvas(windowWidth, windowHeight);
    frameRate(60);
    textFont("Courier New");

    postFlavourMessages();
    // postInstructionalMessages();

    restart();
}

function restart() {
    //e.g. config.seed = 1756680251196;
    config.seed = round(new Date().getMilliseconds());
    noiseSeed(config.seed);

    world = createWorld();
    respawnShip();
}
function draw() {
    focusCanvasOnce();
    background(world.palette.skyBackground);
    push();

    updateCam();

    scale(world.cam.scale);

    if (world.cam.isZooming) {
        const offset = calcScaledOffsetForFollowCam();
        translate(offset.x, offset.y);
    }

    config.screenShakeEnabled && applyAnyScreenShake();
    updateShip(world.ship);
    updateParticles();
    config.starsEnabled && drawStarfield();
    if (config.drawSunAsLines) {
        drawSunWithHorizontalLines();
    } else {
        drawSunOutline();
    }

    drawOtherMoon();

    if (config.windEnabled) {
        world.windParticles.forEach(updateWindParticle);
        drawWind();
    }
    drawTerrain();

    drawThrustParticles();
    drawShip(world.ship);
    drawLastLandingCheckWarning(world.ship);

    world.explosions.forEach(drawExplosion);
    drawMessages();

    config.debugMessagesEnabled && drawDebugText();
    pop(); //end effect of screenshake

    updateExplosions();
    updateAnyScreenShake();
    updateMessages();
}
function drawDebugText() {
    push();
    const str = JSON.stringify(world.ship.state);

    /** @type {Array<{t: string, colour?: number|string}>} */
    const outputs = [];

    outputs.push({
        t: "FPS " + frameRate().toFixed(0),
        colour: isFrameRateSlow(60, 0.1) ? "red" : "white",
    });
    outputs.push({
        t: "state: " + str,
    });

    let colourForFuelMsg =
        world.ship.fuel < 0.15 && frameCount % 30 < 15 ? 50 : 255;

    outputs.push({
        t: "fuel " + (world.ship.fuel * 100).toFixed(1) + "%",
        colour: colourForFuelMsg,
    });

    outputs.push({
        t: "tilt " + degrees(getTiltAngle(world.ship)).toFixed(0),
    });

    outputs.push({
        t: composeVerticalSpeedMessage(),
    });
    outputs.push({
        t: composeHorizontalSpeedMessage(),
    });

    outputs.push({
        t: world.ship.stuntMonitor.log.length + " stunt(s)",
    });
    outputs.push({
        t: composeLocatorMessage(),
    });

    translate(200, 50);
    for (let { t, colour } of outputs) {
        // @ts-ignore
        fill(colour ?? 255);
        noStroke();
        textSize(18);
        text(t, 0, 0);
        translate(0, 25);
    }
    pop();
}

function composeLocatorMessage() {
    const pos = world.ship.pos;
    let xIndicator = "><";
    if (pos.x < 0 || pos.x > width) {
        const multiple = 1 + floor(abs((3 * pos.x) / width));
        const symbol = pos.x < 0 ? "<" : ">";
        xIndicator = symbol.repeat(multiple);
    }
    let yIndicator = "-";
    if (pos.y < 0) {
        const multiple = 1 + floor(abs((2 * pos.y) / height));
        yIndicator = "^".repeat(multiple);
    }
    return xIndicator + " " + yIndicator;
}
function composeHorizontalSpeedMessage() {
    const val = world.ship.vel.x;
    let emoji = "0️⃣";
    if (val < 0) {
        //left arrow emoji
        emoji = "⬅️";
    } else if (val > 0) {
        emoji = "➡️";
    }
    return "h speed " + emoji + " " + world.ship.vel.x.toFixed(1);
}

function composeVerticalSpeedMessage() {
    const val = world.ship.vel.y;
    let emoji = "0️⃣";
    if (val < 0) {
        emoji = "⬆️";
    } else if (val > 0) {
        emoji = "⬇️";
    }
    return "v speed " + emoji + " " + world.ship.vel.y.toFixed(1);
}
/**
 * @typedef {Object} LandedFlyingState
 * @property {"flying"|"landed"} type
 */

/**
 * @typedef {Object} Ship
 * @property {LandedFlyingState} state - whether the ship is landed / flying / respawning, etc.
 * @property {p5.Vector} pos - position in world-space
 * @property {p5.Vector} vel - velocity
 * @property {number} height - height of ship - useful in ground-clearance checking
 * @property {number} facing - current facing of ship, in radians (animates smoothly towards desiredRotation)
 * @property {number} desiredFacing - desired facing of ship, in radians
 * @property {number} fuel
 * @property {p5.Color} thrustColour - colour to use for thrust particles
 * @property {p5.Color} colour - colour of ship
 * @property {LandingCheckResult} lastLandingCheck - result of last landing check (cleared each frame)
 * @property {StuntMonitor} stuntMonitor
 */

/**
 *
 * @param {Ship} ship
 */
function drawShip(ship) {
    function drawBooster() {
        rect(-8, 0, 5, 5);
    }

    const mainBodyHeight = round(ship.height * 0.8);

    push();
    translate(round(ship.pos.x), round(ship.pos.y));
    drawShipOverlay(ship);
    rotate(ship.facing);

    stroke(255);
    fill(ship.colour);
    rectMode(CENTER);
    rect(0, 0, round(mainBodyHeight * 0.8), mainBodyHeight);

    //debug ship height
    // noFill();
    // stroke("lime");
    // rect(0, 0, ship.height, ship.height);

    //boosters
    push();
    translate(-4, -10);
    drawBooster();
    pop();
    push();
    translate(-4, 10);
    drawBooster();
    pop();

    pop();
}

/**
 * @param {Ship} ship
 */
function drawShipOverlay(ship) {
    push();
    translate(0, -20);
    drawFuelBar(ship);
    pop();
}

/**
 * Checks if the ship meets all conditions for a safe landing.
 * @param {Object} ship - The ship object to check.
 * @returns {LandingCheckResult} Landing check result object.
 */
function checkIsOkForLanding(ship) {
    if (ship.state.type !== "flying") {
        return {
            result: false,
            reason: "not flying",
        };
    }

    if (!isNearAnyLandingPad(ship.pos.x, world.terrain.landingPads)) {
        return {
            result: false,
            type: "warning",
            reason: "not over landing pad",
        };
    }
    const groundClearance = calcGroundClearance(ship);
    if (ship.vel.y > 0.7) {
        return {
            result: false,
            type: "warning",
            reason: `descent too fast (${ship.vel.y.toFixed(2)})`,
        };
    }

    if (!isShipLevel(ship)) {
        const angleDeg = degrees(getTiltAngle(ship)).toFixed(1);
        return {
            result: false,
            type: "warning",
            reason: `not level (${angleDeg})`,
        };
    }

    if (groundClearance > -2 && groundClearance <= 0) {
        return {
            result: true,
        };
    } else {
        return {
            result: false,
            reason: "not close to ground",
        };
    }
}
/**
 * @param {Ship} ship
 * @returns number angle between -PI and PI (-180 to 180), where 0 represents a perfectly level ship.
 */
function getTiltAngle(ship) {
    return normalizeRotationAsTiltAlternativeMethod(ship.facing + PI / 2);
}

// see normalizeRotationAsTilt.  Achieves the same result, but with one more division.
function modFlooredAlwaysPositive(n, m) {
    return ((n % m) + m) % m;
}

//converts a rotation in range -inf to +inf into range -179.999 to +180
function normalizeRotationAsTiltAlternativeMethod(rawRotation) {
    return -PI + modFlooredAlwaysPositive(rawRotation - PI, TWO_PI);
}

//converts a rotation in range -inf to +inf into range -179.999 to +180
function normalizeRotationAsTilt(rawRotation) {
    //into range -360 to +360
    let normalized = rawRotation % TWO_PI;

    //into range -179 to 180
    if (normalized > PI) {
        normalized -= TWO_PI;
    }
    //into range -179, 180
    else if (normalized <= -PI) {
        normalized += TWO_PI;
    }

    return normalized;
}

/**
 * @param {Palette} palette - palette to draw colours from
 * @returns {Ship}
 */
function createShip(palette) {
    /**@type {Ship} */
    const createdShip = {
        state: {
            type: "flying",
        },
        pos: createVector(width / 2, height / 2),
        vel: createVector(0, 0),
        height: 30,
        facing: -PI / 2,
        desiredFacing: -PI / 2,
        fuel: 1,
        thrustColour: palette.all[2],
        colour: palette.skyBackground, //arr[5],
        lastLandingCheck: undefined,
        stuntMonitor: createStuntMonitor(),
    };
    clearStunts(createdShip);

    return createdShip;
}

/**
 * @param {Ship} ship
 */
function cheatSetShipForEasyLanding(ship) {
    /**@type {LandingPad[]} */
    const allPads = world.terrain.landingPads;
    const pad = random(allPads);
    ship.pos = createVector(
        pad.leftX + pad.width / 2,
        getHeightAt(pad.leftX) - 40 - ship.height / 2
    );
    setShipUprightImmediately(ship);
    ship.vel = createVector(0, 0.5);
    postMessage("cheat! easy landing prepared");
    world.ship.state = {
        type: "flying",
    };
}

function spawnPosition() {
    return createVector(100, 50);
}
/**
 * @param {Ship} ship - ship to update
 */
function setShipUprightImmediately(ship) {
    ship.desiredFacing = 0 - PI / 2;
    ship.facing = ship.desiredFacing;
}

function respawnShip() {
    world.ship.pos = spawnPosition();
    world.ship.vel = createVector(0, 0);
    setShipUprightImmediately(world.ship);
    world.ship.fuel = 1;
    world.ship.state = {
        type: "flying",
    };
    clearStunts(world.ship);
}

/**
 * Returns the distance between base of ship and ground at ship's x pos.
 * Negative clearance means the base of the ship is penetrating the ground.
 * Doesn't consider rotation of the ship.
 * @param {Ship} ship
 */
function calcGroundClearance(ship) {
    return getHeightAt(ship.pos.x) - ship.pos.y - ship.height / 2;
}

/**
 * @typedef {Object} LandingCheckResult
 * @property {boolean} result - True if landing is allowed, false otherwise.
 * @property {string} [reason] - Explanation for failure or warning.
 * @property {"warning"} [type] - Indicates a warning (optional).
 */

/**
 * @param {Ship} ship
 */
function isShipLevel(ship) {
    return abs(getTiltAngle(ship)) < PI / 5;
}
/**
 * @param {Ship} ship - ship to update
 */
function setLandedShip(ship) {
    ship.state = {
        type: "landed",
    };

    ship.vel = createVector(0, 0);
    ship.pos.y = getHeightAt(ship.pos.x) - ship.height / 2;
    setShipUprightImmediately(ship);
    //(note: we don't do an immediate refuel - it happens gradually each frame in updateShip if we're in suitable state)

    const pad = landingPadAtXOrNull(ship.pos.x);
    if (pad) {
        ship.thrustColour = pad.colour;
        postMessage("Landed at " + pad.name + " base");
        processAnyBaseToBaseFlightTime(ship, pad);

        //award points for all stunts
        // postMessage("Stunt count: " + ship.stuntMonitor.log.length);
    }
    clearStunts(ship);
}

/**
 * @param {Ship} ship
 */
function drawFuelBar(ship) {
    push();
    fill(50);
    stroke("white");
    strokeWeight(0.5);
    const fullW = 20;
    const h = 2;
    translate(-fullW / 2, 0);
    rectMode(CORNER);
    rect(0, 0, fullW, h);
    const fuelW = ship.fuel * fullW;
    fill(ship.thrustColour);
    noStroke();
    rect(0, 0, fuelW, h);

    fill(255);
    // text("F:" + ((ship.fuel * 100).toFixed(1)) + "%", 0, 0)
    // text("S:" + ship.stuntMonitor.log.length, 0, -10);
    pop();
}

/**
 *
 * @param {Ship} ship
 */
function updateShip(ship) {
    ship.lastLandingCheck = undefined;

    // monitor for stunts
    monitorStunts(ship);
    if (ship.state.type === "landed") {
        if (ship.fuel < 1) {
            const pad = landingPadAtXOrNull(ship.pos.x);
            const amtTransferred = config.refuelPerTick; // * deltaTime;
            ship.fuel = constrain(ship.fuel + amtTransferred, 0, 1);
            pad.fuel = constrain(pad.fuel - amtTransferred, 0, pad.maxFuel);
            if (ship.fuel >= 1) {
                postMessage("Refuelling complete");
            }
        }
    }
    let tookOffThisFrame = false;

    if (
        keyIsDown(UP_ARROW) ||
        keyIsDown(87) //'w' key
    ) {
        if (ship.fuel > 0) {
            fireThrusters();
            if (ship.state.type === "landed") {
                ship.state = {
                    type: "flying",
                };
                const pad = landingPadAtXOrNull(ship.pos.x);
                postMessage("Lift off from " + pad.name + " base");
                ship.stuntMonitor.lastVisitedBaseName = pad.name;
                ship.stuntMonitor.lastTakeOffTimeMs = millis();

                tookOffThisFrame = true;
            }
        }
    }

    if (ship.state.type !== "landed") {
        if (
            keyIsDown(LEFT_ARROW) ||
            keyIsDown(65) //'a' key
        ) {
            ship.desiredFacing -= config.turnSpeed;
        }

        if (
            keyIsDown(RIGHT_ARROW) ||
            keyIsDown(68) //'d' key
        ) {
            ship.desiredFacing += config.turnSpeed;
        }
    }

    ship.facing = lerp(ship.facing, ship.desiredFacing, 0.1);

    if (ship.state.type === "landed") {
        return;
    }

    const gravity = createVector(0, 1).mult(config.gravity);
    if (config.windEnabled) {
        const windSpeed = createWindAt(ship.pos);
        ship.vel.x += windSpeed;
    }
    ship.vel.add(gravity);
    ship.pos.add(ship.vel);

    if (!tookOffThisFrame) {
        const landingCheck = checkIsOkForLanding(ship);

        ship.lastLandingCheck = landingCheck; // for later rendering (e.g. in ILS)

        if (landingCheck.result) {
            setLandedShip(ship);
            return;
        }

        if (isUnderTerrain(ship)) {
            //todo: spawn an explosion at crash site
            spawnExplosion(ship.pos.copy());
            respawnShip();
            world.screenShakeAmt = 1;
            postMessage("cause of crash: " + landingCheck.reason);
        }
    }
}
/**
 * @param {Ship} ship
 */
function drawLastLandingCheckWarning(ship) {
    const lastLandingCheck = ship.lastLandingCheck;
    if (!lastLandingCheck || lastLandingCheck.type !== "warning") {
        return;
    }
    const pad = nearestLandingPad(ship.pos.x);

    if (distanceToLandingPad(pad, ship.pos.x) > pad.width) {
        return;
    }

    push();
    fill(world.palette.all[5]);
    noStroke();
    textSize(12);

    textAlign(CENTER);
    translate(pad.centreX, getHeightAt(pad.centreX) + 60);
    text(lastLandingCheck.reason, 0, 0);
    pop();
}

function fireThrusters() {
    const thrustVec = p5.Vector.fromAngle(world.ship.facing, config.thrust);
    world.ship.vel.add(thrustVec);
    world.ship.fuel -= config.fuelUsedPerTick;
    addParticleEffectsFromThrusters(thrustVec);
}

/**
 * @param {p5.Vector} thrustVec - direction and magnitude of the thrust particle (direction already rotated)
 */
function addParticleEffectsFromThrusters(thrustVec) {
    //Currently the body of the ship gets drawn rotated by -PI/2.  These offsets reflect that.
    const thrusterOffsets = [createVector(-10, 10), createVector(-10, -10)];

    thrusterOffsets.forEach((thrusterOffset) => {
        const rotatedThrustEmitterPos = getRotatedPositionOfOffsetPoint(
            world.ship.pos,
            world.ship.facing,
            thrusterOffset
        );

        world.particles.push(
            createThrustParticle(
                rotatedThrustEmitterPos,
                thrustVec
                    .copy()
                    .rotate(randomGaussian(PI, PI / 20))
                    .setMag(random(1.45, 1.55)),
                world.ship.thrustColour
            )
        );
    });
}

/**
 * Calculates the world-space coordinates of a point on a rotated body,
 * given its local offset from the rotated body's centre.
 * @param {p5.Vector} parentPos The parent's world-space position vector.
 * @param {number} parentRotation The parent body's rotation in radians.
 * @param {p5.Vector} relativePosition The point's local offset from the centre of the parent body
 * @returns {p5.Vector} A new vector representing the point's world-space coordinates after following the body's rotation.
 */
function getRotatedPositionOfOffsetPoint(
    parentPos,
    parentRotation,
    relativePosition
) {
    let rotatedOffset = relativePosition.copy();
    rotatedOffset.rotate(parentRotation);
    return p5.Vector.add(parentPos, rotatedOffset);
}
/**
 * @typedef {Object} World
 
 * @property {Ship} ship - the player's ship
 * @property {Terrain} terrain
 * @property {Explosion[]} explosions
 * @property {ThrustParticle[]} particles
 * @property {WindParticle[]} windParticles
 * @property {Star[]} stars
 * @property {Message[]} messages
 * @property {Palette} palette
 * @property {number} screenShakeAmt - 0 means no screenshake.  diminishes over time.
 * @property {number} moonShadowFraction
 * @property {Cam} cam - for zooming, tracking ship, etc.
 **/

/**
 *
 * @returns {World}
 */
function createWorld() {
    const palette = createPalette();

    /** @type {World} */
    const createdWorld = {
        ship: createShip(palette),
        terrain: createTerrain(palette),
        explosions: [],
        particles: [],
        windParticles: createWindParticles(palette),
        stars: createStarfield(),
        messages: [],
        palette,
        screenShakeAmt: 0,
        moonShadowFraction: random(0.1, 0.5),
        cam: createCam(),
    };

    return createdWorld;
}
/**
 * @typedef {Object} Cam
 * @property {number} desiredScale
 * @property {number} scale
 * @property {boolean} isZooming
 */

/**
 * @returns {Cam}
 */
function createCam() {
    return {
        desiredScale: 1,
        scale: 1,
        isZooming: false,
    };
}
function updateCam() {
    world.cam.desiredScale = world.cam.isZooming ? 2 : 1;

    world.cam.scale = lerp(world.cam.scale, world.cam.desiredScale, 0.1);
}

function calcScaledOffsetForFollowCam() {
    return createVector(width / 2, height / 2)
        .div(world.cam.scale)
        .sub(world.ship.pos);
}
/**
 * @typedef {Object} Explosion
 */

function updateExplosions() {
    world.explosions = world.explosions.filter(
        (exp) => frameCount - exp.startFrame < 30
    );
}

/**
 * @param {Explosion} explosion
 */
function drawExplosion(explosion) {
    push();

    const numPts = random(3, 7);
    beginShape();
    noFill();
    // fill(world.palette.skyBackground);
    colorMode(HSB);
    stroke(random(0, 50), 100, 100, 50);

    for (let i = 0; i < numPts; i++) {
        const radius = map(
            abs(frameCount - explosion.startFrame - 15),
            0,
            30,
            40,
            10,
            true
        );
        const p = p5.Vector.add(
            explosion.pos,
            p5.Vector.random2D().mult(randomGaussian(radius, radius * 0.3))
        );
        vertex(p.x, p.y);
    }
    endShape(CLOSE);
    pop();
}

/**
 *
 * @param {p5.Vector} pos - position at which to spawn explosion
 */
function spawnExplosion(pos) {
    /** @type {Explosion} */
    const explosion = {
        pos: pos.copy(),
        startFrame: frameCount,
    };

    world.explosions.push(explosion);
}
//most from chat gpt - mostly for ideas and inspiration.
// a distorted text-to-speech could say this stuff a bit garbled.
const thematicCommsMessages = {
    preFlight: [
        "All stations, go for launch.",
        "Final systems check, standby for engine ignition.",
        "We have liftoff.",
        "Roger that, we are in the black.",
        "Separation complete, heading to the lunar surface.",
    ],
    inFlight: [
        "Approaching descent phase.",
        "Initiating retro-burn.",
        "We are on final approach.",
        "Stabilizing attitude, adjusting thrust.",
        "Touchdown sequence initiated.",
    ],
    landing: [
        "Altitude: 100 meters.",
        "50 meters, good to go.",
        "We have contact. Roger that, we have contact.",
        "The Eagle has landed.",
        "Mission accomplished. The lunar surface is secure.",
    ],
    errorsAndEmergencies: [
        "Warning: high-speed descent.",
        "We are off course. Correcting vector.",
        "We have a low fuel warning.",
        "Aborting descent, repeat, aborting descent.",
        "Mayday, Mayday. We've lost an engine.",
        "Impact imminent.",
        "Looks like we're out of gas.",
        "I've got a bad feeling about this.",
        "Houston, we have a problem.",
    ],
    routineChecks: [
        "Guidance and navigation, all green.",
        "Propellant quantity reads nominal.",
        "Telemetry data confirms a stable attitude.",
        "System two power levels, checking.",
        "Copy, we have a good lock on the landing site.",
    ],
    procedural: [
        "Switching to manual.",
        "Throttle up one percent.",
        "Initiating burn in T-minus ten seconds.",
        "Burn complete.",
        "Stand by for landing leg deployment.",
    ],
    questionsAndClarifications: [
        "Houston, what's our current velocity?",
        "Confirming on the altitude call.",
        "Say again on that last bit, we had a dropout.",
        "Is that a hard or soft ground reading?",
    ],
    lowStakesCommentary: [
        "Okay, let's see what this thing can do.",
        "Looks like a good spot down there.",
        "Alright, let's bring her home.",
        "It's quieter down here than I expected.",
        "Well, that was a heck of a ride.",
        "I'll be seeing you.",
    ],
};
/** @type {World} */
let world;

/** @type {Config} */
let config;

/** Saved only to allow setting focus once the underlying canvas is ready. Seems necessary for openprocessing. */
let p5Canvas;
/**
 * @param {number} x
 * @param {LandingPad[]} landingPads
 */
function isNearAnyLandingPad(x, landingPads) {
    return landingPads.some((pad) => isWithinLandingPad(x, pad));
}

/**
 * @param {number} x
 */
function landingPadAtXOrNull(x) {
    return (
        world.terrain.landingPads.find((pad) => isWithinLandingPad(x, pad)) ??
        null
    );
}

function nearestLandingPad(x) {
    return minBy(world.terrain.landingPads, (p) => distanceToLandingPad(p, x));
}
/**
 * @param {number} x
 * @param {LandingPad} pad
 */
function distanceToLandingPad(pad, x) {
    return abs(pad.centreX - x);
}
/**
 * @param {number} x
 * @param {LandingPad} pad
 */
function isWithinLandingPad(x, pad) {
    return x >= pad.leftX && x <= pad.leftX + pad.width;
}

/**
 * @typedef {Object} LandingPad
 * @property {number} leftX - world-space x of left-most edge of pad
 * @property {number} width
 * @property {number} centreX - world-space x of centre of pad
 * @property {p5.Color} colour - colour of the base (might be a string or number or Color object)
 * @property {number} fuel - current fuel
 * @property {number} maxFuel
 * @property {string} name
 */

/**
 * @param {Palette} palette
 * @returns {LandingPad[]}
 */
function createLandingPads(palette) {
    /**
     * @returns {LandingPad}
     */
    function createOneLandingPad({ frac, name, colour }) {
        const leftX = snapTo(frac * width, config.xStep);
        const padWidth = config.padWidth;
        const centreX = leftX + padWidth / 2;

        return {
            leftX,
            centreX,
            width: padWidth,
            colour,
            fuel: 4,
            maxFuel: 4,
            name,
        };
    }

    const baseNames = shuffle(
        "Able Baker Charlie Dog Echo Fox Inigo Lima Oscar Patel Reynolds Tango Shiffman Whiskey".split(
            " "
        )
    );
    const colours = shuffle([...palette.bases]);

    const basePositionFractions = random([
        [0.2, 0.8],
        [0.2, 0.4, 0.8],
    ]);
    return zipWith(baseNames, basePositionFractions, (name, frac, ix) =>
        createOneLandingPad({
            name,
            frac,
            colour: colours[ix % colours.length],
        })
    );
}

function drawLandingPadExtras() {
    for (let pad of world.terrain.landingPads) {
        drawLandingPadFuelTank(pad);
        // drawLandingPadFlagAt(pad.leftX);
        // drawLandingPadFlagAt(pad.leftX + pad.width);

        drawLandingPadPlatform(pad);
        drawLandingPadLabel(pad);
    }
}
/**
 * @param {LandingPad} pad
 */
function drawLandingPadLabel(pad) {
    push();
    const x = pad.leftX + pad.width / 2;
    translate(x, getHeightAt(x) + 20);
    textAlign(CENTER, TOP);
    fill("white");
    noStroke();
    textSize(12);
    text(pad.name, 0, 0);
    pop();
}

/**
 * @param {LandingPad} pad
 */
function drawLandingPadPlatform(pad) {
    push();
    translate(pad.leftX, getHeightAt(pad.leftX));
    stroke(pad.colour);
    strokeWeight(3);
    strokeCap(SQUARE);
    // drawingContext.setLineDash([config.xStep, config.xStep]);
    line(0, 0, pad.width, 0);
    // stroke(pad.colour2)
    // line(config.xStep, 0, pad.width, 0)
    pop();
}

/**
 * @param {LandingPad} pad
 */
function drawLandingPadFuelTank(pad) {
    push();
    const w = pad.width / 2.5;
    const h = w / 2;
    const x = pad.leftX + pad.width - w / 2;
    translate(x, getHeightAt(x) - h * 0.5 - 2);
    fill(world.palette.skyBackground);
    stroke(255);
    rectMode(CENTER);
    const cornerRadius = w / 6;
    rect(0, 0, w, h, cornerRadius);
    noStroke();
    fill(255);
    textSize(7);
    textAlign(CENTER, CENTER);
    text("FUEL " + floor(pad.fuel), 0, 0);

    //fuel tank legs
    [-10, 10].map((x) => {
        push();
        fill(150);
        translate(x, h / 2);
        noStroke();
        rectMode(CENTER);
        rect(0, 0, 4, 2);
        pop();
    });
    pop();
}

/**
 * @param {number} x
 */
function drawLandingPadFlagAt(x) {
    const flagHeight = 20;
    const flagWidth = 10;
    push();
    translate(x, getHeightAt(x) - flagHeight);
    stroke("white");
    line(0, 0, 0, flagHeight);
    fill(world.palette.all[0]);
    triangle(0, 0, flagWidth, 5, 0, 10);
    pop();
}

function snapTo(val, increment) {
    return round(val / increment) * increment;
}
/**
 * @typedef {Object} Message
 * @property {string} msg - text of message
 * @property {number} postTime - time message was posted, in milliseconds
 * @property {number} durationMs - duration (in milliseconds) for which the message should be displayed
 */

/**
 * @param {string} str - text of the message
 * @param {number?} durationMs  - duration in milliseconds for the message to be displayed. defaults if not provided.
 */
function postMessage(str, durationMs = 5000) {
    /** @type {Message} */
    const message = {
        msg: str,
        postTime: millis(),
        durationMs,
    };
    world.messages.push(message);
}

function updateMessages() {
    world.messages = world.messages.filter(
        (m) => millis() < m.postTime + m.durationMs
    );
}

function drawMessages() {
    push();
    translate(width - 50, 50);
    for (let m of world.messages) {
        textSize(18);
        textAlign(RIGHT);
        noStroke();
        fill("white");
        // const timePrefix = +" at " + formatMillisecondsToMMSS(m.postTime);
        text(m.msg, 0, 0);
        translate(0, 30);
    }
    pop();
}
/**
 * @param {{all?:boolean}} options - option.all controls whether all messages are posted or just the most fundamental ones.
 */
function postInstructionalMessages({ all } = { all: false }) {
    const coreMessages = [
        "'a' & 'd' or left & right arrows to rotate",
        "'w' or up arrow to thrust",
        "'r' to restart / regenerate",
        "'2' to toggle wind",
        "'z' to toggle zen mode",
        "'h' to get complete help",
    ];

    const otherMessages = [
        "'p' to pause",
        "'1' to toggle janky zoom",
        "'3' to toggle rainbow wind",
        "'4' to toggle stars",
        "'5' to toggle sun as lines",
        "'b' to toggle debug text",
        "'k' to toggle screenshake",
        "'c' to clear messages",
    ];
    const msgs = [...coreMessages, ...(all ? otherMessages : [])];

    postMessagesAtIntervals(msgs);
}

/**
 * @param {string[]} msgs
 */
function postMessagesAtIntervals(msgs) {
    const spacingMs = 1000;
    const duration = 10000;
    let delayMs = 0;
    for (let msg of msgs) {
        postMessageLater(msg, delayMs, duration);
        delayMs += spacingMs;
    }
}

function postMessageLater(str, delay, durationMs) {
    return setTimeout(() => postMessage(str, durationMs), delay);
}

function clearMessages() {
    world.messages = [];
}

function postFlavourMessages() {
    const msgs = [
        "Guidance and navigation, all green",
        "Propellant quantity reads nominal",
        "Telemetry data confirms a stable attitude",
        "Switching to manual",
        "('h' for help)",
    ];
    postMessagesAtIntervals(msgs);
}
/**
 * @typedef {Object} Palette
 * @property {p5.Color[]} all - all loose colours
 * @property {p5.Color[]} bases - brighter colours for use as bases
 * @property {p5.Color} skyBackground
 * @property {p5.Color} landBackground
 */
/**
 *
 * @returns {Palette}
 */
function createPalette() {
    // Kjetil Golid's "Tundra3" https://chromotome-quicker.netlify.app/
    const all = [
        "#87c3ca",
        "#7b7377",
        "#b2475d",
        "#7d3e3e",
        "#eb7f64",
        "#d9c67a",
        "#f3f2f2",
    ].map((str) => color(str));
    return {
        all: all, //the loose colours
        bases: [0, 2, 4, 5].map((ix) => all[ix]),
        skyBackground: color(20),
        landBackground: color(20),
    };
}
function drawOtherMoon() {
    const {
        x,
        y,
        radius: radiusMain,
        colour,
        shadowColour,
    } = defaultOtherMoonData();

    if (!config.drawSunAsLines) {
        push();
        fill(world.palette.skyBackground);
        stroke(colour);
        strokeWeight(1);
        circle(x, round(y), radiusMain * 2);
        pop();
        return;
    }

    push();
    translate(x, round(y));

    //fill in background to obscure stars, etc
    fill(world.palette.skyBackground);
    noStroke();
    circle(0, 0, radiusMain * 2);
    strokeWeight(1);

    const shadowCentreX = -world.moonShadowFraction * radiusMain;
    const shadowRadius = radiusMain;

    const yStep = radiusMain / 5;
    for (
        let yOff = -radiusMain + yStep / 2;
        yOff <= radiusMain;
        yOff += yStep
    ) {
        const chLen = lengthOfCircleChord(radiusMain, yOff);

        const shadowLineLength = lengthOfCircleChord(shadowRadius, yOff);
        const shadowEndX = constrain(
            shadowCentreX + 0.5 * shadowLineLength,
            -chLen / 2,
            chLen / 2
        );
        const shadowStartX = -chLen / 2; //always on LHS of body
        stroke(shadowColour);
        line(shadowStartX, round(yOff), shadowEndX, round(yOff));
        stroke(colour);
        line(shadowEndX, round(yOff), chLen / 2, round(yOff));
    }
    pop();
}

function drawSunWithHorizontalLines() {
    const { x, y, radius, colour } = defaultSunData();
    push();

    translate(x, round(y));
    // to hide whatever's in background (stars, etc)
    noStroke();
    fill(world.palette.skyBackground);
    circle(0, 0, radius * 2);

    stroke(colour);
    strokeWeight(1);
    const yStep = radius / 8;
    for (let yOff = -radius + yStep / 2; yOff <= radius; yOff += yStep) {
        const l = lengthOfCircleChord(radius, yOff);
        line(-l / 2, round(yOff), l / 2, round(yOff));
    }
    pop();
}

function drawSunOutline() {
    const { x, y, radius, colour } = defaultSunData();
    push();
    translate(x, round(y));
    fill(world.palette.skyBackground);
    stroke(colour);
    circle(0, 0, radius * 2);
    pop();
}

function defaultOtherMoonData() {
    const orbitR = min(width, height) / 2;
    const t =
        1.7 * PI +
        -1 *
            map(
                (millis() / 90000) % TWO_PI,
                0,
                TWO_PI,
                0.1 * TWO_PI,
                0.9 * TWO_PI,
                true
            );

    const x = width / 2 + width * 0.4 * sin(t);
    const y = height / 2 + orbitR * cos(t);

    const radius = 60;

    return {
        x,
        y,
        radius,
        colour: world.palette.all[4],
        shadowColour: world.palette.all[3],
    };
}

function defaultSunData() {
    const x = width * 0.6;
    const y = round(getHeightAt(x) + frameCount / 100);
    const radius = 100;
    const colour = world.palette.all[4];
    return { x, y, radius, colour };
}

function lengthOfCircleChord(radius, y) {
    return 2 * sqrt(radius * radius - y * y);
}
function drawStarfield() {
    world.stars.forEach(drawStar);
}

/**
 * @typedef {Object} Star
 * @property {p5.Vector} pos
 * @property {p5.Color} colour
 * @property {number} size
 */

/**
 * @returns {Star[]}
 */
function createStarfield() {
    return collect(100, createStar);
    //todo: prune stars lower than terrain?
}

/**
 * @returns {Star}
 */
function createStar() {
    return {
        colour: color(random() > 0.93 ? random(["skyblue", "pink"]) : "white"),
        size: random(0.4, 1),
        pos: createVector(random(width), random(height)),
    };
}

/**
 * @param {Star} star
 */
function drawStar(star) {
    push();
    stroke(star.colour);
    strokeWeight(1);
    translate(star.pos.x, star.pos.y);
    scale(star.size);
    line(-3, 0, 3, 0);
    line(0, -3, 0, 3);
    pop();
}
/**
 * @typedef {{detail: StuntDetail, timeMs: number}} StuntRecord
 * @typedef {Object} StuntMonitor
 * @property {number} lastFacing
 * @property {StuntRecord[]} log
 * @property {string|undefined} lastVisitedBaseName
 * @property {number|undefined} lastTakeOffTimeMs
 * @property {number|undefined} lowAltitudeStartTimeMs
 */

/**
 *
 * @returns {StuntMonitor}
 */
function createStuntMonitor() {
    return {
        lastFacing: 0,
        log: [],
        lastVisitedBaseName: undefined,
        lastTakeOffTimeMs: undefined,
        lowAltitudeStartTimeMs: undefined,
    };
}
/**
 * @param {Ship} ship
 */
function monitorStunts(ship) {
    if (abs(ship.stuntMonitor.lastFacing - ship.facing) > TWO_PI) {
        awardStunt(ship, { type: "loop" });
        ship.stuntMonitor.lastFacing = ship.facing;
    }
    //low-level flying streak
    const lowAltitudeThreshold = 40;
    if (
        calcGroundClearance(ship) < lowAltitudeThreshold &&
        abs(ship.vel.x) > 0.4 && //don't give it for hovering
        xDistanceToEdgeOfNearestLandingPad(ship.pos.x) > 20 //don't give this away just for landing!
    ) {
        if (ship.stuntMonitor.lowAltitudeStartTimeMs === undefined) {
            ship.stuntMonitor.lowAltitudeStartTimeMs = millis();
        }
        //check for possible long-low-altitude award
        const duration = millis() - ship.stuntMonitor.lowAltitudeStartTimeMs;
        //TODO: change this to the amount of distance covered in low altitude - that rewards fast passes more.
        if (duration > 3000) {
            awardStunt(ship, {
                type: "low-altitude",
                extra: (duration / 1000).toFixed(1) + "s",
            });
            ship.stuntMonitor.lowAltitudeStartTimeMs = undefined;
            //todo: don't clear this tracker but mark this duration awarded, allowing longer runs to be awarded too on same run.
        }
    } else {
        ship.stuntMonitor.lowAltitudeStartTimeMs = undefined;
    }
}

/**
 *
 * @param {number} x
 * @returns  horizontal distance from the given x position to the nearest edge of the nearest landing pad. Elevation is not considered.
 */
function xDistanceToEdgeOfNearestLandingPad(x) {
    const pad = nearestLandingPad(x);
    return max(0, abs(x - pad.centreX) - pad.width / 2);
}
/**
 * @param {Ship} ship
 */
function clearStunts(ship) {
    ship.stuntMonitor.lastFacing = ship.facing;
    ship.stuntMonitor.log = [];
    ship.stuntMonitor.lastTakeOffTimeMs = undefined;
    ship.stuntMonitor.lastVisitedBaseName = undefined;
    ship.stuntMonitor.lowAltitudeStartTimeMs = undefined;
}

/**
 * @typedef {Object} StuntDetail
 * @property {"loop" |"fast-transfer"|"low-altitude"} type
 * @property {string} [extra]
 *
 * @param {Ship} ship - ship that performed the stunt
 * @param {StuntDetail} detail
 */
function awardStunt(ship, detail) {
    ship.stuntMonitor.log.push({ detail: detail, timeMs: millis() });
    const extraOrNothing = detail.extra ? ` (${detail.extra})` : "";
    postMessage(`${detail.type}${extraOrNothing}!`);
}

/**
 * If we have flown from one base to another (without crashing), post flight time, and possibly log fast-transfer "stunt".
 * @param {Ship} ship
 * @param {LandingPad} pad
 */
function processAnyBaseToBaseFlightTime(ship, pad) {
    if (
        ship.stuntMonitor.lastVisitedBaseName !== undefined &&
        pad.name !== ship.stuntMonitor.lastVisitedBaseName
    ) {
        const timeSinceTakeOff = millis() - ship.stuntMonitor.lastTakeOffTimeMs;
        const timeStr = (timeSinceTakeOff / 1000).toFixed(3) + "s";
        postMessage("Flight time: " + timeStr);

        if (timeSinceTakeOff < 10000) {
            const medalType = timeSinceTakeOff < 5000 ? "GOLD" : "Silver";
            awardStunt(ship, {
                type: "fast-transfer",
                extra: timeStr + " " + medalType,
            });
        }
    }
}
/**
 *
 * @param {number} x - x co-ordinate at which ground level should be found
 * @returns {number} - y co-ordinate of ground (in world-space) at given x position
 */
function getHeightAt(x) {
    const points = world.terrain.points;
    const ptAfter = points.find((pt) => pt.x > x);
    const ptBefore = [...points].reverse().find((pt) => pt.x <= x);
    if (!ptAfter) {
        return ptBefore.y;
    }
    if (!ptBefore) {
        return ptAfter.y;
    }
    return map(x, ptBefore.x, ptAfter.x, ptBefore.y, ptAfter.y, true);
}

/**
 * @param {Ship} ship
 * @returns {boolean}
 */
function isUnderTerrain(ship) {
    const clearance = calcGroundClearance(ship);
    return clearance < -5;
}

/**
 * @typedef {Object} Terrain
 * @property {p5.Vector[]} points - an array of world-space positions outlining the terrain
 * @property {LandingPad[]} landingPads
 */

/**
 *
 * @param {Palette} palette
 * @returns {Terrain}
 */
function createTerrain(palette) {
    const landingPads = createLandingPads(palette);
    const pts = [];
    let prevY = null;
    for (let x = -config.xStep; x < width + config.xStep; x += config.xStep) {
        const noiseY = map(
            noise(2000 + x / 300),
            0.15,
            0.85,
            height * 0.9,
            height * 0.3
        );
        let y = noiseY;
        const nearPad = isNearAnyLandingPad(x, landingPads);
        if (nearPad) {
            y = prevY;
        } else {
            prevY = y;
        }
        const pt = createVector(x, y);
        pts.push(pt);
    }

    return {
        points: pts,
        landingPads,
    };
}

function drawTerrain() {
    push();
    strokeCap(SQUARE);
    strokeWeight(1);
    fill(world.palette.landBackground);
    stroke(world.palette.all[6]);

    beginShape();
    for (let pt of world.terrain.points) {
        vertex(pt.x, pt.y);
    }
    vertex(width + 50, height + 50);
    vertex(-50, height + 50);
    endShape(CLOSE);
    pop();

    drawLandingPadExtras();
}
function updateParticles() {
    world.particles.forEach(updateParticle);
    world.particles = world.particles.filter((p) => !p.isDead);
}

function drawThrustParticles() {
    world.particles.forEach(drawThrustParticle);
}
/**
 *
 * @param {ThrustParticle} p
 */
function drawThrustParticle(p) {
    push();
    stroke(p.colour); //all[2] is vibrant
    translate(p.pos.x, p.pos.y);
    //perpendicular to direction of movement
    rotate(p.vel.heading() + PI / 2);
    //line gets bigger with particle age, up to a limit
    const ageScaling = map(frameCount - p.startFrame, 0, 30, 1, 4, true);
    line(-ageScaling * p.size, 0, ageScaling * p.size, 0);
    pop();
}

/**
 *
 * @param {ThrustParticle} p
 */
function updateParticle(p) {
    p.pos.add(p.vel);

    if (getHeightAt(p.pos.x) < p.pos.y) {
        p.isDead = true;
    }
    if (frameCount - p.startFrame > p.maxAge) {
        p.isDead = true;
    }
}
/**
 * @typedef {Object} ThrustParticle
 * @property {p5.Vector} pos
 * @property {p5.Vector} vel
 * @property {boolean} isDead
 * @property {number} startFrame
 * @property {number} maxAge
 * @property {p5.Color} colour
 * @property {number} size
 */

/**
 * @param {p5.Vector} pos
 * @param {p5.Vector} vel
 * @param {p5.Color} colour
 * @returns {ThrustParticle}
 */
function createThrustParticle(pos, vel, colour) {
    return {
        pos: pos.copy(),
        vel: vel.copy(),
        isDead: false,
        startFrame: frameCount,
        maxAge: random(60, 120),
        colour,
        size: random([1, 2]),
    };
}
/**
 * Return the minimum element in the given input array as evaluated by the given function.
 * @template A
 * @param {A[]} arr
 * @param {function(A): number} evalByFn - function to use to extract a value from each element in turn for comparison with < operator.
 * @returns {A|undefined} - the element from the input arr which yielded the least value when passed through evalByFn.  Or undefined if the array is empty or undefined.
 */
function minBy(arr, evalByFn) {
    if (!arr || arr.length === 0) {
        return undefined;
    }
    let minVal = Infinity;
    let minElement = undefined;
    for (const candidateElement of arr) {
        const val = evalByFn(candidateElement);
        if (val < minVal) {
            minVal = val;
            minElement = candidateElement;
        }
    }
    return minElement;
}

/**
 * Creates an array by running a function a specified number of times.
 *
 * @template T
 * @param {number} n The number of times to run the function.
 * @param {function(number): T} fn The function to run for each iteration. It receives the current index as an argument and should return the value to be added to the array.
 * @returns {Array<T>} An array containing the values returned by the function.
 */
function collect(n, fn) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        arr.push(fn(i));
    }
    return arr;
}

/**
 * @template A, B, C
 * @param {A[]} arrA
 * @param {B[]} arrB
 * @param {function(A, B, number): C} joinFn - function to use to combine each pair of elements from arrA and arrB.  Must return an element of final type C, which will be stored in the output array.
 * @returns {C[]} - the collected array of new result elements after calling joinFn on each pair.
 */
function zipWith(arrA, arrB, joinFn) {
    const outputs = [];
    const shorterLen = min(arrA.length, arrB.length);
    for (let ix = 0; ix < shorterLen; ix++) {
        const newElem = joinFn(arrA[ix], arrB[ix], ix);
        outputs.push(newElem);
    }
    return outputs;
}

function formatMillisecondsToMMSS(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (val) => val.toString().padStart(2, "0");
    return [minutes, seconds].map(pad).join(":");
}
/**
 * @param {Palette} palette
 * @returns {WindParticle[]}
 */
function createWindParticles(palette) {
    return collect(config.numWindParticles, () => createWindParticle(palette));
}

/**
 * @typedef {Object} WindParticle
 * @property {p5.Vector} pos
 * @property {number} size
 * @property {p5.Color} colour - used when not in rainbow mode
 * @property {p5.Color} rainbowColour - used in rainbow mode
 */
/**
 * @param {Palette} palette
 * @returns {WindParticle}
 */
function createWindParticle(palette) {
    const pos = createVector(random(width), random(height));

    return {
        pos,
        size: 1,
        colour: generateSubtleWindColour(),
        rainbowColour: random(palette.bases),
    };
}

function generateSubtleWindColour() {
    return color(random([150, 100]));
}
/**
 * @param {WindParticle} p
 */
function drawWindParticle(p) {
    const strength = createWindAt(p.pos);
    if (strength === 0) {
        return;
    }
    push();
    stroke(config.rainbowWindEnabled ? p.rainbowColour : p.colour);
    strokeWeight(p.size);
    translate(p.pos.x, p.pos.y);
    line(0, 0, strength * 3000, 0);
    pop();
}

/**
 * @param {p5.Vector} pos
 * @returns {number} - x component of the wind.  For now wind has no y component.
 */
function createWindAt(pos) {
    if (!config.windEnabled) {
        return 0;
    }
    const MAX_WIND_SPEED = 0.01;
    const noiseAtPos = noise(
        5000 + pos.x / 1000,
        3000 + pos.y / 100,
        frameCount / 500
    );
    const centredNoise = map(noiseAtPos, 0.1, 0.9, -1, 1, true);
    if (abs(centredNoise) < 0.2) {
        return 0;
    }
    const speed = MAX_WIND_SPEED * centredNoise;
    return speed;
}

function drawWind() {
    world.windParticles.forEach(drawWindParticle);
}

/**
 *
 * @param {WindParticle} p
 */
function updateWindParticle(p) {
    const xVel = createWindAt(p.pos) * 100;
    p.pos.x += xVel;

    if (p.pos.x < -20 || p.pos.x > width + 20) {
        p.pos.x = random(width);
    }
}
function drawBall(b) {
    push();
    noFill();
    stroke(255);
    circle(b.position.x, b.position.y, 2 * b.circleRadius);

    pop();
}

function isFrameRateSlow(expectedRate, tolerance) {
    return frameRate() < expectedRate * (1 - tolerance);
}

function keyPressed() {
    //See also: ship controls ('a', 'd', 'w', and arrow keys) processed in updateShip

    if (key === "r") {
        restart();
    }
    if (key === "p") {
        togglePause();
    }

    if (key === "h" || key === "?") {
        postInstructionalMessages({ all: true });
    }

    if (key === "b") {
        toggleConfigBoolean("debugMessagesEnabled", "debug messages");
    }

    if (key === "c") {
        clearMessages();
    }

    if (key === "k") {
        toggleConfigBoolean("screenShakeEnabled", "screen-shake");
    }

    if (key === "1") {
        toggleZoom();
    }
    if (key === "2") {
        toggleConfigBoolean("windEnabled", "wind");
    }

    if (key === "3") {
        toggleConfigBoolean("rainbowWindEnabled", "rainbow-wind");
    }

    if (key === "4") {
        toggleConfigBoolean("starsEnabled", "stars");
    }

    if (key === "5") {
        toggleConfigBoolean("drawSunAsLines", "draw sun as lines");
    }

    if (key === "0" || key === "z") {
        toggleZenMode();
    }

    if (key === "e") {
        console.log({ seed: config.seed });
    }

    if (key === "x") {
        cheatSetShipForEasyLanding(world.ship);
    }

    if (key === "q") {
        save("lunar-lander-screenshot");
    }
}

function toggleZoom() {
    world.cam.isZooming = !world.cam.isZooming;
}

function zenModePropertyKeys() {
    return ["windEnabled", "debugMessagesEnabled", "starsEnabled"];
}

function saveConfigForZenMode() {
    const backup = [];
    for (let key of zenModePropertyKeys()) {
        backup[key] = config[key];
    }
    return backup;
}

function toggleZenMode() {
    config.zenModeEnabled = !config.zenModeEnabled;
    if (config.zenModeEnabled) {
        config.zenModeBackup = saveConfigForZenMode();
        let delay = 0;
        for (let key of zenModePropertyKeys()) {
            setTimeout(() => (config[key] = false), delay);
            delay += 500;
        }
        setTimeout(clearMessages, delay);
    } else {
        restoreConfigAfterZenMode();
    }
}

function restoreConfigAfterZenMode() {
    let delay = 0;
    for (let key of [...zenModePropertyKeys()].reverse()) {
        const savedVal = config.zenModeBackup[key];
        if (savedVal !== undefined) {
            setTimeout(() => (config[key] = savedVal), delay);
            delay += 500;
        }
    }
}

function toggleConfigBoolean(key, label) {
    config[key] = !config[key];
    const desc = config[key] ? "enabled" : "disabled";
    postMessage(label + " " + desc);
}

function applyAnyScreenShake() {
    const angleSpeed = 0.05;
    const magSpeed = angleSpeed * 2;
    const maxDisplacement = 6;

    const angle = map(
        noise(frameCount * angleSpeed),
        0.1,
        0.9,
        0,
        TWO_PI * 2,
        true
    );
    const mag =
        map(noise(2000 + frameCount * magSpeed), 0.1, 0.9, -1, 1, true) *
        maxDisplacement *
        world.screenShakeAmt;
    const offset = p5.Vector.fromAngle(angle, mag);
    translate(offset.x, offset.y);
}
function updateAnyScreenShake() {
    world.screenShakeAmt = constrain(world.screenShakeAmt - 0.01, 0, 1);
}

function togglePause() {
    if (isLooping()) {
        noLoop();
    } else {
        loop();
    }
}

function focusCanvasOnce() {
    //Only for openprocessing, doing this on earlier frames doesn't reliably work -
    // perhaps it's taking the focus away when loading the sketch?
    if (frameCount === 30) {
        p5Canvas.elt.focus();
    }
}
