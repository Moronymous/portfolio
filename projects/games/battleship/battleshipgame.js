/* battleshipgame.js */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIG ---
    const width = 10; 
    let maxPoints = 15; 
    let playerPoints = maxPoints;
    
    let gameMode = 'setup'; 
    let currentPlayer = 'user';
    let nextShipId = 1; 

    // --- UI ---
    const playerBoard = document.getElementById('player-board');
    const computerBoard = document.getElementById('computer-board');
    const statusDisplay = document.getElementById('status-message');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    // --- STATES ---
    const userSquares = [];      
    const computerSquares = [];
    
    let playerGridState = new Array(width * width).fill(0); 
    let computerGridState = new Array(width * width).fill(0);

    let playerShipRegistry = {};
    let computerShipRegistry = {}; 

    // --- INITIALIZATION ---
    function createBoard(boardElement, squaresArray, isPlayer) {
        boardElement.innerHTML = '';
        for (let i = 0; i < width * width; i++) {
            const tile = document.createElement('div');
            tile.dataset.id = i;
            tile.classList.add('tile');
            
            if (isPlayer) {
                tile.addEventListener('click', () => {
                    if (gameMode === 'setup' && playerPoints > 0) {
                        if (placeTileLogic(i, playerGridState, playerShipRegistry)) {
                            playerPoints--;
                            statusDisplay.textContent = `Setup Phase: ${playerPoints} points left`;
                            updateVisuals(userSquares, playerGridState);
                        }
                    }
                });
            } else {
                tile.addEventListener('click', () => {
                    if (gameMode === 'battle') handlePlayerFire(i);
                });
            }
            boardElement.appendChild(tile);
            squaresArray.push(tile);
        }
    }

    createBoard(playerBoard, userSquares, true);
    createBoard(computerBoard, computerSquares, false);

    // --- TILES ---
    function placeTileLogic(index, gridState, registry) {
        if (gridState[index] !== 0) return false;

        let adjacentIds = new Set();
        const neighbors = [
            (index >= width) ? index - width : null,
            (index < width * (width - 1)) ? index + width : null,
            (index % width !== width - 1) ? index + 1 : null,
            (index % width !== 0) ? index - 1 : null
        ];

        neighbors.forEach(n => {
            if (n !== null && gridState[n] !== 0) adjacentIds.add(gridState[n]);
        });

        if (adjacentIds.size === 0) {
            let newId = nextShipId++;
            gridState[index] = newId;
            registry[newId] = [index];
        } else {
            let idsToMerge = [...adjacentIds];
            let primaryId = idsToMerge[0];
            gridState[index] = primaryId;
            registry[primaryId].push(index);

            for (let i = 1; i < idsToMerge.length; i++) {
                let absorbedId = idsToMerge[i];
                let tilesToMove = registry[absorbedId];
                registry[primaryId] = registry[primaryId].concat(tilesToMove);
                tilesToMove.forEach(t => gridState[t] = primaryId);
                delete registry[absorbedId];
            }
        }
        return true;
    }

    // --- Enemy Fleet Generation ---
    function generateEnemyFleet(budget) {
        let currentPoints = budget;
        let globalAttempts = 0;

        while (currentPoints > 0 && globalAttempts < 500) {
            let occupiedTiles = computerGridState
                .map((val, idx) => val !== 0 ? idx : null)
                .filter(val => val !== null);

            let tryExtend = (Math.random() > 0.3) && (occupiedTiles.length > 0);
            let targetIndex;

            if (tryExtend) {
                let randomOccupied = occupiedTiles[Math.floor(Math.random() * occupiedTiles.length)];
                let candidates = [randomOccupied - width, randomOccupied + width, randomOccupied - 1, randomOccupied + 1]
                    .filter(c => c >= 0 && c < width*width);
                targetIndex = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                targetIndex = Math.floor(Math.random() * (width * width));
            }

            if (placeTileLogic(targetIndex, computerGridState, computerShipRegistry)) {
                currentPoints--;
            }
            globalAttempts++;
        }
    }

    // ---  FLEET EVALUATOR ---

