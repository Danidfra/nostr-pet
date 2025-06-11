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
        
        // Default SVG URL
        this.svgUrl = 'https://danidfra.github.io/blobbi-designs/adult-stage/flammi-base.svg';
        
        this.init();
    }
    
    async init() {
        // Load SVG
        await this.loadSVG();
        
        // Set up event listeners
        this.setupEventListeners();
        
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
                this.container.classList.add('dragging');
                this.wasFreeRoamingBeforeDrag = wasFreeRoaming;
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                this.position.x = initialX + dx;
                this.position.y = initialY + dy;
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
        const reactions = ['happy', 'spin'];
        const reaction = reactions[Math.floor(Math.random() * reactions.length)];
        
        this.character.classList.add(reaction);
        setTimeout(() => {
            this.character.classList.remove(reaction);
        }, 500);
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