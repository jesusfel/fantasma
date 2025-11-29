const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let player;
let cursors;
let ghosts;
let netHitbox;
let hearts = 3;
let score = 0;
let ghostsCaughtForHeal = 0;
let lastFired = 0;
let isGameOver = true;
let spawnTimer;
let heartGroup;
let scoreText;
let flashlight; // New flashlight sprite
let baseGhostSpeed = 50; // Base speed

// Touch controls
let touchJoystick = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };
let joystickGraphics = null;
let isMobile = false;

const game = new Phaser.Game(config);

function preload() {
    // No external assets to load, we will generate them in create
}

function create() {
    // --- Asset Generation ---
    createAssets(this);

    // --- World Setup ---
    // Background
    this.add.image(400, 300, 'bg');

    // Doors and Windows (Visuals & Spawn Points)
    this.spawnLocations = [
        { x: 100, y: 50, type: 'window' },
        { x: 400, y: 50, type: 'door' },
        { x: 700, y: 50, type: 'window' },
        { x: 100, y: 550, type: 'door' }, // Bottom doors
        { x: 700, y: 550, type: 'door' }
    ];

    this.spawnLocations.forEach(loc => {
        this.add.image(loc.x, loc.y, loc.type);
    });

    // --- Player ---
    player = this.physics.add.sprite(400, 300, 'player');
    player.setCollideWorldBounds(true);
    player.setDepth(10);

    // Flashlight (Visual only)
    flashlight = this.add.image(400, 300, 'flashlight');
    flashlight.setDepth(20);
    flashlight.setBlendMode(Phaser.BlendModes.ADD);
    flashlight.setAlpha(0.6);

    // Net Hitbox (invisible initially)
    netHitbox = this.physics.add.sprite(0, 0, 'net');
    netHitbox.setVisible(false);
    netHitbox.setActive(false);

    // --- Ghosts ---
    ghosts = this.physics.add.group();

    // --- UI ---
    createUI(this);

    // --- Inputs ---
    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', attack, this);

    // Detect mobile
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Touch controls
    if (isMobile) {
        // Create joystick graphics
        joystickGraphics = this.add.graphics();
        joystickGraphics.setDepth(100);
        joystickGraphics.setAlpha(0.6);
    }

    // Touch input for movement (joystick)
    this.input.on('pointerdown', (pointer) => {
        if (isGameOver) return;

        // Left side = joystick, Right side = attack
        if (pointer.x < 400) {
            touchJoystick.active = true;
            touchJoystick.startX = pointer.x;
            touchJoystick.startY = pointer.y;
            touchJoystick.currentX = pointer.x;
            touchJoystick.currentY = pointer.y;
        } else {
            // Attack on right side tap
            attack.call(this);
        }
    });

    this.input.on('pointermove', (pointer) => {
        if (touchJoystick.active) {
            touchJoystick.currentX = pointer.x;
            touchJoystick.currentY = pointer.y;
        }
    });

    this.input.on('pointerup', (pointer) => {
        if (touchJoystick.active) {
            touchJoystick.active = false;
            if (joystickGraphics) {
                joystickGraphics.clear();
            }
        }
    });

    // --- Spawning ---
    spawnTimer = this.time.addEvent({
        delay: 2000,
        callback: spawnGhost,
        callbackScope: this,
        loop: true
    });

    // --- Collisions ---
    this.physics.add.overlap(netHitbox, ghosts, catchGhost, null, this);
    this.physics.add.overlap(player, ghosts, hitPlayer, null, this);

    // Start Button Logic
    const startBtn = document.getElementById('start-btn');
    const instructions = document.getElementById('instructions');

    // Pause physics and timer initially
    this.physics.pause();
    spawnTimer.paused = true;
    isGameOver = true; // Prevent update loop from running logic

    startBtn.onclick = () => {
        instructions.classList.add('hidden');

        // Initialize Audio (with error handling for mobile)
        try {
            SoundSystem.init();
            SoundSystem.startMusic();
        } catch (e) {
            console.log('Audio initialization failed (this is normal on some mobile browsers):', e);
        }

        this.physics.resume();
        spawnTimer.paused = false;
        isGameOver = false;
        resetGame(this);
    };
}

