/* battleshipgame.js */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- UI REFERENCES ---
    const playerBoard = document.getElementById('player-board');
    const computerBoard = document.getElementById('computer-board');
    const statusDisplay = document.getElementById('status-message');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    const boardSizeSelect = document.getElementById('board-size-select');
    const pointsSelect = document.getElementById('points-select');

    // --- CONFIG ---
    let width = parseInt(boardSizeSelect.value); 
    let maxPoints = parseInt(pointsSelect.value); 
    let playerPoints = maxPoints;
    
    let gameMode = 'setup'; 
    let currentPlayer = 'user';
    let nextShipId = 1; 

    // --- STATES ---
    const userSquares = [];      
    const computerSquares = [];
    
    let playerGridState = [];
    let computerGridState = [];

    let playerShipRegistry = {};
    let computerShipRegistry = {}; 

    let aiMode = 'hunt';
    let aiHitStack = [];
    let aiPotentialTargets = [];

    // --- INITIALIZATION ---
    function createBoard(boardElement, squaresArray, isPlayer) {
        boardElement.innerHTML = '';
        
        boardElement.style.setProperty('--board-size', width);

        for (let i = 0; i < width * width; i++) {
            const tile = document.createElement('div');
            tile.dataset.id = i;
            tile.classList.add('tile');
            
            const faceLayer = document.createElement('div');
            faceLayer.classList.add('face-layer');
            tile.appendChild(faceLayer);
            
            if (isPlayer) {
                tile.addEventListener('click', () => {
                    if (gameMode === 'setup' && playerPoints > 0) {
                        if (placeTileLogic(i, playerGridState, playerShipRegistry)) {
                            playerPoints--;
                            statusDisplay.textContent = `Setup Phase: ${playerPoints} points left`;
                            updateVisuals(userSquares, playerGridState);
                            
                            evaluateFleetVisuals(playerShipRegistry, playerGridState, userSquares);
                            evaluateFaceVisuals(userSquares, playerGridState);
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

    // --- RESET ---
    function resetGame() {
        width = parseInt(boardSizeSelect.value);
        maxPoints = parseInt(pointsSelect.value);
        playerPoints = maxPoints;

        gameMode = 'setup';
        currentPlayer = 'user';
        nextShipId = 1;

        playerGridState = new Array(width * width).fill(0);
        computerGridState = new Array(width * width).fill(0);
        
        playerShipRegistry = {};
        computerShipRegistry = {};
        aiMode = 'hunt';
        aiHitStack = [];
        aiPotentialTargets = [];

        userSquares.length = 0;
        computerSquares.length = 0;
        
        createBoard(playerBoard, userSquares, true);
        createBoard(computerBoard, computerSquares, false);

        startBtn.style.display = 'inline-block';
        statusDisplay.textContent = `Setup Phase: ${playerPoints} points left`;
    }

    // Initialize Game
    resetGame();

    resetBtn.addEventListener('click', resetGame);
    
    boardSizeSelect.addEventListener('change', () => {
        if(confirm("Changing board size will reset the game. Continue?")) {
            resetGame();
        } else {
            // Optional: Revert selection if canceled
        }
    });

    pointsSelect.addEventListener('change', () => {
        resetGame();
    });

    // --- GAME LOOP ---
    startBtn.addEventListener('click', () => {
        if (playerPoints > 0) {
            if (!confirm(`Spend remaining ${playerPoints} points?`)) return;
        }
        
        generateEnemyFleet(maxPoints);
        
        evaluateFleetVisuals(playerShipRegistry, playerGridState, userSquares);
        evaluateDebrisVisuals(userSquares, playerGridState);
        evaluateFaceVisuals(userSquares, playerGridState);

        evaluateFleetVisuals(computerShipRegistry, computerGridState, computerSquares);
        evaluateDebrisVisuals(computerSquares, computerGridState);
        evaluateFaceVisuals(computerSquares, computerGridState); 

        gameMode = 'battle';
        statusDisplay.textContent = "BATTLE STARTED! Target Enemy Agar.";
        startBtn.style.display = 'none';
    });

    // --- TILES & PLACEMENT ---
    function placeTileLogic(index, gridState, registry) {
        if (gridState[index] !== 0) return false;

        let adjacentIds = new Set();
        const neighbors = getValidNeighbors(index);

        neighbors.forEach(n => {
            if (gridState[n] !== 0) adjacentIds.add(gridState[n]);
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

    // --- ENEMY GENERATION ---
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
                let candidates = getValidNeighbors(randomOccupied);
                targetIndex = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                targetIndex = Math.floor(Math.random() * (width * width));
            }
            
            if (targetIndex !== undefined && placeTileLogic(targetIndex, computerGridState, computerShipRegistry)) {
                currentPoints--;
            }
            globalAttempts++;
        }
    }

    // --- FACES ---
    function evaluateFaceVisuals(squaresArray, gridState) {
        const isEnemyBoard = (squaresArray === computerSquares);

        squaresArray.forEach(tile => {
            const face = tile.querySelector('.face-layer');
            if (face) {
                if (!face.classList.contains('face-frown')) {
                    face.className = 'face-layer'; 
                }
            }
        });

        const visited = new Set();

        for (let i = 0; i < width * width; i++) {
            if (gridState[i] !== 0 && !visited.has(i)) {
                const blob = getConnectedBlob(i, (idx) => gridState[idx] !== 0);
                blob.forEach(b => visited.add(b));
                
                if (!isEnemyBoard) {
                    const centerTileIndex = getCenterTile(blob);
                    const face = squaresArray[centerTileIndex].querySelector('.face-layer');
                    
                    if (face && !face.classList.contains('face-frown')) {
                        face.classList.add('face-smile');
                    }
                }
            }
        }

        const deadVisited = new Set();
        for (let i = 0; i < width * width; i++) {
            if (squaresArray[i].classList.contains('hit') && gridState[i] === 0 && !deadVisited.has(i)) {
                const blob = getConnectedBlob(i, (idx) => squaresArray[idx].classList.contains('hit') && gridState[idx] === 0);
                blob.forEach(b => deadVisited.add(b));

                let touchesLiving = false;
                blob.forEach(idx => {
                    const neighbors = getValidNeighbors(idx);
                    neighbors.forEach(n => {
                        if (gridState[n] !== 0) touchesLiving = true;
                    });
                });

                if (!touchesLiving) {
                    const centerTileIndex = getCenterTile(blob);
                    const face = squaresArray[centerTileIndex].querySelector('.face-layer');
                    if (face) face.classList.add('face-dead');
                }
            }
        }
    }

    function getConnectedBlob(startIndex, conditionFn) {
        const blob = [];
        const queue = [startIndex];
        const seen = new Set([startIndex]);

        while(queue.length > 0) {
            const curr = queue.shift();
            blob.push(curr);

            const neighbors = getValidNeighbors(curr);
            neighbors.forEach(n => {
                if (!seen.has(n) && conditionFn(n)) {
                    seen.add(n);
                    queue.push(n);
                }
            });
        }
        return blob;
    }

    function getCenterTile(blobIndices) {
        let sumX = 0;
        let sumY = 0;
        blobIndices.forEach(idx => {
            sumX += idx % width;
            sumY += Math.floor(idx / width);
        });
        const avgX = Math.round(sumX / blobIndices.length);
        const avgY = Math.round(sumY / blobIndices.length);
        
        let closestDist = Infinity;
        let closestIdx = blobIndices[0];

        blobIndices.forEach(idx => {
            const x = idx % width;
            const y = Math.floor(idx / width);
            const dist = Math.abs(x - avgX) + Math.abs(y - avgY);
            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = idx;
            }
        });
        return closestIdx;
    }

    function triggerFrown(squaresArray, gridState, hitIndex) {
        const neighbors = getValidNeighbors(hitIndex);
        const livingNeighbors = neighbors.filter(n => gridState[n] !== 0);

        const processedBlobs = new Set();
        livingNeighbors.forEach(n => {
            if (processedBlobs.has(n)) return;
            
            const blob = getConnectedBlob(n, (idx) => gridState[idx] !== 0);
            blob.forEach(b => processedBlobs.add(b));

            blob.forEach(blobIdx => {
                const face = squaresArray[blobIdx].querySelector('.face-layer');
                if (face && face.classList.contains('face-smile')) {
                    face.classList.remove('face-smile');
                    face.classList.add('face-frown');

                    setTimeout(() => {
                        if (face.classList.contains('face-frown')) {
                            face.classList.remove('face-frown');
                            // FIX: Only restore smile if the ship part is still alive
                            if (gridState[blobIdx] !== 0) {
                                face.classList.add('face-smile');
                            }
                        }
                    }, 1000);
                }
            });
        });
    }


    // --- FLEET VISUALS ---
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

                const N = (y > 0 && gridState[index - width] === shipIdInt) ? 1 : 0;
                const S = (y < width - 1 && gridState[index + width] === shipIdInt) ? 1 : 0;
                const E = (x < width - 1 && gridState[index + 1] === shipIdInt) ? 1 : 0;
                const W = (x > 0 && gridState[index - 1] === shipIdInt) ? 1 : 0;
                const sum = N + S + E + W;

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
                        if ((N && E && NE) || (E && S && SE) || (S && W && SW) || (W && N && NW)) tile.classList.add('full');
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
                        if ((!N && SW) || (!S && NE) || (!E && NW) || (!W && SE)) tile.classList.add('full-flip');
                        else tile.classList.add('full');
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
                    } else if (diagSum === 2) {
                        if ((NW && NE) || (NE && SE) || (SE && SW) || (SW && NW)) {
                            tile.classList.add('full-half'); 
                            if (NW && NE) tile.classList.add('face-N');     
                            else if (SW && SE) tile.classList.add('face-S'); 
                            else if (NE && SE) tile.classList.add('face-E'); 
                            else if (NW && SW) tile.classList.add('face-W');
                        } else if ((NW && SE) || (NE && SW)) {
                            tile.classList.add('full-opposite');
                            if (NW && SE) tile.classList.add('diag-backslash');
                            else if (NE && SW) tile.classList.add('diag-slash');
                        }
                    } else if (diagSum === 1) {
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

    // --- DEBRIS VISUALS ---
    function evaluateDebrisVisuals(squaresArray, gridState) {
        for (let i = 0; i < width * width; i++) {
            const tile = squaresArray[i];

            if (!tile.classList.contains('hit')) continue;

            tile.classList.remove(
                'dead-debris', 'dead-part', 
                'part-small', 'part-corner', 'part-straight', 'part-t-junction', 'part-central', 'part-bow',
                'face-N', 'face-S', 'face-E', 'face-W',
                'con-N', 'con-S', 'con-E', 'con-W',
                'full', 'full-flip', 'double-full', 'full-missing-corner', 'full-half', 'full-opposite', 'full-one-corner',
                'bow-front', 'bow-back',
                'empty-NE', 'empty-SE', 'empty-SW', 'empty-NW',
                'filled-NE', 'filled-SE', 'filled-SW', 'filled-NW',
                'diag-backslash', 'diag-slash'
            );

            const x = i % width;
            const y = Math.floor(i / width);

            const N = (y > 0 && squaresArray[i - width].classList.contains('hit')) ? 1 : 0;
            const S = (y < width - 1 && squaresArray[i + width].classList.contains('hit')) ? 1 : 0;
            const E = (x < width - 1 && squaresArray[i + 1].classList.contains('hit')) ? 1 : 0;
            const W = (x > 0 && squaresArray[i - 1].classList.contains('hit')) ? 1 : 0;
            
            const sum = N + S + E + W;

            const liveN = (y > 0 && gridState[i - width] !== 0);
            const liveS = (y < width - 1 && gridState[i + width] !== 0);
            const liveE = (x < width - 1 && gridState[i + 1] !== 0);
            const liveW = (x > 0 && gridState[i - 1] !== 0);
            
            const isTouchingLiving = liveN || liveS || liveE || liveW;

            if (sum === 0) {
                if (isTouchingLiving) {
                    tile.classList.add('dead-debris')
                } else {
                    tile.classList.add('dead-part');
                    tile.classList.add('part-small');
                    
                    const directions = ['face-N', 'face-S', 'face-E', 'face-W'];
                    const randomDir = directions[Math.floor(Math.random() * directions.length)];
                    tile.classList.add(randomDir);
                }
            } 
            else {
                tile.classList.add('dead-part');

                const NE = (y > 0 && x < width - 1 && squaresArray[i - width + 1].classList.contains('hit')) ? 1 : 0;
                const SE = (y < width - 1 && x < width - 1 && squaresArray[i + width + 1].classList.contains('hit')) ? 1 : 0;
                const SW = (y < width - 1 && x > 0 && squaresArray[i + width - 1].classList.contains('hit')) ? 1 : 0;
                const NW = (y > 0 && x > 0 && squaresArray[i - width - 1].classList.contains('hit')) ? 1 : 0;

                if (sum === 1) {
                    tile.classList.add('part-bow', 'bow-back');
                } else if (sum === 2) {
                    if ((N && S) || (E && W)) {
                        tile.classList.add('part-straight');
                    } else {
                        tile.classList.add('part-corner');
                        if ((N && E && NE) || (E && S && SE) || (S && W && SW) || (W && N && NW)) tile.classList.add('full');
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
                        if ((!N && SW) || (!S && NE) || (!E && NW) || (!W && SE)) tile.classList.add('full-flip');
                        else tile.classList.add('full');
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
                    } else if (diagSum === 2) {
                         if ((NW && NE) || (NE && SE) || (SE && SW) || (SW && NW)) {
                            tile.classList.add('full-half');
                            if (NW && NE) tile.classList.add('face-N');
                            else if (SW && SE) tile.classList.add('face-S');
                            else if (NE && SE) tile.classList.add('face-E');
                            else if (NW && SW) tile.classList.add('face-W');
                        } else if ((NW && SE) || (NE && SW)) {
                            tile.classList.add('full-opposite');
                            if (NW && SE) tile.classList.add('diag-backslash');
                            else if (NE && SW) tile.classList.add('diag-slash');
                        }
                    } else if (diagSum === 1) {
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
            }
        }
    }

    // --- COMBAT ACTIONS ---
    function handlePlayerFire(index) {
        if (gameMode !== 'battle' || currentPlayer !== 'user') return;
        
        const tile = computerSquares[index];
        
        if (tile.classList.contains('hit') || tile.classList.contains('miss')) return;

        if (computerGridState[index] !== 0) {
            const shipId = computerGridState[index];
            
            tile.classList.add('hit');
            tile.style.setProperty('--hit-gif', `url('images/damage.gif?v=${Date.now()}')`);
            statusDisplay.textContent = "DIRECT HIT! The slime recoils!";

            const shipIndex = computerShipRegistry[shipId].indexOf(index);
            if (shipIndex > -1) {
                computerShipRegistry[shipId].splice(shipIndex, 1);
            }
            
            computerGridState[index] = 0; 
            tile.className = 'tile hit'; 

            evaluateFleetVisuals(computerShipRegistry, computerGridState, computerSquares);
            evaluateDebrisVisuals(computerSquares, computerGridState);
            evaluateFaceVisuals(computerSquares, computerGridState);
            
            triggerFrown(computerSquares, computerGridState, index);

            checkForSunk(computerShipRegistry, shipId, "Computer");
            
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
        
        if (aiPotentialTargets.length > 0) {
            shotIndex = aiPotentialTargets.pop();
        } else {
            let valid = false;
            while (!valid) {
                shotIndex = Math.floor(Math.random() * (width * width));
                if (!userSquares[shotIndex].classList.contains('hit') && 
                    !userSquares[shotIndex].classList.contains('miss')) {
                    valid = true;
                }
            }
        }

        const tile = userSquares[shotIndex];

        if (tile.classList.contains('hit') || tile.classList.contains('miss')) {
            computerTurn(); 
            return;
        }

        if (playerGridState[shotIndex] !== 0) {
            const shipId = playerGridState[shotIndex];
            
            tile.classList.add('hit');
            tile.style.setProperty('--hit-gif', `url('images/damage.gif?v=${Date.now()}')`)
            statusDisplay.textContent = "THE ENEMY SLIME ATTACKS!";

            const neighbors = getValidNeighbors(shotIndex);
            neighbors.sort(() => Math.random() - 0.5); 
            neighbors.forEach(n => {
                if (!aiPotentialTargets.includes(n) && 
                    !userSquares[n].classList.contains('hit') && 
                    !userSquares[n].classList.contains('miss')) {
                    aiPotentialTargets.push(n);
                }
            });
            aiHitStack.push(shotIndex);

            const registryIndex = playerShipRegistry[shipId].indexOf(shotIndex);
            if (registryIndex > -1) {
                playerShipRegistry[shipId].splice(registryIndex, 1);
            }

            playerGridState[shotIndex] = 0;
            tile.className = 'tile hit';

            evaluateFleetVisuals(playerShipRegistry, playerGridState, userSquares);
            evaluateDebrisVisuals(userSquares, playerGridState);
            evaluateFaceVisuals(userSquares, playerGridState);

            triggerFrown(userSquares, playerGridState, shotIndex);

            checkForSunk(playerShipRegistry, shipId, "Player");

        } else {
            tile.classList.add('miss');
            statusDisplay.textContent = "ENEMY MISSED.";
        }
        
        currentPlayer = 'user';
    }

    function getValidNeighbors(index) {
        let neighbors = [];
        const x = index % width;
        const y = Math.floor(index / width);

        if (y > 0) neighbors.push(index - width); // North
        if (y < width - 1) neighbors.push(index + width); // South
        if (x > 0) neighbors.push(index - 1); // West
        if (x < width - 1) neighbors.push(index + 1); // East

        return neighbors;
    }

    function checkForSunk(registry, shipId, victim) {
        if (registry[shipId].length === 0) {
            statusDisplay.textContent = `${victim} SLIME ERADICATED!`;
            checkWin();
            
            if (victim === "Player") {
                aiPotentialTargets = []; 
            }
        }
    }

    function checkWin() {
        const pLoss = Object.values(playerShipRegistry).every(shipArray => shipArray.length === 0);
        const cLoss = Object.values(computerShipRegistry).every(shipArray => shipArray.length === 0);

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
