const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const dinoImg = new Image();
dinoImg.src = 'dino.png'; // Replace with your dino PNG file
const treeImg = new Image();
treeImg.src = 'tree.png'; // Replace with your tree PNG file

let startTime; // To track game start time
let currentTimeAlive = 0; // Current time alive (score)
let highScore = 0; // Stored high score

let db;
const DB_NAME = 'dinoGameDB';
const SCORE_STORE_NAME = 'scores';

// Open IndexedDB
const request = indexedDB.open(DB_NAME, 1);

request.onerror = function(event) {
    console.error('IndexedDB error:', event.target.errorCode);
};

request.onsuccess = function(event) {
    db = event.target.result;
    console.log('IndexedDB opened successfully.');
    getHighScore(); // Retrieve high score from IndexedDB on success
};

request.onupgradeneeded = function(event) {
    db = event.target.result;
    console.log('IndexedDB upgrade needed.');

    // Create object store if it doesn't exist
    if (!db.objectStoreNames.contains(SCORE_STORE_NAME)) {
        db.createObjectStore(SCORE_STORE_NAME, { keyPath: 'id', autoIncrement: true });
    }
};

function getHighScore() {
    const transaction = db.transaction([SCORE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(SCORE_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = function(event) {
        const scores = event.target.result;
        if (scores.length > 0) {
            highScore = scores.reduce((maxScore, score) => Math.max(maxScore, score.score), 0);
            console.log('Retrieved high score:', highScore);
        } else {
            highScore = 0; // Set default high score if none found
        }
        updateHighScoreDisplay();
    };

    request.onerror = function(event) {
        console.error('Error retrieving high score:', event.target.error);
    };
}

function updateHighScore(newHighScore) {
    const transaction = db.transaction([SCORE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SCORE_STORE_NAME);

    // Clear existing high scores (assuming single score)
    store.clear();

    // Add new high score
    store.add({ score: newHighScore });

    // Update in-memory high score
    highScore = newHighScore;
    console.log('Updated high score:', highScore);

    // Update high score display
    updateHighScoreDisplay();
}

// Function to update high score display in HTML
function updateHighScoreDisplay() {
    const highScoreElement = document.getElementById('highScore');
    if (highScoreElement) {
        highScoreElement.textContent = `High Score: ${highScore}s`;
    }
}

let dino = {
    x: canvas.width * 0.2, // Initial position as a percentage of screen width
    y: canvas.height - 150,
    width: 50,
    height: 50,
    dy: 0,
    jumpHeight: -10,
    gravity: 0.3,
    isJumping: false,
};

let trees = [];
let gameSpeed = 2;
let minTreeInterval = 900; // Minimum interval between trees in milliseconds
let maxTreeInterval = 3000; // Maximum interval between trees in milliseconds
let nextTreeTime = Date.now() + getRandomInterval(minTreeInterval, maxTreeInterval);
let gameStarted = false;
let gameOver = false;
let treesMoving = true; // Flag to control tree movement
let animationFrameId;

// Preload images
dinoImg.onload = () => {
    treeImg.onload = () => {
        // Start the game loop only after images are loaded
        gameLoop();
    };
};

// Game loop function
function gameLoop(timestamp) {
    if (!startTime) {
        startTime = timestamp;
    }

    currentTimeAlive = Math.floor((timestamp - startTime) / 1000); // Calculate time alive in seconds
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGround(); // Draw ground or background
    drawDino();
    drawTrees();
    updateDino();
    if (treesMoving) {
        updateTrees();
    }
    detectCollision();

    drawScore(); // Draw current score
    drawHighScore(); // Draw high score

    if (!gameOver) {
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

function drawScore() {
    const textX = canvas.width * 0.1; // X position as a percentage of canvas width
    const textY = canvas.height * 0.47; // Y position as a percentage of canvas height
    ctx.fillStyle = '#00b200';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${currentTimeAlive}s`, textX, textY);
}

function drawHighScore() {
    const textX = canvas.width * 0.1; // X position as a percentage of canvas width
    const textY = canvas.height * 0.5; // Y position as a percentage of canvas height
    ctx.fillStyle = '#00b200';
    ctx.font = '24px Arial';
    ctx.fillText(`High Score: ${highScore}s`, textX, textY);
}

// Draw functions
function drawDino() {
    ctx.drawImage(dinoImg, dino.x, dino.y, dino.width, dino.height);
}

function drawTrees() {
    trees.forEach(tree => {
        // Calculate opacity based on tree position
        let opacity = 1.0;
        if (tree.x < canvas.width * 0.15 || tree.x > canvas.width * 0.8) {
            // Fade out trees at 20% and 80% of the screen width
            opacity = 0.5;
        }
        if (tree.x < canvas.width * 0.1 || tree.x > canvas.width * 0.88) {
            // Fade out trees at 20% and 80% of the screen width
            opacity = 0.0;
        }

        // Apply opacity to the tree drawing
        ctx.globalAlpha = opacity;
        ctx.drawImage(treeImg, tree.x, tree.y, tree.width, tree.height);
        ctx.globalAlpha = 1.0; // Reset global alpha back to default
    });
}
function jump() {
    if (!dino.isJumping) {
        dino.isJumping = true;
        dino.dy = dino.jumpHeight;
    }
}

// Update functions
function updateDino() {
    if (dino.isJumping) {
        dino.dy += dino.gravity;
        dino.y += dino.dy;

        if (dino.y > canvas.height - dino.height - 100) {
            dino.y = canvas.height - dino.height - 100;
            dino.dy = 0;
            dino.isJumping = false;
        }
    }
}

function updateTrees() {
    trees.forEach(tree => {
        tree.x -= gameSpeed;
    });

    trees = trees.filter(tree => tree.x + tree.width > 0);

    const currentTime = Date.now();
    if (currentTime > nextTreeTime) {
        trees.push({
            x: canvas.width,
            y: canvas.height - 150,
            width: 50,
            height: 50,
        });
        nextTreeTime = currentTime + getRandomInterval(minTreeInterval, maxTreeInterval);
    }
}

function detectCollision() {
    const hitboxReduction = 15; // Amount by which to reduce the hitbox on each side
    trees.forEach(tree => {
        if (
            dino.x < tree.x + tree.width - hitboxReduction &&
            dino.x + dino.width > tree.x + hitboxReduction &&
            dino.y < tree.y + tree.height - hitboxReduction &&
            dino.y + dino.height > tree.y + hitboxReduction
        ) {
            console.log("You Lose!")
            // Collision detected
            // Stop the timer
            gameOver = true;
            dino.y = canvas.height + 100; // Move dino off-screen
            treesMoving = false; // Stop tree movement
            // Update high score if current score is higher
            if (currentTimeAlive > highScore) {
                updateHighScore(currentTimeAlive);
            }

            // Delay before restarting the game
            setTimeout(restartGame, 2000); // Adjust delay time as needed (2000 milliseconds = 2 seconds)
        }
    });
}

function startGame() {
    console.log("Game Started!")
    gameStarted = true;
    startTime = null; // Reset start time
    currentTimeAlive = 0; // Reset current score
    gameOver = false;
    // Optionally reset any game state here if needed
    gameLoop();
}

function restartGame() {
    gameOver = true;
    cancelAnimationFrame(animationFrameId); // Stop the game loop
    // Reset game objects and variables here
    dino = {
        x: canvas.width * 0.2, // Reset dino position if needed
        y: canvas.height - 150,
        width: 50,
        height: 50,
        dy: 0,
        jumpHeight: -10,
        gravity: 0.3,
        isJumping: false,
    };
    trees = [];
    gameSpeed = 2;
    nextTreeTime = Date.now() + getRandomInterval(minTreeInterval, maxTreeInterval);
    gameStarted = false;
    treesMoving = true;
    startGame();
}

function getRandomInterval(min, max) {
    return Math.random() * (max - min) + min;
}

function drawGround() {
    const gradient = ctx.createLinearGradient(0, canvas.height - 100, canvas.width, canvas.height - 100);
    gradient.addColorStop(0.1, 'rgba(0, 178, 0, 0)');
    gradient.addColorStop(0.2, '#00b200');
    gradient.addColorStop(0.8, '#00b200');
    gradient.addColorStop(0.9, 'rgba(0, 178, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, canvas.height - 100, canvas.width, 3);
}

// Event listener for visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Tab or window is not visible
        restartGame();
    }
});

function handleVisibilityChange() {
    if (!gameOver) {
        gameOver = true;
        cancelAnimationFrame(animationFrameId); // Stop the game loop
        // Optionally pause any ongoing game state here
    }
}

// Add event listener for mouse click / touch on the canvas
document.addEventListener('touchstart', () => {
    jump();
});

document.addEventListener('mousedown', () => {
    jump();
});

// Event listener for keyboard controls (optional, keep if needed)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        jump();
    }
});