function update(time, delta) {
    if (isGameOver) return;

    // Player Movement
    const speed = 200;
    player.setVelocity(0);

    // Keyboard controls
    if (cursors.left.isDown) {
        player.setVelocityX(-speed);
        player.setFlipX(true);
    } else if (cursors.right.isDown) {
        player.setVelocityX(speed);
        player.setFlipX(false);
    }

    if (cursors.up.isDown) {
        player.setVelocityY(-speed);
    } else if (cursors.down.isDown) {
        player.setVelocityY(speed);
    }

    // Touch joystick controls
    if (touchJoystick.active) {
        const deltaX = touchJoystick.currentX - touchJoystick.startX;
        const deltaY = touchJoystick.currentY - touchJoystick.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > 10) {
            const normalizedX = deltaX / distance;
            const normalizedY = deltaY / distance;

            player.setVelocityX(normalizedX * speed);
            player.setVelocityY(normalizedY * speed);

            player.setFlipX(normalizedX < 0);
        }

        // Draw joystick
        if (joystickGraphics) {
            joystickGraphics.clear();

            // Base circle
            joystickGraphics.lineStyle(3, 0xffffff, 0.5);
            joystickGraphics.strokeCircle(touchJoystick.startX, touchJoystick.startY, 50);

            // Stick
            const maxDist = 50;
            const clampedDist = Math.min(distance, maxDist);
            const stickX = touchJoystick.startX + (deltaX / distance) * clampedDist;
            const stickY = touchJoystick.startY + (deltaY / distance) * clampedDist;

            joystickGraphics.fillStyle(0xffffff, 0.7);
            joystickGraphics.fillCircle(stickX, stickY, 25);
        }
    }

    // Flashlight follows player
    flashlight.setPosition(player.x, player.y);

    // Rotate flashlight based on movement
    if (player.body.velocity.x !== 0 || player.body.velocity.y !== 0) {
        let angle = Math.atan2(player.body.velocity.y, player.body.velocity.x);
        flashlight.setRotation(angle);
    } else {
        // Default direction based on flip
        flashlight.setRotation(player.flipX ? Math.PI : 0);
    }

    // Move Net with Player (aligned with Flashlight)
    if (netHitbox.active) {
        const angle = flashlight.rotation;
        const distance = 40;
        netHitbox.setPosition(
            player.x + Math.cos(angle) * distance,
            player.y + Math.sin(angle) * distance
        );
        netHitbox.setRotation(angle);
    }

    // Ghost Logic
    ghosts.children.iterate((ghost) => {
        if (ghost) {
            this.physics.moveToObject(ghost, player, ghost.currentSpeed);
            // Flip ghost to face player
            ghost.setFlipX(player.x < ghost.x);
        }
    });
}

