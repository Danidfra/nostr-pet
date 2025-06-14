// Blobbi Companion JavaScript
class BlobbiCompanion {
    constructor() {
        this.container = document.getElementById('blobbi-companion');
        this.character = document.getElementById('blobbi-character');
        this.isMoving = false;
        this.isVisible = true;
        this.isFreeRoaming = true; // Start with free roam enabled by default
        this.position = { x: 20, y: 20 };
        this.targetPosition = null;
        this.moveInterval = null;
        this.freeRoamInterval = null;
        this.pauseTimeout = null;
        this.wasFreeRoamingBeforeDrag = false;
        
        // Rapid click detection and angry behavior
        this.globalClickHistory = []; // Track clicks anywhere on the page
        this.isAngry = false;
        this.isSad = false;
        this.isChasing = false;
        this.chaseStartTime = null;
        this.chaseTimeout = null;
        this.angryTimeout = null;
        this.sadTimeout = null;
        this.interactionOverlay = null;
        this.originalCursor = null;
        this.previousState = null; // Store state before angry mode
        this.globalClickListener = null; // Store reference for cleanup
        this.originalMouthPath = null; // Store original mouth for sad state
        this.originalMouthElement = null; // Store original mouth element for restoration
        this.angryMouthSVG = null; // Store angry mouth SVG content
        
        // Feeding functionality
        this.isFeedingMode = false;
        this.feedingClickListener = null;
        this.foodElement = null;
        this.isEating = false;
        this.foodProximityCheck = null;
        this.currentFood = null;
        
        // Mouse chasing
        this.lastMousePosition = null;
        this.cursorProximityCheck = null;
        
        // Continuous proximity detection
        this.continuousProximityCheck = null;
        
        // Speech bubble functionality
        this.speechBubbleElement = null;
        this.speechBubbleTimeout = null;
        this.isShowingSpeechBubble = false;
        this.speechBubbleMessages = [
            "I'm hungry!",
            "Got any snacks?",
            "Feed me something tasty!",
            "I could really eat right now.",
            "Mmm... food sounds good.",
            "*stomach growls*",
            "Anything to eat?",
            "I love snacks!",
            "Yum yum, what's for lunch?",
            "More food please!",
            "Delicious things, come to me!",
            "Feed time!",
            "I'm craving something yummy.",
            "Snack attack incoming!",
            "Do you smell food?",
        ];
        
        // Default SVG URL
        this.svgUrl = 'https://danidfra.github.io/blobbi-designs/adult-stage/flammi/flammi-base.svg';
        
        this.init();
    }
    
    async init() {
        // Load SVG
        await this.loadSVG();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up food placement listener
        this.setupFoodPlacementListener();
        
        // Set up global click detection
        this.setupGlobalClickDetection();
        
        // Initialize position
        this.updatePosition();
        
        // Start continuous proximity detection
        this.startContinuousProximityDetection();
        
        // Start free roam by default after a short delay to let everything load
        setTimeout(() => {
            if (this.isFreeRoaming) {
                this.container.classList.add('free-roaming');
                this.startFreeRoam();
            }
        }, 1000);
    }
    
    async loadSVG() {
        try {
            const response = await fetch(this.svgUrl);
            const svgText = await response.text();
            this.character.innerHTML = svgText;
            
            // Add class to SVG for styling
            const svg = this.character.querySelector('svg');
            if (svg) {
                svg.classList.add('blobbi-svg');
            }
        } catch (error) {
            console.error('Failed to load SVG:', error);
            // Fallback to a simple circle
            this.character.innerHTML = `
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="40" fill="#FF6B6B"/>
                    <circle cx="35" cy="40" r="5" fill="#000" class="eyes"/>
                    <circle cx="65" cy="40" r="5" fill="#000" class="eyes"/>
                    <path d="M 30 60 Q 50 70 70 60" stroke="#000" stroke-width="3" fill="none"/>
                </svg>
            `;
        }
    }
    
    async loadAngryMouthSVG() {
        if (this.angryMouthSVG) return; // Already loaded
        
        try {
            const response = await fetch('/svg-design/angry-mouth.svg');
            const svgText = await response.text();
            
            // Parse the SVG to extract just the mouth elements
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const angryMouthGroup = doc.querySelector('#g1');
            
            if (angryMouthGroup) {
                this.angryMouthSVG = angryMouthGroup.innerHTML;
            } else {
                console.warn('Could not find angry mouth group in SVG');
            }
        } catch (error) {
            console.error('Failed to load angry mouth SVG:', error);
        }
    }
    
    setupEventListeners() {
        // Click on character for reactions
        this.character.addEventListener('click', () => {
            this.react();
        });
        
        // Drag functionality
        this.setupDrag();
        
        // Click anywhere to move (when manual movement is enabled)
        document.addEventListener('click', (e) => {
            if (this.isMoving && !this.isFreeRoaming && !this.container.contains(e.target)) {
                this.moveToPosition(e.clientX, e.clientY);
            }
        });
        
        // Track mouse position continuously for proximity detection
        document.addEventListener('mousemove', (e) => {
            this.lastMousePosition = { x: e.clientX, y: e.clientY };
        });
    }
    
