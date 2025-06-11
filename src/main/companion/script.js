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
        
        // Default SVG URL
        this.svgUrl = 'https://danidfra.github.io/blobbi-designs/adult-stage/flammi-base.svg';
        
        this.init();
    }
    
    async init() {
        // Load SVG
        await this.loadSVG();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up global click detection
        this.setupGlobalClickDetection();
        
        // Initialize position
        this.updatePosition();
        
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
    
    setupEventListeners() {
        // Toggle visibility button
        document.getElementById('toggle-visibility').addEventListener('click', () => {
            this.toggleVisibility();
        });
        
        // Toggle movement button
        document.getElementById('toggle-movement').addEventListener('click', () => {
            this.toggleMovement();
        });
        
        // Toggle free roam button
        document.getElementById('toggle-free-roam').addEventListener('click', () => {
            this.toggleFreeRoam();
        });
        
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
        const moveBtn = document.getElementById('toggle-movement');
        const freeRoamBtn = document.getElementById('toggle-free-roam');
        
        if (this.isMoving) {
            // Disable free roam when manual movement is enabled
            if (this.isFreeRoaming) {
                this.isFreeRoaming = false;
                this.container.classList.remove('free-roaming');
                this.stopFreeRoam();
            }
            
            // Show the free roam button when manual movement is active
            freeRoamBtn.style.display = 'flex';
            
            this.container.classList.add('moving');
            document.body.style.cursor = 'crosshair';
            moveBtn.classList.add('active');
        } else {
            this.container.classList.remove('moving');
            document.body.style.cursor = 'default';
            moveBtn.classList.remove('active');
            this.stopMoving();
            
            // Re-enable free roam and hide the button when manual movement is disabled
            this.isFreeRoaming = true;
            this.container.classList.add('free-roaming');
            freeRoamBtn.style.display = 'none';
            freeRoamBtn.classList.remove('active');
            
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
        
        // If free roaming, schedule next movement after a pause
        if (this.isFreeRoaming) {
            this.scheduleNextFreeRoamMove();
        }
    }
    
    toggleFreeRoam() {
        this.isFreeRoaming = !this.isFreeRoaming;
        const freeRoamBtn = document.getElementById('toggle-free-roam');
        
        if (this.isFreeRoaming) {
            // Disable manual movement when free roam is enabled
            if (this.isMoving) {
                this.isMoving = false;
                const moveBtn = document.getElementById('toggle-movement');
                this.container.classList.remove('moving');
                document.body.style.cursor = 'default';
                moveBtn.classList.remove('active');
                this.stopMoving();
            }
            
            this.container.classList.add('free-roaming');
            freeRoamBtn.classList.add('active');
            this.startFreeRoam();
        } else {
            this.container.classList.remove('free-roaming');
            freeRoamBtn.classList.remove('active');
            this.stopFreeRoam();
        }
    }
    
    startFreeRoam() {
        if (!this.isFreeRoaming) return;
        
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
    
    becomeAngry() {
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
        
        // Stop current behaviors
        this.stopFreeRoam();
        this.stopMoving();
        
        // Add angry class for styling
        this.character.classList.add('angry');
        
        // Start chasing after a brief angry pause
        setTimeout(() => {
            if (this.isAngry) {
                this.startChasing();
            }
        }, 800);
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
            
            // Check if Flammi has reached the cursor
            const flammiRect = this.character.getBoundingClientRect();
            const flammiCenterX = flammiRect.left + flammiRect.width / 2;
            const flammiCenterY = flammiRect.top + flammiRect.height / 2;
            
            const distance = Math.sqrt(
                Math.pow(e.clientX - flammiCenterX, 2) + 
                Math.pow(e.clientY - flammiCenterY, 2)
            );
            
            // If close enough to cursor (within 50px), catch it!
            if (distance < 50) {
                this.catchCursor();
                document.removeEventListener('mousemove', chaseMouseMove);
                return;
            }
            
            // Chase the cursor
            this.chaseToPosition(e.clientX, e.clientY);
        };
        
        document.addEventListener('mousemove', chaseMouseMove);
    }
    
    chaseToPosition(targetX, targetY) {
        if (!this.isChasing || !this.isAngry) return;
        
        this.targetPosition = { x: targetX, y: targetY };
        this.character.classList.add('chasing');
        
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
            
            if (distance < 10) {
                return; // Close enough, keep chasing
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
        
        // Stop chasing
        this.isChasing = false;
        this.stopMoving();
        this.character.classList.remove('chasing');
        
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
        
        const mouthPath = svg.querySelector('path[d*="Q"], .flammi-mouth');
        if (mouthPath && this.originalMouthPath) {
            mouthPath.setAttribute('d', this.originalMouthPath);
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
    
    // Cleanup method for when companion is removed
    destroy() {
        // Remove global click listener
        if (this.globalClickListener) {
            document.removeEventListener('click', this.globalClickListener, true);
            this.globalClickListener = null;
        }
        
        // Clear all timeouts
        if (this.chaseTimeout) clearTimeout(this.chaseTimeout);
        if (this.sadTimeout) clearTimeout(this.sadTimeout);
        if (this.pauseTimeout) clearTimeout(this.pauseTimeout);
        if (this.moveInterval) clearInterval(this.moveInterval);
        if (this.freeRoamInterval) clearInterval(this.freeRoamInterval);
        
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.blobbiCompanion = new BlobbiCompanion();
    });
} else {
    window.blobbiCompanion = new BlobbiCompanion();
}