function createAssets(scene) {
    const graphics = scene.make.graphics();

    // 1. Background Texture (More detail)
    // Floor with gradient
    const floorColor = 0x1a0b2e;
    graphics.fillStyle(floorColor, 1);
    graphics.fillRect(0, 0, 800, 600);

    // Wood planks pattern
    graphics.lineStyle(2, 0x000000, 0.2);
    for (let i = 0; i < 800; i += 60) {
        graphics.moveTo(i, 0);
        graphics.lineTo(i, 600);
    }
    // Horizontal random lines for planks
    for (let i = 0; i < 600; i += 20) {
        for (let j = 0; j < 800; j += 60) {
            if (Math.random() > 0.5) {
                graphics.moveTo(j, i);
                graphics.lineTo(j + 60, i);
            }
        }
    }
    graphics.generateTexture('bg', 800, 600);
    graphics.clear();

    // 2. Player Texture (3D style gradients)
    // We need to use canvas context for gradients as Phaser graphics doesn't support them easily for textures
    const playerCanvas = scene.textures.createCanvas('player', 32, 48);
    const pCtx = playerCanvas.context;

    // Body (Blue Overalls)
    let grd = pCtx.createLinearGradient(0, 20, 32, 20);
    grd.addColorStop(0, '#000088');
    grd.addColorStop(0.5, '#0000ff');
    grd.addColorStop(1, '#000088');
    pCtx.fillStyle = grd;
    pCtx.fillRect(6, 20, 20, 20);

    // Head (Skin)
    grd = pCtx.createRadialGradient(16, 18, 2, 16, 18, 8);
    grd.addColorStop(0, '#ffeebb');
    grd.addColorStop(1, '#ffccaa');
    pCtx.fillStyle = grd;
    pCtx.beginPath(); pCtx.arc(16, 18, 8, 0, Math.PI * 2); pCtx.fill();

    // Hat (Green)
    grd = pCtx.createRadialGradient(16, 8, 2, 16, 10, 10);
    grd.addColorStop(0, '#00cc00');
    grd.addColorStop(1, '#006600');
    pCtx.fillStyle = grd;
    pCtx.beginPath(); pCtx.arc(16, 10, 10, 0, Math.PI * 2); pCtx.fill();
    // Brim
    pCtx.fillStyle = '#006600';
    pCtx.fillRect(6, 12, 20, 4);

    playerCanvas.refresh();

    // 3. Ghost Texture (White base for tinting, with 3D shading)
    const ghostCanvas = scene.textures.createCanvas('ghost', 32, 32);
    const gCtx = ghostCanvas.context;

    // Body Gradient (White to Transparent)
    grd = gCtx.createRadialGradient(16, 16, 2, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grd.addColorStop(0.8, 'rgba(220, 220, 220, 0.8)');
    grd.addColorStop(1, 'rgba(200, 200, 200, 0)');
    gCtx.fillStyle = grd;

    gCtx.beginPath();
    gCtx.moveTo(0, 32);
    gCtx.lineTo(0, 10);
    gCtx.arc(16, 10, 16, Math.PI, 0, false);
    gCtx.lineTo(32, 32);
    gCtx.lineTo(24, 24);
    gCtx.lineTo(16, 32);
    gCtx.lineTo(8, 24);
    gCtx.lineTo(0, 32);
    gCtx.fill();

    // Eyes (Glowing)
    gCtx.fillStyle = '#ffff00';
    gCtx.shadowColor = '#ffff00';
    gCtx.shadowBlur = 5;
    gCtx.beginPath(); gCtx.arc(10, 12, 3, 0, Math.PI * 2); gCtx.fill();
    gCtx.beginPath(); gCtx.arc(22, 12, 3, 0, Math.PI * 2); gCtx.fill();
    gCtx.shadowBlur = 0;

    ghostCanvas.refresh();

    // 4. Door Texture (Detailed Wood)
    graphics.fillStyle(0x3e2723, 1);
    graphics.fillRect(0, 0, 60, 80);
    // Panels
    graphics.fillStyle(0x281a14, 1);
    graphics.fillRect(5, 5, 22, 30);
    graphics.fillRect(33, 5, 22, 30);
    graphics.fillRect(5, 45, 22, 30);
    graphics.fillRect(33, 45, 22, 30);
    // Knob
    graphics.fillStyle(0xffd700, 1);
    graphics.fillCircle(52, 40, 4);
    graphics.generateTexture('door', 60, 80);
    graphics.clear();

    // 5. Window Texture (Glowing)
    graphics.fillStyle(0x222222, 1);
    graphics.fillRect(0, 0, 50, 70);
    graphics.fillStyle(0x4444ff, 0.3); // Moon glow
    graphics.fillRect(5, 5, 40, 60);
    graphics.lineStyle(2, 0x222222, 1);
    graphics.moveTo(25, 5); graphics.lineTo(25, 65);
    graphics.moveTo(5, 35); graphics.lineTo(45, 35);
    graphics.generateTexture('window', 50, 70);
    graphics.clear();

    // 6. Net Texture (Swing effect)
    graphics.fillStyle(0xffffff, 0.5);
    // Draw facing Right (0 degrees) so rotation works correctly
    graphics.slice(25, 25, 25, Phaser.Math.DegToRad(315), Phaser.Math.DegToRad(45), false);
    graphics.fillPath();
    graphics.generateTexture('net', 50, 50);
    graphics.clear();

    // 7. Heart Texture
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(10, 10, 10);
    graphics.fillCircle(30, 10, 10);
    graphics.beginPath();
    graphics.moveTo(0, 10);
    graphics.lineTo(20, 35);
    graphics.lineTo(40, 10);
    graphics.fillPath();
    graphics.generateTexture('heart', 40, 40);
    graphics.clear();

    // 8. Flashlight Beam Texture
    const beamCanvas = scene.textures.createCanvas('flashlight', 200, 200);
    const bCtx = beamCanvas.context;
    // Cone gradient
    grd = bCtx.createRadialGradient(100, 100, 0, 100, 100, 100);
    grd.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
    grd.addColorStop(1, 'rgba(255, 255, 200, 0)');
    bCtx.fillStyle = grd;
    bCtx.beginPath();
    bCtx.moveTo(100, 100);
    bCtx.arc(100, 100, 100, -Math.PI / 6, Math.PI / 6);
    bCtx.fill();
    beamCanvas.refresh();
}

function createUI(scene) {
    // Hearts
    heartGroup = scene.add.group();
    updateHearts(scene);

    // Score
    scoreText = scene.add.text(16, 50, 'Fantasmas: 0', { fontSize: '24px', fill: '#fff' });
}

function updateHearts(scene) {
    heartGroup.clear(true, true);
    for (let i = 0; i < hearts; i++) {
        const heart = scene.add.image(30 + (i * 40), 30, 'heart');
        heart.setScale(0.5);
        heartGroup.add(heart);
    }
}

function spawnGhost() {
    if (isGameOver) return;

    // Pick random spawn point from the dynamic list
    const loc = Phaser.Utils.Array.GetRandom(this.spawnLocations);

    const ghost = ghosts.create(loc.x, loc.y, 'ghost');
    ghost.setCollideWorldBounds(true);
    ghost.setBounce(1);

    // Random Color Tint
    const colors = [0xffaaaa, 0xaaffaa, 0xaaaaff, 0xffffaa, 0xffaaff];
    ghost.setTint(Phaser.Utils.Array.GetRandom(colors));

    // Progressive Difficulty: Speed increases with score
    const difficultyMultiplier = 1 + (score * 0.05); // 5% faster per capture
    const speed = Phaser.Math.Between(40, 80) * difficultyMultiplier;
    ghost.currentSpeed = speed; // Store speed on ghost object

    // Initial velocity towards center to get them out of the wall
    this.physics.moveTo(ghost, 400, 300, speed);
}

function attack() {
    if (isGameOver || netHitbox.active) return;

    netHitbox.setActive(true);
    netHitbox.setVisible(true);

    // Play swing animation (tween)
    this.tweens.add({
        targets: netHitbox,
        alpha: { from: 1, to: 0 },
        duration: 200,
        onComplete: () => {
            netHitbox.setActive(false);
            netHitbox.setVisible(false);
            netHitbox.setAlpha(1);
        }
    });
}

function catchGhost(net, ghost) {
    if (net.active) {
        // Create a particle effect or simple fade out
        this.tweens.add({
            targets: ghost,
            scale: 0,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                ghost.destroy();
            }
        });

        // Disable physics body immediately so it doesn't hurt player while dying
        ghost.body.enable = false;

        SoundSystem.playCatch();

        score++;
        ghostsCaughtForHeal++;
        scoreText.setText('Fantasmas: ' + score);

        // New Spawn Point every 20 ghosts
        if (score > 0 && score % 20 === 0) {
            addNewSpawnPoint(this);
        }

        // Heal mechanic
        if (ghostsCaughtForHeal >= 5) {
            if (hearts < 3) {
                hearts++;
                updateHearts(this);
                SoundSystem.playHeal();
                // Visual feedback for heal
                this.cameras.main.flash(200, 0, 255, 0);
            }
            ghostsCaughtForHeal = 0;
        }
    }
}