    setupDrag() {
        let isDragging = false;
        let startX, startY, initialX, initialY;
        let dragOffset = { x: 0, y: 0 };
        
        this.character.addEventListener('mousedown', (e) => {
            if (!this.isMoving) {
                // Stop free roam when dragging but keep the state
                const wasFreeRoaming = this.isFreeRoaming;
                if (this.isFreeRoaming) {
                    this.stopFreeRoam();
                }
                
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                initialX = this.position.x;
                initialY = this.position.y;
                
                // Calculate the offset between mouse and Flammi's center
                const rect = this.character.getBoundingClientRect();
                const flammiCenterX = rect.left + rect.width / 2;
                const flammiCenterY = rect.top + rect.height / 2;
                
                dragOffset.x = e.clientX - flammiCenterX;
                dragOffset.y = e.clientY - flammiCenterY;
                
                this.container.classList.add('dragging');
                this.wasFreeRoamingBeforeDrag = wasFreeRoaming;
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                // Calculate where Flammi's center should be (mouse position minus offset)
                const targetCenterX = e.clientX - dragOffset.x;
                const targetCenterY = e.clientY - dragOffset.y;
                
                // Convert to position coordinates (distance from right and bottom edges)
                // Flammi is 120px wide and tall, so center is 60px from each edge
                this.position.x = window.innerWidth - targetCenterX - 60;
                this.position.y = window.innerHeight - targetCenterY - 60;
                
                // Keep within bounds
                this.position.x = Math.max(0, Math.min(window.innerWidth - 120, this.position.x));
                this.position.y = Math.max(0, Math.min(window.innerHeight - 120, this.position.y));
                
                this.updatePosition();
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.container.classList.remove('dragging');
                
                // Resume free roam if it was active before dragging
                if (this.wasFreeRoamingBeforeDrag && this.isFreeRoaming) {
                    setTimeout(() => {
                        if (this.isFreeRoaming) {
                            this.startFreeRoam();
                        }
                    }, 1000); // Give a moment before resuming
                }
                this.wasFreeRoamingBeforeDrag = false;
            }
        });
    }
    
    toggleVisibility() {
        this.isVisible = !this.isVisible;
        this.container.classList.toggle('hidden');
    }
    
    toggleMovement() {
        this.isMoving = !this.isMoving;
        
        if (this.isMoving) {
            // Disable free roam when manual movement is enabled
            if (this.isFreeRoaming) {
                this.isFreeRoaming = false;
                this.container.classList.remove('free-roaming');
                this.stopFreeRoam();
            }
            
            this.container.classList.add('moving');
            document.body.style.cursor = 'crosshair';
        } else {
            this.container.classList.remove('moving');
            document.body.style.cursor = 'default';
            this.stopMoving();
            
            // Re-enable free roam when manual movement is disabled
            this.isFreeRoaming = true;
            this.container.classList.add('free-roaming');
            
            // Start free roam after a short delay
            setTimeout(() => {
                if (this.isFreeRoaming) {
                    this.startFreeRoam();
                }
            }, 500);
        }
    }
    
    moveToPosition(targetX, targetY) {
        if (!this.isMoving && !this.isFreeRoaming) return;
        
        this.targetPosition = { x: targetX, y: targetY };
        this.character.classList.add('walking');
        this.container.classList.add('walking');
        
        // Clear any existing movement
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
        }
        