function evaluateFleetVisuals(registry, gridState, squaresArray) {
    Object.keys(registry).forEach(shipId => {
        const indices = registry[shipId];
        const shipIdInt = parseInt(shipId);
        indices.sort((a, b) => a - b);

        let bows = [];

        indices.forEach(index => {
            const tile = squaresArray[index];
            const x = index % width;
            const y = Math.floor(index / width);

            // Cardinal neighbors
            const N = (y > 0 && gridState[index - width] === shipIdInt) ? 1 : 0;
            const S = (y < width - 1 && gridState[index + width] === shipIdInt) ? 1 : 0;
            const E = (x < width - 1 && gridState[index + 1] === shipIdInt) ? 1 : 0;
            const W = (x > 0 && gridState[index - 1] === shipIdInt) ? 1 : 0;
            const sum = N + S + E + W;

            // Diagonal neighbors
            const NE = (y > 0 && x < width - 1 && gridState[index - width + 1] === shipIdInt) ? 1 : 0;
            const SE = (y < width - 1 && x < width - 1 && gridState[index + width + 1] === shipIdInt) ? 1 : 0;
            const SW = (y < width - 1 && x > 0 && gridState[index + width - 1] === shipIdInt) ? 1 : 0;
            const NW = (y > 0 && x > 0 && gridState[index - width - 1] === shipIdInt) ? 1 : 0;

            tile.className = 'tile ship-part'; 

            if (sum === 0) {
                tile.classList.add('part-small');
                const directions = ['face-N', 'face-S', 'face-E', 'face-W'];
                const randomDir = directions[Math.floor(Math.random() * directions.length)];
                tile.classList.add(randomDir);
            } else if (sum === 1) {
                let facing = N ? 'S' : S ? 'N' : E ? 'W' : 'E';
                bows.push({ index, facing });
            } else if (sum === 2) {
                if ((N && S) || (E && W)) {
                    tile.classList.add('part-straight');
                } else {
                    tile.classList.add('part-corner');
                    if ((N && E && NE) || (E && S && SE) || (S && W && SW) || (W && N && NW)) {
                        tile.classList.add('full');
                    }
                }
            } else if (sum === 3) {
                tile.classList.add('part-t-junction');
                let diags = 0;
                if (!N) { tile.classList.add('face-S'); diags = SW + SE; }
                if (!S) { tile.classList.add('face-N'); diags = NW + NE; }
                if (!E) { tile.classList.add('face-W'); diags = NW + SW; }
                if (!W) { tile.classList.add('face-E'); diags = NE + SE; }

                if (diags === 2) tile.classList.add('double-full');
                else if (diags === 1) {
                    if ((!N && SW) || (!S && NE) || (!E && NW) || (!W && SE)) {
                        tile.classList.add('full-flip');
                    } else {
                        tile.classList.add('full');
                    }
                }
            } else if (sum === 4) {
                tile.classList.add('part-central');
                const diagSum = NE + SE + SW + NW;
                
                if (diagSum === 4) tile.classList.add('full');
                else if (diagSum === 3) { 
                    tile.classList.add('full-missing-corner');
                    if (!NE) tile.classList.add('empty-NE');
                    else if (!SE) tile.classList.add('empty-SE');
                    else if (!SW) tile.classList.add('empty-SW');
                    else if (!NW) tile.classList.add('empty-NW');
                }
                else if (diagSum === 2) {
                    if ((NW && NE) || (NE && SE) || (SE && SW) || (SW && NW)) {
                        tile.classList.add('full-half'); 
                        if (NW && NE) tile.classList.add('face-N');     
                        else if (SW && SE) tile.classList.add('face-S'); 
                        else if (NE && SE) tile.classList.add('face-E'); 
                        else if (NW && SW) tile.classList.add('face-W');
                    }
                    else if ((NW && SE) || (NE && SW)) {
                        tile.classList.add('full-opposite');
                        if (NW && SE) tile.classList.add('diag-backslash');
                        else if (NE && SW) tile.classList.add('diag-slash');
                    }
                }
                else if (diagSum === 1) {
                    tile.classList.add('full-one-corner');
                    if (NE) tile.classList.add('filled-NE');
                    else if (SE) tile.classList.add('filled-SE');
                    else if (SW) tile.classList.add('filled-SW');
                    else if (NW) tile.classList.add('filled-NW');
                }
            }

            if (N) tile.classList.add('con-N');
            if (S) tile.classList.add('con-S');
            if (E) tile.classList.add('con-E');
            if (W) tile.classList.add('con-W');
        });
        
        if (bows.length > 0) {
            const primaryFrontFacing = bows[0].facing;
            bows.forEach(bow => {
                const tile = squaresArray[bow.index];
                tile.classList.add('part-bow');
                tile.classList.add(bow.facing === primaryFrontFacing ? 'bow-front' : 'bow-back');
            });
        }
    });
}
    // --- GAME LOOP ---
    startBtn.addEventListener('click', () => {
        if (playerPoints > 0) {
            if (!confirm(`Spend remaining ${playerPoints} points?`)) return;
        }
        
        generateEnemyFleet(maxPoints);
        
        // Evaluation
        evaluateFleetVisuals(playerShipRegistry, playerGridState, userSquares);
        evaluateFleetVisuals(computerShipRegistry, computerGridState, computerSquares);

        gameMode = 'battle';
        statusDisplay.textContent = "BATTLE STARTED! Target Enemy Waters.";
        startBtn.style.display = 'none';
    });

    resetBtn.addEventListener('click', () => {
        playerPoints = maxPoints;
        gameMode = 'setup';
        currentPlayer = 'user';
        nextShipId = 1;

        playerGridState.fill(0);
        computerGridState.fill(0);
        playerShipRegistry = {};
        computerShipRegistry = {};

        userSquares.length = 0;
        computerSquares.length = 0;
        
        createBoard(playerBoard, userSquares, true);
        createBoard(computerBoard, computerSquares, false);

        startBtn.style.display = 'inline-block';
        statusDisplay.textContent = `Setup Phase: ${playerPoints} points left`;
    });

    function handlePlayerFire(index) {
    if (gameMode !== 'battle' || currentPlayer !== 'user') return;
    const tile = computerSquares[index];
    if (tile.classList.contains('hit') || tile.classList.contains('miss')) return;

    if (computerGridState[index] !== 0) {
        tile.classList.add('hit');
        statusDisplay.textContent = "HIT!";
        checkForSunk(computerShipRegistry, computerGridState[index], "Computer", computerSquares);
    } else {
        tile.classList.add('miss');
        statusDisplay.textContent = "MISS.";
    }

    currentPlayer = 'computer';
    setTimeout(computerTurn, 600);
}

    function computerTurn() {
        if (gameMode !== 'battle') return;
        let shotIndex;
        let valid = false;
        while (!valid) {
            shotIndex = Math.floor(Math.random() * (width * width));
            if (!userSquares[shotIndex].classList.contains('hit') && !userSquares[shotIndex].classList.contains('miss')) valid = true;
        }

        const tile = userSquares[shotIndex];
        if (playerGridState[shotIndex] !== 0) {
            tile.classList.add('hit');
            statusDisplay.textContent = "COMPUTER HIT!";
            checkForSunk(playerShipRegistry, playerGridState[shotIndex], "Player", userSquares);
        } else {
            tile.classList.add('miss');
            statusDisplay.textContent = "COMPUTER MISSED.";
        }
        currentPlayer = 'user';
    }

    function checkForSunk(registry, shipId, victim, squares) {
        if (registry[shipId].every(idx => squares[idx].classList.contains('hit'))) {
            statusDisplay.textContent = `${victim} SHIP SUNK!`;
            registry[shipId].forEach(idx => squares[idx].classList.add('sunk'));
            checkWin();
        }
    }

    function checkWin() {
        const pLoss = Object.values(playerShipRegistry).every(s => s.every(i => userSquares[i].classList.contains('hit')));
        const cLoss = Object.values(computerShipRegistry).every(s => s.every(i => computerSquares[i].classList.contains('hit')));

        if (pLoss) { statusDisplay.textContent = "GAME OVER"; gameMode = 'over'; }
        else if (cLoss) { statusDisplay.textContent = "VICTORY"; gameMode = 'over'; }
    }

    function updateVisuals(squares, state) {
    for (let i = 0; i < width * width; i++) {
        const id = state[i];
        const tile = squares[i];
        if (id === 0) {
            tile.className = 'tile';
            continue;
        }
        tile.className = 'tile taken';
        const N = (i >= width && state[i - width] === id) ? 1 : 0;
        const E = (i % width !== width - 1 && state[i + 1] === id) ? 1 : 0;
        const S = (i < width * (width - 1) && state[i + width] === id) ? 1 : 0;
        const W = (i % width !== 0 && state[i - 1] === id) ? 1 : 0;
        tile.classList.add(`mask-${(N*1)+(E*2)+(S*4)+(W*8)}`);
    }
    }   
});