function hitPlayer(player, ghost) {
    if (isGameOver) return;

    // If ghost is dying, ignore
    if (!ghost.body.enable) return;

    // Damage logic
    hearts--;
    updateHearts(this);
    SoundSystem.playHurt();

    // Camera shake
    this.cameras.main.shake(200, 0.01);

    // Destroy ghost that hit you
    ghost.destroy();

    if (hearts <= 0) {
        gameOver(this);
    }
}

function gameOver(scene) {
    isGameOver = true;
    SoundSystem.stopMusic();
    SoundSystem.playGameOver();
    scene.physics.pause();
    spawnTimer.paused = true;
    player.setTint(0xff0000);

    const instructions = document.getElementById('instructions');
    const h2 = instructions.querySelector('h2');
    const p = instructions.querySelectorAll('p');
    const btn = document.getElementById('start-btn');

    h2.innerText = "¡Juego Terminado!";
    p[0].innerText = "Puntuación Final: " + score;
    p[1].innerText = "";
    p[2].innerText = "¿Intentar de nuevo?";
    btn.innerText = "Reiniciar";

    instructions.classList.remove('hidden');
}

function addNewSpawnPoint(scene) {
    // Determine random wall
    const wall = Phaser.Math.Between(0, 3); // 0: Top, 1: Bottom, 2: Left, 3: Right
    let x, y, angle = 0;

    switch (wall) {
        case 0: // Top
            x = Phaser.Math.Between(50, 750);
            y = 50;
            break;
        case 1: // Bottom
            x = Phaser.Math.Between(50, 750);
            y = 550;
            break;
        case 2: // Left
            x = 50;
            y = Phaser.Math.Between(50, 550);
            angle = 90;
            break;
        case 3: // Right
            x = 750;
            y = Phaser.Math.Between(50, 550);
            angle = -90;
            break;
    }

    const type = Math.random() > 0.5 ? 'door' : 'window';
    const newLoc = { x: x, y: y, type: type };

    // Visual
    const img = scene.add.image(x, y, type);
    if (angle !== 0) img.setAngle(angle);

    // Fade in effect
    img.setAlpha(0);
    scene.tweens.add({
        targets: img,
        alpha: 1,
        duration: 1000
    });

    // Add to spawn list
    scene.spawnLocations.push(newLoc);

    // Notification
    const text = scene.add.text(400, 300, '¡NUEVA ENTRADA!', {
        fontSize: '40px',
        fill: '#ff0000',
        stroke: '#fff',
        strokeThickness: 4
    });
    text.setOrigin(0.5);
    scene.tweens.add({
        targets: text,
        scale: { from: 0.5, to: 1.5 },
        alpha: { from: 1, to: 0 },
        duration: 2000,
        onComplete: () => text.destroy()
    });
}