        // Move towards target
        this.moveInterval = setInterval(() => {
            // Calculate current center position of Blobbi
            const currentCenterX = window.innerWidth - this.position.x - 60; // 60 is half of 120px width
            const currentCenterY = window.innerHeight - this.position.y - 60; // 60 is half of 120px height
            
            // Calculate distance to target
            const dx = this.targetPosition.x - currentCenterX;
            const dy = this.targetPosition.y - currentCenterY;
            
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 5) {
                this.stopMoving();
                return;
            }
            
            const speed = 3;
            const vx = (dx / distance) * speed;
            const vy = (dy / distance) * speed;
            
            // Update position (remember: position.x is distance from right edge, position.y is distance from bottom)
            this.position.x -= vx; // Subtract because x is measured from right
            this.position.y -= vy; // Subtract because y is measured from bottom
            
            // Keep within bounds
            this.position.x = Math.max(0, Math.min(window.innerWidth - 120, this.position.x));
            this.position.y = Math.max(0, Math.min(window.innerHeight - 120, this.position.y));
            
            this.updatePosition();
        }, 30);
    }
    
    stopMoving() {
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
            this.moveInterval = null;
        }
        this.character.classList.remove('walking');
        this.container.classList.remove('walking');
        
        // If free roaming, schedule next movement after a pause
        if (this.isFreeRoaming) {
            this.scheduleNextFreeRoamMove();
        }
    }
    
    toggleFreeRoam() {
        this.isFreeRoaming = !this.isFreeRoaming;
        
        if (this.isFreeRoaming) {
            // Disable manual movement when free roam is enabled
            if (this.isMoving) {
                this.isMoving = false;
                this.container.classList.remove('moving');
                document.body.style.cursor = 'default';
                this.stopMoving();
            }
            
            this.container.classList.add('free-roaming');
            this.startFreeRoam();
        } else {
            this.container.classList.remove('free-roaming');
            this.stopFreeRoam();
        }
    }
    
    startFreeRoam() {
        if (!this.isFreeRoaming) return;
        
        // Don't start free roaming if Flammi is busy with other activities
        if (this.isEating || this.isAngry || this.isSad || this.foodElement || this.isShowingSpeechBubble) {
            console.log('🚫 Free roam blocked - Flammi is busy with other activities');
            return;
        }
        
        console.log('🎯 Starting free roam');
        
        // Start with an immediate movement
        this.performFreeRoamMove();
    }
    
    stopFreeRoam() {
        // Clear all free roam timers
        if (this.freeRoamInterval) {
            clearInterval(this.freeRoamInterval);
            this.freeRoamInterval = null;
        }
        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
            this.pauseTimeout = null;
        }
        this.stopMoving();
    }
    
    performFreeRoamMove() {
        if (!this.isFreeRoaming) return;
        
        // Generate random target within viewport bounds
        const margin = 80; // Margin to keep fully visible
        const maxDistance = 300; // Maximum distance per move to make it more natural
        
        // Get current center position
        const currentCenterX = window.innerWidth - this.position.x - 60;
        const currentCenterY = window.innerHeight - this.position.y - 60;
        
        // Generate a target within reasonable distance
        let targetX, targetY;
        let attempts = 0;
        
        do {
            const angle = Math.random() * 2 * Math.PI;
            const distance = 100 + Math.random() * maxDistance;
            
            targetX = currentCenterX + Math.cos(angle) * distance;
            targetY = currentCenterY + Math.sin(angle) * distance;
            
            attempts++;
        } while (
            (targetX < margin || targetX > window.innerWidth - margin ||
             targetY < margin || targetY > window.innerHeight - margin) &&
            attempts < 10
        );
        
        // Fallback to completely random position if we can't find a good nearby one
        if (attempts >= 10) {
            targetX = margin + Math.random() * (window.innerWidth - 2 * margin);
            targetY = margin + Math.random() * (window.innerHeight - 2 * margin);
        }
        
        this.moveToPosition(targetX, targetY);
    }
    
    scheduleNextFreeRoamMove() {
        if (!this.isFreeRoaming) return;
        
        // Random pause between 0.5-3 seconds
        const pauseDuration = 500 + Math.random() * 2500;
        
        this.pauseTimeout = setTimeout(() => {
            if (this.isFreeRoaming) {
                // Check for random speech bubble (5% chance)
                if (!this.isShowingSpeechBubble && Math.random() < 0.05) {
                    this.showSpeechBubble();
                    return; // Speech bubble will handle resuming free roam
                }
                
                // 80% chance to move, 20% chance to pause longer (simulate resting)
                if (Math.random() < 0.8) {
                    this.performFreeRoamMove();
                } else {
                    // Longer pause (3-8 seconds) - simulate resting/looking around
                    const longPause = 3000 + Math.random() * 5000;
                    
                    // Add a little reaction during long pause
                    if (Math.random() < 0.3) {
                        this.react();
                    }
                    
                    this.pauseTimeout = setTimeout(() => {
                        if (this.isFreeRoaming) {
                            this.performFreeRoamMove();
                        }
                    }, longPause);
                }
            }
        }, pauseDuration);
    }
    
    updatePosition() {
        this.container.style.right = `${this.position.x}px`;
        this.container.style.bottom = `${this.position.y}px`;
        
        // Check proximity after every position update
        this.checkAllProximities();
    }
    
    checkAllProximities() {
        // Check cursor proximity if chasing
        if (this.isChasing && this.isAngry && this.lastMousePosition) {
            this.checkCursorProximity(this.lastMousePosition.x, this.lastMousePosition.y);
        }
        
        // Charcoal proximity is now handled directly in startFocusedFeeding
    }
    
    startContinuousProximityDetection() {
        // Run proximity checks every 100ms regardless of state
        this.continuousProximityCheck = setInterval(() => {
            // Check cursor proximity if chasing
            if (this.isChasing && this.isAngry && this.lastMousePosition) {
                this.checkCursorProximity(this.lastMousePosition.x, this.lastMousePosition.y);
            }
            
            // Check food proximity - but only for discovery, NOT during active eating
            if (this.foodElement && !this.isAngry && !this.isSad && !this.isEating) {
                const distance = this.getDistanceToFood();
                if (distance < 120) { // Large detection radius for discovery
                    console.log('🍽️ Flammi noticed food nearby and is getting excited!');
                    this.startFocusedFeeding();
                }
            }
        }, 100);
    }
    
    stopContinuousProximityDetection() {
        if (this.continuousProximityCheck) {
            clearInterval(this.continuousProximityCheck);
            this.continuousProximityCheck = null;
        }
    }
    
    react() {
        // Don't react normally if angry or sad
        if (this.isAngry || this.isSad) return;
        
        const reactions = ['happy', 'spin'];
        const reaction = reactions[Math.floor(Math.random() * reactions.length)];
        
        this.character.classList.add(reaction);
        setTimeout(() => {
            this.character.classList.remove(reaction);
        }, 500);
    }
    
    setupGlobalClickDetection() {
        // Set up global click listener for rapid click detection
        this.globalClickListener = (e) => {
            // Don't process clicks if already angry, sad, or if interactions are disabled
            if (this.isAngry || this.isSad || this.interactionOverlay) return;
            
            // Don't count clicks on Flammi's controls
            if (this.container.contains(e.target)) return;
            
            const now = Date.now();
            
            // Add click to history
            this.globalClickHistory.push(now);
            
            // Remove clicks older than 2 seconds
            this.globalClickHistory = this.globalClickHistory.filter(time => now - time < 2000);
            
            // Check for rapid clicking (5 or more clicks in 2 seconds)
            if (this.globalClickHistory.length >= 5) {
                this.becomeAngry();
            }
        };
        
        document.addEventListener('click', this.globalClickListener, true);
    }
    
    async becomeAngry() {
        if (this.isAngry) return;
        
        console.log('🔥 Flammi is getting angry due to rapid clicking!');
        
        // Store previous state
        this.previousState = {
            isMoving: this.isMoving,
            isFreeRoaming: this.isFreeRoaming
        };
        
        // Set angry state
        this.isAngry = true;
        this.isChasing = false;
        this.chaseStartTime = null;
        
        // Clear click history
        this.globalClickHistory = [];
        
        // Clear stored mouth elements for next time
        this.originalMouthElement = null;
        this.originalMouthPath = null;
        
        // Stop current behaviors
        this.stopFreeRoam();
        this.stopMoving();
        
        // Add angry class for styling
        this.character.classList.add('angry');
        this.container.classList.add('angry');
        
        // Replace mouth with angry mouth
        await this.replaceWithAngryMouth();
        
        // Start chasing after a brief angry pause
        setTimeout(() => {
            if (this.isAngry) {
                this.startChasing();
            }
        }, 800);
    }
    
    async replaceWithAngryMouth() {
        const svg = this.character.querySelector('svg');
        if (!svg) return;
        
        // Load angry mouth SVG if not already loaded
        await this.loadAngryMouthSVG();
        if (!this.angryMouthSVG) return;
        
        // Find and store the original mouth element
        const originalMouth = svg.querySelector('path[d*="Q"]') || svg.querySelector('path[stroke*="#"]');
        if (originalMouth && !this.originalMouthElement) {
            this.originalMouthElement = originalMouth.cloneNode(true);
        }
        
        // Remove existing mouth elements
        const mouthElements = svg.querySelectorAll('path[d*="Q"], path[stroke*="#"], .flammi-mouth, .angry-mouth');
        mouthElements.forEach(element => element.remove());
        
        // Create a group for the angry mouth and position it appropriately
        const angryMouthGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        angryMouthGroup.classList.add('angry-mouth');
        
        // Scale and position the angry mouth to fit Flammi's face
        // The original angry mouth is quite large, so we need to scale it down and position it
        angryMouthGroup.setAttribute('transform', 'translate(35, 55) scale(0.3, 0.3)');
        angryMouthGroup.innerHTML = this.angryMouthSVG;
        
        svg.appendChild(angryMouthGroup);
    }
    
    startChasing() {
        if (!this.isAngry) return;
        
        console.log('🏃 Flammi is chasing the cursor!');
        
        this.isChasing = true;
        this.chaseStartTime = Date.now();
        
        // Set up mouse tracking for chasing
        this.setupMouseChasing();
        
        // Set timeout for giving up (10 seconds)
        this.chaseTimeout = setTimeout(() => {
            if (this.isAngry && this.isChasing) {
                this.giveUpChasing();
            }
        }, 10000);
    }
    
    setupMouseChasing() {
        if (!this.isChasing) return;
        
        const chaseMouseMove = (e) => {
            if (!this.isChasing || !this.isAngry) {
                document.removeEventListener('mousemove', chaseMouseMove);
                return;
            }
            
            // Chase the cursor (mouse position is already tracked globally)
            this.chaseToPosition(e.clientX, e.clientY);
        };
        
        document.addEventListener('mousemove', chaseMouseMove);
    }
    
    checkCursorProximity(mouseX, mouseY) {
        // Get Flammi's current position
        const flammiRect = this.character.getBoundingClientRect();
        const flammiCenterX = flammiRect.left + flammiRect.width / 2;
        const flammiCenterY = flammiRect.top + flammiRect.height / 2;
        
        // Calculate distance to mouse
        const distance = Math.sqrt(
            Math.pow(mouseX - flammiCenterX, 2) + 
            Math.pow(mouseY - flammiCenterY, 2)
        );
        
        // Proximity detection area (60px radius)
        if (distance < 60) {
            this.catchCursor();
            if (this.cursorProximityCheck) {
                clearInterval(this.cursorProximityCheck);
                this.cursorProximityCheck = null;
            }
        }
    }
    
    chaseToPosition(targetX, targetY) {
        if (!this.isChasing || !this.isAngry) return;
        
        this.targetPosition = { x: targetX, y: targetY };
        this.character.classList.add('chasing');
        this.container.classList.add('chasing');
        
        // Clear any existing movement
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
        }
        
        // Move towards target with faster speed when angry
        this.moveInterval = setInterval(() => {
            if (!this.isChasing || !this.isAngry) {
                this.stopMoving();
                return;
            }
            
            // Calculate current center position of Blobbi
            const currentCenterX = window.innerWidth - this.position.x - 60;
            const currentCenterY = window.innerHeight - this.position.y - 60;
            
            // Calculate distance to target
            const dx = this.targetPosition.x - currentCenterX;
            const dy = this.targetPosition.y - currentCenterY;
            
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Stop moving when close, let proximity detection handle the catching
            if (distance < 10) {
                return; // Close enough, stop moving but keep proximity checking
            }
            
            const speed = 6; // Faster when angry
            const vx = (dx / distance) * speed;
            const vy = (dy / distance) * speed;
            
            // Update position
            this.position.x -= vx;
            this.position.y -= vy;
            
            // Keep within bounds
            this.position.x = Math.max(0, Math.min(window.innerWidth - 120, this.position.x));
            this.position.y = Math.max(0, Math.min(window.innerHeight - 120, this.position.y));
            
            this.updatePosition();
        }, 20); // Faster update rate when chasing
    }
    
    catchCursor() {
        if (!this.isAngry) return;
        
        console.log('😈 Flammi caught the cursor!');
        
        // Stop chasing and proximity checking
        this.isChasing = false;
        this.stopMoving();
        this.character.classList.remove('chasing');
        this.container.classList.remove('chasing');
        
        // Clear chase timeout
        if (this.chaseTimeout) {
            clearTimeout(this.chaseTimeout);
            this.chaseTimeout = null;
        }
        
        // Disable cursor and interactions
        this.disableInteractions();
        
        // Show toast message
        this.showToast();
        
        // Return to normal after 5 seconds
        setTimeout(() => {
            this.returnToNormal();
        }, 5000);
    }
    
    giveUpChasing() {
        if (!this.isAngry) return;
        
        console.log('😢 Flammi gave up chasing and is now sad...');
        
        // Stop chasing
        this.isChasing = false;
        this.isAngry = false;
        this.isSad = true;
        
        this.stopMoving();
        this.character.classList.remove('chasing', 'angry');
        this.character.classList.add('sad');
        this.container.classList.remove('chasing', 'angry');
        this.container.classList.add('sad');
        
        // Clear chase timeout
        if (this.chaseTimeout) {
            clearTimeout(this.chaseTimeout);
            this.chaseTimeout = null;
        }
        
        // Change mouth to sad expression
        this.changeMouthToSad();
        
        // Return to normal after 5 seconds
        this.sadTimeout = setTimeout(() => {
            this.returnToNormal();
        }, 5000);
    }
    
    changeMouthToSad() {
        // Find the mouth path in the SVG and change it to sad
        const svg = this.character.querySelector('svg');
        if (!svg) return;
        
        // Remove any angry mouth first
        const angryMouth = svg.querySelector('.angry-mouth');
        if (angryMouth) {
            angryMouth.remove();
        }
        
        // Look for existing mouth path (this will vary based on the SVG structure)
        let mouthPath = svg.querySelector('path[d*="Q"]'); // Look for quadratic curve paths (likely mouth)
        
        if (!mouthPath) {
            // If no existing mouth found, create one
            mouthPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            mouthPath.setAttribute('stroke', '#1e293b');
            mouthPath.setAttribute('stroke-width', '2.5');
            mouthPath.setAttribute('fill', 'none');
            mouthPath.setAttribute('stroke-linecap', 'round');
            mouthPath.classList.add('flammi-mouth');
            svg.appendChild(mouthPath);
        } else {
            // Store original mouth for restoration
            if (!this.originalMouthPath) {
                this.originalMouthPath = mouthPath.getAttribute('d');
            }
        }
        
        // Set sad mouth shape (inverted curve)
        mouthPath.setAttribute('d', 'M 42 68 Q 50 62 58 68');
    }
    
    restoreOriginalMouth() {
        const svg = this.character.querySelector('svg');
        if (!svg) return;
        
        // Remove any angry mouth
        const angryMouth = svg.querySelector('.angry-mouth');
        if (angryMouth) {
            angryMouth.remove();
        }
        
        // Remove any custom mouth elements
        const customMouths = svg.querySelectorAll('.flammi-mouth');
        customMouths.forEach(mouth => mouth.remove());
        
        // Restore original mouth element if we have it
        if (this.originalMouthElement) {
            svg.appendChild(this.originalMouthElement.cloneNode(true));
        } else {
            // Fallback: restore original mouth path if we have it
            const mouthPath = svg.querySelector('path[d*="Q"]');
            if (mouthPath && this.originalMouthPath) {
                mouthPath.setAttribute('d', this.originalMouthPath);
            }
        }
    }
    
    disableInteractions() {
        // Store original cursor
        this.originalCursor = document.body.style.cursor;
        
        // Change cursor to not-allowed
        document.body.style.cursor = 'not-allowed';
        
        // Create overlay to block interactions
        this.interactionOverlay = document.createElement('div');
        this.interactionOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 999999;
            cursor: not-allowed;
            pointer-events: all;
            background: transparent;
        `;
        
        // Prevent all mouse events on the overlay
        this.interactionOverlay.addEventListener('click', (e) => e.preventDefault());
        this.interactionOverlay.addEventListener('mousedown', (e) => e.preventDefault());
        this.interactionOverlay.addEventListener('mouseup', (e) => e.preventDefault());
        this.interactionOverlay.addEventListener('contextmenu', (e) => e.preventDefault());
        
        document.body.appendChild(this.interactionOverlay);
    }
    
    enableInteractions() {
        // Restore cursor
        if (this.originalCursor !== null) {
            document.body.style.cursor = this.originalCursor;
            this.originalCursor = null;
        }
        
        // Remove overlay
        if (this.interactionOverlay) {
            document.body.removeChild(this.interactionOverlay);
            this.interactionOverlay = null;
        }
    }
    
    showToast() {
        // Try to use the React toast system if available
        if (window.flammiToast) {
            window.flammiToast(
                "Flammi has forbidden you from clicking for 5 seconds!",
                "🔥 Flammi's Revenge!"
            );
        } else {
            // Fallback: create a simple toast
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ef4444;
                color: white;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000000;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
                font-weight: 500;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
            `;
            
            toast.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 4px;">🔥 Flammi's Revenge!</div>
                <div>Flammi has forbidden you from clicking for 5 seconds!</div>
            `;
            
            // Add slide-in animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(toast);
            
            // Remove toast after 5 seconds
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.animation = 'slideIn 0.3s ease-out reverse';
                    setTimeout(() => {
                        if (toast.parentNode) {
                            document.body.removeChild(toast);
                        }
                        if (style.parentNode) {
                            document.head.removeChild(style);
                        }
                    }, 300);
                }
            }, 5000);
        }
    }
    
    returnToNormal() {
        console.log('😌 Flammi is returning to normal...');
        
        // Clear all angry/sad states
        this.isAngry = false;
        this.isSad = false;
        this.isChasing = false;
        
        // Clear timeouts
        if (this.chaseTimeout) {
            clearTimeout(this.chaseTimeout);
            this.chaseTimeout = null;
        }
        if (this.sadTimeout) {
            clearTimeout(this.sadTimeout);
            this.sadTimeout = null;
        }
        
        // Remove classes
        this.character.classList.remove('angry', 'sad', 'chasing');
        this.container.classList.remove('angry', 'sad', 'chasing');
        
        // Enable interactions
        this.enableInteractions();
        
        // Restore original mouth if it was changed
        this.restoreOriginalMouth();
        
        // Restore previous state
        if (this.previousState) {
            // Restore free roaming if it was active
            if (this.previousState.isFreeRoaming) {
                this.isFreeRoaming = true;
                this.container.classList.add('free-roaming');
                setTimeout(() => {
                    if (this.isFreeRoaming && !this.isAngry && !this.isSad) {
                        this.startFreeRoam();
                    }
                }, 1000);
            }
            
            this.previousState = null;
        }
        
        // Clear click history
        this.globalClickHistory = [];
    }
    
    // New feeding functionality with React integration
    openFeedModal() {
        if (this.isAngry || this.isSad || this.isEating) return;
        
        console.log('🍽️ Opening feed modal...');
        
        // Trigger React modal opening
        if (window.openFeedModal) {
            window.openFeedModal();
        } else {
            // Fallback to old feeding mode if React integration not available
            this.toggleFeedingMode();
        }
    }
    
    // Setup listener for food placement from React
    setupFoodPlacementListener() {
        window.addEventListener('food-placed', (event) => {
            const { element, food, x, y } = event.detail;
            this.handleFoodPlaced(element, food, x, y);
        });
    }
    
    // Handle food placement from React
    handleFoodPlaced(foodElement, foodData, x, y) {
        console.log('🍽️ Food placed by React:', foodData);
        
        // Store food element and data
        this.foodElement = foodElement;
        this.currentFood = foodData;
        
        // Start focused feeding behavior
        this.startFocusedFeeding();
    }
    
    // Legacy feeding functionality (fallback)
    toggleFeedingMode() {
        if (this.isAngry || this.isSad || this.isEating) return;
        
        this.isFeedingMode = !this.isFeedingMode;
        
        if (this.isFeedingMode) {
            console.log('🪨 Feed mode activated! Click anywhere to place charcoal.');
            document.body.style.cursor = 'crosshair';
            this.setupFeedingClickListener();
        } else {
            console.log('🪨 Feed mode deactivated.');
            document.body.style.cursor = 'default';
            this.removeFeedingClickListener();
        }
    }
    
    setupFeedingClickListener() {
        this.feedingClickListener = (e) => {
            // Don't place charcoal on Flammi's controls
            if (this.container.contains(e.target)) return;
            
            // Don't place charcoal if interactions are disabled
            if (this.interactionOverlay) return;
            
            this.placeFood(e.clientX, e.clientY);
            this.isFeedingMode = false;
            
            document.body.style.cursor = 'default';
            this.removeFeedingClickListener();
        };
        
        document.addEventListener('click', this.feedingClickListener, true);
    }
    
    removeFeedingClickListener() {
        if (this.feedingClickListener) {
            document.removeEventListener('click', this.feedingClickListener, true);
            this.feedingClickListener = null;
        }
    }
    
    placeFood(x, y) {
        // Remove any existing food
        if (this.foodElement) {
            this.foodElement.remove();
            this.foodElement = null;
        }
        
        // Create food element (fallback for legacy mode)
        this.foodElement = document.createElement('div');
        this.foodElement.style.cssText = `
            position: fixed;
            left: ${x - 15}px;
            top: ${y - 15}px;
            font-size: 30px;
            z-index: 9998;
            pointer-events: none;
            user-select: none;
            animation: foodDrop 0.3s ease-out;
        `;
        this.foodElement.textContent = '🪨'; // Default to charcoal for legacy mode
        this.foodElement.classList.add('companion-food');
        
        // Add drop animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes foodDrop {
                from { 
                    transform: translateY(-20px) scale(0.5); 
                    opacity: 0; 
                }
                to { 
                    transform: translateY(0) scale(1); 
                    opacity: 1; 
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(this.foodElement);
        
        console.log('🍽️ Food placed! Flammi is immediately focused on it.');
        
        // Start focused feeding behavior
        this.startFocusedFeeding();
    }
    
    startFocusedFeeding() {
        if (!this.foodElement || this.isEating) return;
        
        console.log('🍽️ Flammi is now COMPLETELY focused on the food!');
        
        // Set eating state and stop ALL other behaviors
        this.isEating = true;
        this.stopFreeRoam();
        this.stopMoving();
        
        // Disable free roaming completely during feeding
        this.isFreeRoaming = false;
        this.container.classList.remove('free-roaming');
        
        this.character.classList.add('walking', 'excited');
        this.container.classList.add('walking', 'excited');
        
        // Clear any existing movement
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
        }
        
        console.log('🎯 Starting persistent food pursuit...');
        
        // Persistent movement towards food - recalculates target every frame
        this.moveInterval = setInterval(() => {
            // Safety check - if food is gone or we're not eating, stop
            if (!this.isEating || !this.foodElement) {
                console.log('🛑 Stopping food pursuit - food gone or not eating');
                this.stopFocusedFeeding();
                return;
            }
            
            // ALWAYS get fresh food position (this is key!)
            const foodRect = this.foodElement.getBoundingClientRect();
            const foodCenterX = foodRect.left + foodRect.width / 2;
            const foodCenterY = foodRect.top + foodRect.height / 2;
            
            // Get Flammi's current center position
            const flammiRect = this.character.getBoundingClientRect();
            const flammiCenterX = flammiRect.left + flammiRect.width / 2;
            const flammiCenterY = flammiRect.top + flammiRect.height / 2;
            
            // Calculate distance and direction to food
            const dx = foodCenterX - flammiCenterX;
            const dy = foodCenterY - flammiCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if close enough to eat (generous radius)
            if (distance < 70) {
                console.log('🍽️ Flammi reached the food! Starting eating...');
                this.eatFood();
                return;
            }
            
            // Move towards food with determination
            const speed = 6; // Fast and determined
            const vx = (dx / distance) * speed;
            const vy = (dy / distance) * speed;
            
            // Convert screen movement to position coordinates
            // Remember: position.x is distance from RIGHT edge, position.y is distance from BOTTOM edge
            this.position.x -= vx; // Moving right decreases distance from right edge
            this.position.y -= vy; // Moving down decreases distance from bottom edge
            
            // Keep within bounds
            this.position.x = Math.max(0, Math.min(window.innerWidth - 120, this.position.x));
            this.position.y = Math.max(0, Math.min(window.innerHeight - 120, this.position.y));
            
            this.updatePosition();
            
            // Debug log every 50 frames (1 second at 20ms intervals)
            if (Math.random() < 0.02) {
                console.log(`🎯 Pursuing food: distance=${Math.round(distance)}px, speed=${speed}`);
            }
        }, 20); // Fast update rate for responsive movement
    }
    
    stopFocusedFeeding() {
        console.log('🛑 Stopping focused feeding');
        
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
            this.moveInterval = null;
        }
        
        this.character.classList.remove('walking', 'excited');
        this.container.classList.remove('walking', 'excited');
        
        // Only reset eating state if we're not actually eating (i.e., we stopped before reaching food)
        if (this.isEating && this.foodElement) {
            // Don't reset isEating here - let eatFood handle it
            return;
        }
        
        this.isEating = false;
        
        // Re-enable free roaming
        this.isFreeRoaming = true;
        this.container.classList.add('free-roaming');
        
        // Resume normal behavior after a short delay
        setTimeout(() => {
            if (this.isFreeRoaming && !this.isAngry && !this.isSad && !this.isEating && !this.foodElement) {
                this.startFreeRoam();
            }
        }, 1000);
    }
    
    getDistanceToFood() {
        if (!this.foodElement) return Infinity;
        
        // Get Flammi's current position
        const flammiRect = this.character.getBoundingClientRect();
        const flammiCenterX = flammiRect.left + flammiRect.width / 2;
        const flammiCenterY = flammiRect.top + flammiRect.height / 2;
        
        // Get food position
        const foodRect = this.foodElement.getBoundingClientRect();
        const foodCenterX = foodRect.left + foodRect.width / 2;
        const foodCenterY = foodRect.top + foodRect.height / 2;
        
        // Calculate distance to food
        return Math.sqrt(
            Math.pow(foodCenterX - flammiCenterX, 2) + 
            Math.pow(foodCenterY - flammiCenterY, 2)
        );
    }
    
    // checkCharcoalProximity method removed - now handled directly in startFocusedFeeding
    
    eatFood() {
        if (!this.foodElement) return;
        
        console.log('😋 Flammi is eating the food!');
        
        // Stop focused feeding movement
        this.stopFocusedFeeding();
        
        this.character.classList.remove('walking', 'excited');
        this.character.classList.add('eating');
        this.container.classList.remove('walking', 'excited');
        this.container.classList.add('eating');
        
        // Remove food with eating animation
        this.foodElement.style.animation = 'foodEaten 0.5s ease-in forwards';
        
        // Add eating animation style
        const style = document.createElement('style');
        style.textContent = `
            @keyframes foodEaten {
                to { 
                    transform: scale(0) translateY(-10px); 
                    opacity: 0; 
                }
            }
        `;
        document.head.appendChild(style);
        
        // Notify React component that food was reached (this will trigger Nostr events)
        if (this.currentFood) {
            window.dispatchEvent(new CustomEvent('companion-food-reached', {
                detail: { food: this.currentFood }
            }));
        }
        
        // Remove food after animation
        setTimeout(() => {
            if (this.foodElement) {
                this.foodElement.remove();
                this.foodElement = null;
            }
            if (style.parentNode) {
                document.head.removeChild(style);
            }
            // Clear current food data
            this.currentFood = null;
        }, 500);
        
        // Show heart emojis
        setTimeout(() => {
            this.showHeartEmojis();
        }, 300);
        
        // Return to normal after showing affection
        setTimeout(() => {
            this.finishEating();
        }, 2000);
    }
    
    showHeartEmojis() {
        const hearts = ['❤️', '💖', '💕', '💗', '💝'];
        const numHearts = 4 + Math.floor(Math.random() * 3); // 4-6 hearts randomly
        
        for (let i = 0; i < numHearts; i++) {
            setTimeout(() => {
                this.createHeartEmoji(hearts[Math.floor(Math.random() * hearts.length)]);
            }, i * 200);
        }
    }
    
    createHeartEmoji(heartType) {
        const heart = document.createElement('div');
        
        // Get Flammi's current position
        const flammiRect = this.character.getBoundingClientRect();
        const flammiCenterX = flammiRect.left + flammiRect.width / 2;
        const flammiCenterY = flammiRect.top + flammiRect.height / 2;
        
        // Random offset around Flammi
        const offsetX = (Math.random() - 0.5) * 80;
        const offsetY = (Math.random() - 0.5) * 60;
        
        heart.style.cssText = `
            position: fixed;
            left: ${flammiCenterX + offsetX - 15}px;
            top: ${flammiCenterY + offsetY - 15}px;
            font-size: 24px;
            z-index: 10000;
            pointer-events: none;
            user-select: none;
            animation: heartFloat 2s ease-out forwards;
        `;
        heart.textContent = heartType;
        heart.classList.add('heart-emoji');
        
        // Add heart float animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes heartFloat {
                0% { 
                    transform: scale(0) translateY(0); 
                    opacity: 0; 
                }
                20% { 
                    transform: scale(1.2) translateY(-10px); 
                    opacity: 1; 
                }
                100% { 
                    transform: scale(0.8) translateY(-50px); 
                    opacity: 0; 
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(heart);
        
        // Remove heart after animation
        setTimeout(() => {
            if (heart.parentNode) {
                document.body.removeChild(heart);
            }
            if (style.parentNode) {
                document.head.removeChild(style);
            }
        }, 2000);
    }
    
    finishEating() {
        this.isEating = false;
        this.character.classList.remove('eating');
        this.container.classList.remove('eating');
        
        console.log('😊 Flammi finished eating and is happy!');
        
        // Re-enable free roaming
        this.isFreeRoaming = true;
        this.container.classList.add('free-roaming');
        
        // Return to normal behavior after a satisfied pause
        setTimeout(() => {
            // Double-check that we're not in any other state before resuming free roam
            if (this.isFreeRoaming && !this.isAngry && !this.isSad && !this.isEating && !this.foodElement) {
                console.log('🎯 Flammi is satisfied and resuming free roam');
                this.startFreeRoam();
            }
        }, 1500); // Slightly longer pause to show satisfaction
    }
    
    // Speech bubble functionality
    showSpeechBubble(message = null) {
        // Don't show speech bubble if already showing one or if in certain states
        if (this.isShowingSpeechBubble || this.isAngry || this.isSad || this.isEating) return;
        
        console.log('💬 Showing speech bubble');
        
        // Set state
        this.isShowingSpeechBubble = true;
        
        // Stop free roaming while showing speech bubble
        const wasFreeRoaming = this.isFreeRoaming;
        if (this.isFreeRoaming) {
            this.stopFreeRoam();
        }
        
        // Select a random message if none provided
        if (!message) {
            message = this.speechBubbleMessages[Math.floor(Math.random() * this.speechBubbleMessages.length)];
        }
        
        // Create speech bubble element
        this.createSpeechBubble(message);
        
        // Clear any existing timeout
        if (this.speechBubbleTimeout) {
            clearTimeout(this.speechBubbleTimeout);
        }
        
        // Remove speech bubble after 5 seconds
        this.speechBubbleTimeout = setTimeout(() => {
            this.hideSpeechBubble();
            
            // Resume free roaming if it was active before
            if (wasFreeRoaming) {
                this.isFreeRoaming = true;
                this.container.classList.add('free-roaming');
                setTimeout(() => {
                    if (this.isFreeRoaming && !this.isAngry && !this.isSad && !this.isEating && !this.foodElement) {
                        this.startFreeRoam();
                    }
                }, 500);
            }
        }, 5000);
    }
    
    createSpeechBubble(message) {
        // Remove any existing speech bubble
        if (this.speechBubbleElement) {
            this.speechBubbleElement.remove();
        }
        
        // Create speech bubble container
        this.speechBubbleElement = document.createElement('div');
        this.speechBubbleElement.className = 'speech-bubble';
        
        // Create inner content
        const content = document.createElement('div');
        content.className = 'speech-bubble-content';
        content.textContent = message;
        
        // Create tail/arrow pointing down to Flammi
        const tail = document.createElement('div');
        tail.className = 'speech-bubble-tail';
        
        this.speechBubbleElement.appendChild(content);
        this.speechBubbleElement.appendChild(tail);
        
        // Add to container
        this.container.appendChild(this.speechBubbleElement);
        
        // Trigger fade-in animation
        setTimeout(() => {
            this.speechBubbleElement.classList.add('visible');
        }, 10);
    }
    
    hideSpeechBubble() {
        if (!this.speechBubbleElement) return;
        
        console.log('💬 Hiding speech bubble');
        
        // Fade out
        this.speechBubbleElement.classList.remove('visible');
        
        // Remove after animation
        setTimeout(() => {
            if (this.speechBubbleElement) {
                this.speechBubbleElement.remove();
                this.speechBubbleElement = null;
            }
            this.isShowingSpeechBubble = false;
        }, 300);
    }
    
    // Add random speech bubble triggers
    scheduleRandomSpeechBubble() {
        // Random chance to show speech bubble during free roam
        if (this.isFreeRoaming && !this.isShowingSpeechBubble && Math.random() < 0.1) {
            this.showSpeechBubble();
        }
    }
    
    // Cleanup method for when companion is removed
    destroy() {
        // Remove global click listener
        if (this.globalClickListener) {
            document.removeEventListener('click', this.globalClickListener, true);
            this.globalClickListener = null;
        }
        
        // Remove feeding click listener
        this.removeFeedingClickListener();
        
        // Remove food if present
        if (this.foodElement) {
            this.foodElement.remove();
            this.foodElement = null;
        }
        
        // Remove speech bubble if present
        if (this.speechBubbleElement) {
            this.speechBubbleElement.remove();
            this.speechBubbleElement = null;
        }
        
        // Clear all timeouts and intervals
        if (this.chaseTimeout) clearTimeout(this.chaseTimeout);
        if (this.sadTimeout) clearTimeout(this.sadTimeout);
        if (this.pauseTimeout) clearTimeout(this.pauseTimeout);
        if (this.speechBubbleTimeout) clearTimeout(this.speechBubbleTimeout);
        if (this.moveInterval) clearInterval(this.moveInterval);
        if (this.freeRoamInterval) clearInterval(this.freeRoamInterval);
        if (this.cursorProximityCheck) clearInterval(this.cursorProximityCheck);
        if (this.foodProximityCheck) clearInterval(this.foodProximityCheck);
        
        // Stop continuous proximity detection
        this.stopContinuousProximityDetection();
        
        // Enable interactions if disabled
        this.enableInteractions();
    }
    
    // Public API methods
    show() {
        this.isVisible = true;
        this.container.classList.remove('hidden');
    }
    
    hide() {
        this.isVisible = false;
        this.container.classList.add('hidden');
    }
    
    setPosition(x, y) {
        this.position = { x, y };
        this.updatePosition();
    }
    
    loadCustomSVG(url) {
        this.svgUrl = url;
        this.loadSVG();
    }
    
    // Public method to show speech bubble with custom message
    speak(message) {
        this.showSpeechBubble(message);
    }
    
    // Public method to add custom messages to the random pool
    addSpeechMessage(message) {
        if (!this.speechBubbleMessages.includes(message)) {
            this.speechBubbleMessages.push(message);
        }
    }
    
    // Public method to set all speech messages
    setSpeechMessages(messages) {
        if (Array.isArray(messages) && messages.length > 0) {
            this.speechBubbleMessages = messages;
        }
    }
    
    // Public method to toggle movement mode
    toggleMovementMode() {
        this.toggleMovement();
    }
    
    // Public method to open feed modal
    openFeed() {
        this.openFeedModal();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.blobbiCompanion = new BlobbiCompanion();
    });
} else {
    window.blobbiCompanion = new BlobbiCompanion();
}