function resetGame(scene) {
    hearts = 3;
    score = 0;
    ghostsCaughtForHeal = 0;

    updateHearts(scene);
    scoreText.setText('Fantasmas: 0');

    ghosts.clear(true, true);
    player.clearTint();
    player.setPosition(400, 300);

    // Reset flashlight
    if (flashlight) {
        flashlight.setPosition(400, 300);
        flashlight.setRotation(0);
    }
}

// --- Sound System (Web Audio API) ---
const SoundSystem = {
    ctx: null,
    musicInterval: null,

    init: function () {
        try {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        } catch (e) {
            console.warn('Web Audio API not available:', e);
            this.ctx = null;
        }
    },

    playTone: function (freq, type, duration, vol = 0.1, slideTo = null) {
        if (!this.ctx) return; // Safety check
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playCatch: function () {
        // High magic sparkle
        this.playTone(800, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(1200, 'sine', 0.2, 0.1), 50);
        setTimeout(() => this.playTone(1800, 'square', 0.1, 0.05), 100);
    },

    playHurt: function () {
        // Low crunch
        this.playTone(150, 'sawtooth', 0.3, 0.2, 50);
        this.playTone(100, 'square', 0.2, 0.2, 20);
    },

    playHeal: function () {
        // Major arpeggio
        this.playTone(440, 'sine', 0.4, 0.1); // A4
        setTimeout(() => this.playTone(554, 'sine', 0.4, 0.1), 100); // C#5
        setTimeout(() => this.playTone(659, 'sine', 0.6, 0.1), 200); // E5
    },

    playGameOver: function () {
        // Sad slide down
        this.playTone(400, 'triangle', 1.5, 0.2, 50);
        setTimeout(() => this.playTone(300, 'triangle', 1.5, 0.2, 40), 500);
    },

    startMusic: function () {
        if (this.musicInterval) clearInterval(this.musicInterval);

        let step = 0;
        const bassLine = [110, 110, 130, 123, 98, 98, 87, 82]; // Spooky bass notes

        const playNote = () => {
            if (isGameOver) return;
            const freq = bassLine[step % bassLine.length];
            // Bass
            this.playTone(freq, 'triangle', 0.4, 0.15);
            // Random creepy high note
            if (Math.random() > 0.8) {
                this.playTone(Phaser.Math.Between(800, 1200), 'sine', 0.5, 0.02);
            }
            step++;
        };

        playNote();
        this.musicInterval = setInterval(playNote, 600); // 100 BPM approx
    },

    stopMusic: function () {
        if (this.musicInterval) clearInterval(this.musicInterval);
    }
};
