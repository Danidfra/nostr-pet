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
        this.angryObservationTimeout = null;
        this.mouseMoveListener = null;
        
        // ✅ ENHANCED: Centralized audio management system
        this.audioManager = {
            // Audio instances
            grumble: null,
            sleeping: null,
            oneShot: null, // For eating, angry, etc.
            
            // Audio settings
            volume: this.getStoredVolume(),
            isMuted: this.getStoredMuteState(),
            
            // Audio file paths
            sounds: {
                grumble: '/companion/sounds/grumble.mp3',
                sleeping: '/companion/sounds/sleeping.mp3',
                eating: '/companion/sounds/eating.mp3',
                angry: '/companion/sounds/angry.mp3',
                fart: '/companion/sounds/fart.mp3'
            }
        };
        
        // Audio settings check interval
        this.audioSettingsCheckInterval = null;
        
        // Feeding functionality
        this.isFeedingMode = false;
        this.feedingClickListener = null;
        this.foodElement = null;
        this.isEating = false;
        this.foodProximityCheck = null;
        this.currentFood = null;
        
        // ✅ NEW: Toy physics system
        this.isPlayMode = false;
        this.currentToy = null;
        this.toyElement = null;
        this.toyPhysics = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            gravity: 0.5,
            bounce: 0.7,
            friction: 0.98,
            groundY: 0,
            isDragging: false,
            dragOffset: { x: 0, y: 0 }
        };
        this.physicsInterval = null;
        this.wasInPlayMode = false;
        
        // Mouse chasing
        this.lastMousePosition = null;
        this.cursorProximityCheck = null;
        
        // Continuous proximity detection
        this.continuousProximityCheck = null;
        
        // Bed proximity and sleep functionality
        this.bedElement = null;
        this.isSleeping = false;
        this.isAttachedToBed = false;
        this.bedProximityCheck = null;
        this.bedAttachmentOffset = { x: 0, y: 0 };
        this.bedMoveListener = null;
        this.bedObserver = null;
        
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

    // ✅ NEW: Helper methods for audio settings
    getStoredVolume() {
        const stored = localStorage.getItem('blobbi_audio_volume');
        return stored ? Math.max(0, Math.min(1, parseFloat(stored))) : 0.5; // Clamp between 0-1
    }

    getStoredMuteState() {
        return localStorage.getItem('blobbi_audio_muted') === 'true';
    }

    // ✅ NEW: Update audio settings and apply to all active sounds
    updateAudioSettings() {
        const newVolume = this.getStoredVolume();
        const newMuteState = this.getStoredMuteState();
        
        console.log('🎵 Companion: Updating audio settings', { 
            oldVolume: this.audioManager.volume, 
            newVolume, 
            oldMuted: this.audioManager.isMuted, 
            newMuted: newMuteState 
        });
        
        this.audioManager.volume = newVolume;
        this.audioManager.isMuted = newMuteState;
        
        // Apply settings to all active audio instances
        this.applyVolumeToActiveAudio();
    }

    // ✅ NEW: Apply current volume and mute settings to all active audio
    applyVolumeToActiveAudio() {
        const effectiveVolume = this.audioManager.isMuted ? 0 : this.audioManager.volume;
        
        // Apply to looping sounds
        if (this.audioManager.grumble) {
            this.audioManager.grumble.volume = effectiveVolume;
            console.log(`🎵 Applied volume ${effectiveVolume} to grumble audio`);
        }
        
        if (this.audioManager.sleeping) {
            this.audioManager.sleeping.volume = effectiveVolume;
            console.log(`🎵 Applied volume ${effectiveVolume} to sleeping audio`);
        }
        
        // Apply to one-shot sounds (if currently playing)
        if (this.audioManager.oneShot && !this.audioManager.oneShot.ended) {
            this.audioManager.oneShot.volume = effectiveVolume;
            console.log(`🎵 Applied volume ${effectiveVolume} to one-shot audio`);
        }
    }

    // ✅ NEW: Centralized method to play any sound
    playAudio(soundName, options = {}) {
        const { loop = false, replace = false } = options;
        
        console.log(`🎵 Companion: playAudio called`, { 
            soundName, 
            loop, 
            replace,
            currentVolume: this.audioManager.volume,
            isMuted: this.audioManager.isMuted 
        });
        
        // Update settings from localStorage in case they changed
        this.updateAudioSettings();
        
        const soundPath = this.audioManager.sounds[soundName];
        if (!soundPath) {
            console.error(`🎵 Unknown sound: ${soundName}`);
            return null;
        }
        
        const effectiveVolume = this.audioManager.isMuted ? 0 : this.audioManager.volume;
        
        if (loop) {
            // Handle looping sounds (grumble, sleeping)
            const audioKey = soundName; // Use soundName as key
            
            // Stop existing instance if replace is true or if it's already playing
            if (this.audioManager[audioKey]) {
                console.log(`🎵 Stopping existing ${soundName} audio`);
                this.audioManager[audioKey].pause();
                this.audioManager[audioKey].currentTime = 0;
                this.audioManager[audioKey] = null;
            }
            
            // Don't start new audio if we're just stopping
            if (replace && effectiveVolume === 0 && this.audioManager.isMuted) {
                console.log(`🎵 Not starting ${soundName} - muted`);
                return null;
            }
            
            console.log(`🎵 Starting ${soundName} loop with volume ${effectiveVolume}`);
            const audio = new Audio(soundPath);
            audio.volume = effectiveVolume;
            audio.loop = true;
            
            audio.play()
                .then(() => console.log(`✅ ${soundName} audio started successfully`))
                .catch(error => console.error(`❌ Error playing ${soundName}:`, error));
            
            this.audioManager[audioKey] = audio;
            return audio;
        } else {
            // Handle one-shot sounds (eating, angry, fart)
            
            // Stop previous one-shot if still playing and replace is true
            if (replace && this.audioManager.oneShot && !this.audioManager.oneShot.ended) {
                this.audioManager.oneShot.pause();
                this.audioManager.oneShot.currentTime = 0;
            }
            
            // Don't play if muted (but still create the audio object for consistency)
            if (this.audioManager.isMuted) {
                console.log(`🔇 Not playing ${soundName} - muted`);
                return null;
            }
            
            console.log(`🎵 Playing ${soundName} one-shot with volume ${effectiveVolume}`);
            const audio = new Audio(soundPath);
            audio.volume = effectiveVolume;
            
            audio.play()
                .then(() => console.log(`✅ ${soundName} audio played successfully`))
                .catch(error => console.error(`❌ Error playing ${soundName}:`, error));
            
            // Store reference for volume updates (will be cleared when audio ends)
            this.audioManager.oneShot = audio;
            
            // Clear reference when audio ends
            audio.addEventListener('ended', () => {
                if (this.audioManager.oneShot === audio) {
                    this.audioManager.oneShot = null;
                }
            });
            
            return audio;
        }
    }

    // ✅ NEW: Stop specific looping audio
    stopAudio(soundName) {
        console.log(`🎵 Companion: stopAudio called for ${soundName}`);
        
        const audioKey = soundName;
        if (this.audioManager[audioKey]) {
            console.log(`🛑 Stopping ${soundName} audio`);
            this.audioManager[audioKey].pause();
            this.audioManager[audioKey].currentTime = 0;
            this.audioManager[audioKey] = null;
        }
    }

    // ✅ NEW: Stop all audio
    stopAllAudio() {
        console.log('🛑 Companion: Stopping all audio');
        
        // Stop looping sounds
        this.stopAudio('grumble');
        this.stopAudio('sleeping');
        
        // Stop one-shot sound if playing
        if (this.audioManager.oneShot && !this.audioManager.oneShot.ended) {
            this.audioManager.oneShot.pause();
            this.audioManager.oneShot.currentTime = 0;
            this.audioManager.oneShot = null;
        }
    }

    // ✅ NEW: Set up listener for localStorage changes to update audio immediately
    setupAudioSettingsListener() {
        // Listen for storage events (when settings change in other tabs/components)
        window.addEventListener('storage', (e) => {
            if (e.key === 'blobbi_audio_volume' || e.key === 'blobbi_audio_muted') {
                console.log('🎵 Companion: Audio settings changed via storage event', { 
                    key: e.key, 
                    oldValue: e.oldValue, 
                    newValue: e.newValue 
                });
                this.updateAudioSettings();
            }
        });
        
        // Also check for changes periodically (fallback for same-tab changes)
        this.audioSettingsCheckInterval = setInterval(() => {
            const currentVolume = this.getStoredVolume();
            const currentMuted = this.getStoredMuteState();
            
            if (currentVolume !== this.audioManager.volume || currentMuted !== this.audioManager.isMuted) {
                console.log('🎵 Companion: Audio settings changed (periodic check)');
                this.updateAudioSettings();
            }
        }, 500); // Check every 500ms
    }

    // ✅ REFACTORED: Simplified sound methods using centralized audio manager
    playSound(sound) {
        this.playAudio(sound, { loop: false, replace: true });
    }

    playGrumble() {
        // Only start if not already playing
        if (!this.audioManager.grumble) {
            this.playAudio('grumble', { loop: true, replace: false });
        }
    }

    stopGrumble() {
        this.stopAudio('grumble');
    }

    playSleepingSound() {
        // Only start if not already playing
        if (!this.audioManager.sleeping) {
            this.playAudio('sleeping', { loop: true, replace: false });
        }
    }

    stopSleepingSound() {
        this.stopAudio('sleeping');
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
        
        // Start bed proximity detection
        this.startBedProximityDetection();
        
        // ✅ NEW: Set up storage listener for immediate volume/mute updates
        this.setupAudioSettingsListener();
        
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
        // Click on character for reactions or wake-up
        this.character.addEventListener('click', () => {
            if (this.isSleeping) {
                this.handleWakeUpClick();
            } else {
                this.react();
            }
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
        const dragState = {
            isDragging: false,
            isConfirmed: false,
            startX: 0,
            startY: 0,
            offsetX: 0,
            offsetY: 0,
        };
        const dragThreshold = 10; // Pixels to move before a drag is confirmed

        const onPointerDown = (clientX, clientY) => {
            if (this.isMoving) return;

            Object.assign(dragState, { isDragging: true, isConfirmed: false, startX: clientX, startY: clientY });

            this.wasFreeRoamingBeforeDrag = this.isFreeRoaming;
            if (this.isFreeRoaming) {
                this.stopFreeRoam();
            }
        };

        const onPointerMove = (clientX, clientY) => {
            if (!dragState.isDragging) return;

            const deltaX = clientX - dragState.startX;
            const deltaY = clientY - dragState.startY;

            if (!dragState.isConfirmed) {
                if (Math.abs(deltaX) < dragThreshold && Math.abs(deltaY) < dragThreshold) {
                    return; // Not moved enough to determine intent
                }

                if (Math.abs(deltaY) > Math.abs(deltaX)) {
                    // Vertical movement is greater, so it's a scroll. Cancel the drag.
                    dragState.isDragging = false;
                    if (this.wasFreeRoamingBeforeDrag) {
                        this.startFreeRoam();
                    }
                    return;
                } else {
                    // Horizontal movement is greater. Confirm the drag.
                    dragState.isConfirmed = true;
                    this.container.classList.add('dragging');
                    const rect = this.character.getBoundingClientRect();
                    dragState.offsetX = clientX - rect.left;
                    dragState.offsetY = clientY - rect.top;
                }
            }

            // If we've reached this point, the drag is confirmed.
            const newX = clientX - dragState.offsetX;
            const newY = clientY - dragState.offsetY;

            this.position.x = window.innerWidth - newX - this.container.offsetWidth;
            this.position.y = window.innerHeight - newY - this.container.offsetHeight;

            this.position.x = Math.max(0, Math.min(window.innerWidth - this.container.offsetWidth, this.position.x));
            this.position.y = Math.max(0, Math.min(window.innerHeight - this.container.offsetHeight, this.position.y));

            this.updatePosition();
        };

        const onPointerUp = () => {
            if (dragState.isDragging && !dragState.isConfirmed) {
                // If the gesture was too small to be a drag, it was a tap.
                // We can restore free roam immediately.
                if (this.wasFreeRoamingBeforeDrag) {
                    this.startFreeRoam();
                }
            }

            if (dragState.isConfirmed) {
                // If it was a confirmed drag, wait a moment before resuming free roam.
                if (this.wasFreeRoamingBeforeDrag) {
                    setTimeout(() => this.startFreeRoam(), 1000);
                }
            }
            
            this.container.classList.remove('dragging');
            Object.assign(dragState, { isDragging: false, isConfirmed: false });
        };

        // Mouse Events
        this.character.addEventListener('mousedown', (e) => {
            onPointerDown(e.clientX, e.clientY);
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
        document.addEventListener('mouseup', onPointerUp);

        // Touch Events
        this.character.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            onPointerDown(touch.clientX, touch.clientY);
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (dragState.isDragging && e.touches.length > 0) {
                const touch = e.touches[0];
                onPointerMove(touch.clientX, touch.clientY);
                if (dragState.isConfirmed) {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        document.addEventListener('touchend', onPointerUp);
        document.addEventListener('touchcancel', onPointerUp);
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
        if (this.isEating || this.isAngry || this.isSad || this.isSleeping || this.foodElement || this.isShowingSpeechBubble || this.isPlayMode) {
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
        if (!this.isFreeRoaming || this.isSleeping) return;
        
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
        if (!this.isFreeRoaming || this.isSleeping) return;
        
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
            if (this.foodElement && !this.isAngry && !this.isSad && !this.isEating && !this.isSleeping) {
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
    
    startBedProximityDetection() {
        // Check for bed proximity every 200ms
        this.bedProximityCheck = setInterval(() => {
            // Only check bed proximity if not already sleeping and not in other busy states
            if (!this.isSleeping && !this.isAngry && !this.isSad && !this.isEating) {
                this.checkBedProximity();
            }
        }, 200);
    }
    
    stopBedProximityDetection() {
        if (this.bedProximityCheck) {
            clearInterval(this.bedProximityCheck);
            this.bedProximityCheck = null;
        }
    }
    
    findBedElement() {
        // Look for the bed element in the DOM
        // The bed should be an img element with src containing 'bed.png'
        const bedImages = document.querySelectorAll('img[src*="bed.png"]');
        if (bedImages.length > 0) {
            return bedImages[0]; // Return the first bed found
        }
        return null;
    }
    
    checkBedProximity() {
        // Find the bed element if we don't have it
        if (!this.bedElement) {
            this.bedElement = this.findBedElement();
            if (!this.bedElement) {
                return; // No bed found
            }
        }
        
        // Check if bed element still exists in DOM
        if (!document.body.contains(this.bedElement)) {
            this.bedElement = this.findBedElement();
            if (!this.bedElement) {
                return; // Bed was removed
            }
        }
        
        // Get Blobbi's current position
        const blobbiRect = this.character.getBoundingClientRect();
        const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;
        const blobbiCenterY = blobbiRect.top + blobbiRect.height / 2;
        
        // Get bed position and dimensions
        const bedRect = this.bedElement.getBoundingClientRect();
        const bedCenterX = bedRect.left + bedRect.width / 2;
        const bedCenterY = bedRect.top + bedRect.height / 2;
        
        // Calculate distance to bed center
        const distance = Math.sqrt(
            Math.pow(blobbiCenterX - bedCenterX, 2) + 
            Math.pow(blobbiCenterY - bedCenterY, 2)
        );
        
        // Check if Blobbi is within the bed's bounds (not just touching from far away)
        const isWithinBedBounds = (
            blobbiCenterX >= bedRect.left && 
            blobbiCenterX <= bedRect.right &&
            blobbiCenterY >= bedRect.top && 
            blobbiCenterY <= bedRect.bottom
        );
        
        // Trigger sleep if Blobbi is clearly on the bed (within bounds and close to center)
        if (isWithinBedBounds && distance < 80) {
            console.log('🛏️ Blobbi is on the bed! Entering sleep mode...');
            this.enterSleepMode();
        }
    }
    
    enterSleepMode() {
        if (this.isSleeping || this.isAngry || this.isSad || this.isEating) return;
        
        console.log('😴 Blobbi is entering sleep mode on the bed');
        
        // Set sleep state
        this.isSleeping = true;
        
        // Stop all current behaviors
        this.stopFreeRoam();
        this.stopMoving();
        this.stopFocusedFeeding();
        
        // Disable free roaming completely during sleep
        this.isFreeRoaming = false;
        this.container.classList.remove('free-roaming');
        
        // Add sleeping visual state
        this.character.classList.add('sleeping');
        this.container.classList.add('sleeping');
        
        // Position Blobbi at the center of the bed
        this.attachToBed();
        
        // Notify React component to trigger sleep in Nostr
        this.notifyReactSleepMode(true);
        
        // ✅ ENHANCED: Ensure audio settings are current before starting sleeping sound
        this.updateAudioSettings();
        this.playSleepingSound();
    }
    
    attachToBed() {
        if (!this.bedElement) return;
        
        console.log('🔗 Attaching Blobbi to the bed');
        
        // Get bed position and center Blobbi on it
        const bedRect = this.bedElement.getBoundingClientRect();
        const bedCenterX = bedRect.left + bedRect.width / 2;
        
        // ✅ FIXED: Position Blobbi horizontally centered, and vertically slightly above center
        let targetScreenX = bedCenterX + 12;
        let targetScreenY = bedRect.top + bedRect.height * 0.15; // Slightly above center vertically

        // ✅ FIXED: Mobile-specific adjustments (shift 30px left and 25px up)
        if (window.innerWidth < 768) {
            targetScreenX -= 30; // Move 15px to the left
            targetScreenY -= 25; // Move 10px upward
        }
        
        // Convert screen position to our position system (distance from right/bottom)
        this.position.x = window.innerWidth - targetScreenX - 60; // 60 is half of Blobbi's width
        this.position.y = window.innerHeight - targetScreenY - 60; // 60 is half of Blobbi's height
        
        // Keep within bounds
        this.position.x = Math.max(0, Math.min(window.innerWidth - 120, this.position.x));
        this.position.y = Math.max(0, Math.min(window.innerHeight - 120, this.position.y));
        
        this.updatePosition();
        
        // Calculate offset from bed's top-left for maintaining relative position
        this.bedAttachmentOffset.x = targetScreenX - bedRect.left;
        this.bedAttachmentOffset.y = targetScreenY - bedRect.top;
        
        // Set attachment state
        this.isAttachedToBed = true;
        
        // Set up bed movement tracking
        this.setupBedMovementTracking();
    }
    
    setupBedMovementTracking() {
        if (!this.bedElement || this.bedMoveListener) return;
        
        console.log('👀 Setting up bed movement tracking');
        
        // Use MutationObserver to track bed position changes
        const bedObserver = new MutationObserver(() => {
            if (this.isAttachedToBed && this.isSleeping) {
                this.updatePositionWithBed();
            }
        });
        
        // Observe the bed element's parent for style changes
        const bedParent = this.bedElement.parentElement;
        if (bedParent) {
            bedObserver.observe(bedParent, {
                attributes: true,
                attributeFilter: ['style'],
                subtree: true
            });
        }
        
        // Also track with a periodic check as fallback
        this.bedMoveListener = setInterval(() => {
            if (this.isAttachedToBed && this.isSleeping && this.bedElement) {
                this.updatePositionWithBed();
            }
        }, 100);
        
        // Store observer for cleanup
        this.bedObserver = bedObserver;
    }
    
    updatePositionWithBed() {
        if (!this.bedElement || !this.isAttachedToBed) return;
        
        // Get current bed position
        const bedRect = this.bedElement.getBoundingClientRect();
        
        // Calculate new Blobbi position based on bed's top-left and the stored offset
        const targetScreenX = bedRect.left + this.bedAttachmentOffset.x;
        const targetScreenY = bedRect.top + this.bedAttachmentOffset.y;
        
        // Convert to our position system
        const newX = window.innerWidth - targetScreenX - 60;
        const newY = window.innerHeight - targetScreenY - 60;
        
        // Only update if position actually changed (avoid unnecessary updates)
        if (Math.abs(this.position.x - newX) > 1 || Math.abs(this.position.y - newY) > 1) {
            this.position.x = Math.max(0, Math.min(window.innerWidth - 120, newX));
            this.position.y = Math.max(0, Math.min(window.innerHeight - 120, newY));
            this.updatePosition();
        }
    }
    
    exitSleepMode() {
        if (!this.isSleeping) return;
        
        console.log('😊 Blobbi is waking up from the bed');
        
        // Clear sleep state
        this.isSleeping = false;
        this.isAttachedToBed = false;
        
        // Remove sleeping visual state
        this.character.classList.remove('sleeping');
        this.container.classList.remove('sleeping');
        
        // Clean up bed movement tracking
        this.cleanupBedTracking();
        
        // Re-enable free roaming
        this.isFreeRoaming = true;
        this.container.classList.add('free-roaming');
        
        this.stopSleepingSound();

        // Notify React component to wake up in Nostr
        this.notifyReactSleepMode(false);
        
        // Resume normal behavior after a short delay
        setTimeout(() => {
            if (this.isFreeRoaming && !this.isAngry && !this.isSad && !this.isEating && !this.isSleeping) {
                this.startFreeRoam();
            }
        }, 1000);
    }
    
    cleanupBedTracking() {
        // Clear bed movement listener
        if (this.bedMoveListener) {
            clearInterval(this.bedMoveListener);
            this.bedMoveListener = null;
        }
        
        // Disconnect bed observer
        if (this.bedObserver) {
            this.bedObserver.disconnect();
            this.bedObserver = null;
        }
    }
    
    notifyReactSleepMode(shouldSleep) {
        // Notify React component about sleep state change
        window.dispatchEvent(new CustomEvent('companion-sleep-change', {
            detail: { shouldSleep }
        }));
    }
    
    handleReactSleepStateChange(reactSleepState) {
        console.log('🔄 Companion: React sleep state changed', { 
            reactSleepState, 
            companionSleepState: this.isSleeping 
        });
        
        // Sync companion state with React state
        if (reactSleepState && !this.isSleeping) {
            // React says Blobbi should be sleeping, but companion isn't sleeping
            console.log('😴 Companion: Syncing to sleep state from React (will start sleeping audio)');
            this.syncToSleepState();
        } else if (!reactSleepState && this.isSleeping) {
            // React says Blobbi should be awake, but companion is sleeping
            console.log('😊 Companion: Syncing to awake state from React (will stop sleeping audio)');
            this.syncToAwakeState();
        } else if (reactSleepState && this.isSleeping) {
            // Both React and companion agree Blobbi should be sleeping
            // ✅ FIXED: Force restart sleeping audio to ensure it's playing (important for initial load)
            console.log('😴 Companion: Both states agree - sleeping. Force restarting sleeping audio.');
            this.updateAudioSettings(); // Ensure current volume settings
            this.stopSleepingSound(); // Stop any existing instance
            this.playSleepingSound(); // Start fresh
        } else {
            console.log('😊 Companion: Both states agree - awake. No action needed.');
        }
    }
    
    syncToSleepState() {
        // Sync companion to sleep state without triggering React events
        this.isSleeping = true;
        
        // Stop all current behaviors
        this.stopFreeRoam();
        this.stopMoving();
        this.stopFocusedFeeding();
        
        // Disable free roaming completely during sleep
        this.isFreeRoaming = false;
        this.container.classList.remove('free-roaming');
        
        // Add sleeping visual state
        this.character.classList.add('sleeping');
        this.container.classList.add('sleeping');
        
        // Try to attach to bed if available
        if (this.findBedElement()) {
            this.bedElement = this.findBedElement();
            this.attachToBed();
        }
        
        // ✅ ENHANCED: Ensure audio settings are current before starting sleeping sound
        this.updateAudioSettings();
        
        // ✅ FIXED: Force start sleeping sound even if already "playing" (for initial load)
        console.log('😴 Companion: Syncing to sleep state - forcing sleeping audio start');
        this.stopSleepingSound(); // Stop any existing instance first
        this.playSleepingSound(); // Start fresh
        
        console.log('😴 Companion: Synced to sleep state with current audio settings');
    }
    
    syncToAwakeState() {
        // Sync companion to awake state without triggering React events
        this.isSleeping = false;
        this.isAttachedToBed = false;
        
        // Remove sleeping visual state
        this.character.classList.remove('sleeping');
        this.container.classList.remove('sleeping');
        
        // Clean up bed movement tracking
        this.cleanupBedTracking();
        
        // Re-enable free roaming
        this.isFreeRoaming = true;
        this.container.classList.add('free-roaming');
        
        this.stopSleepingSound();

        // Resume normal behavior after a short delay
        setTimeout(() => {
            if (this.isFreeRoaming && !this.isAngry && !this.isSad && !this.isEating && !this.isSleeping) {
                this.startFreeRoam();
            }
        }, 1000);
        
        console.log('😊 Companion: Synced to awake state');
    }
    
    handleWakeUpClick() {
        if (!this.isSleeping) return;
        
        console.log('☀️ Companion: Wake-up click detected');
        this.triggerWakeUp();
    }
    
    handleWakeUpRequest() {
        if (!this.isSleeping) return;
        
        console.log('☀️ Companion: Wake-up request from floating menu');
        this.triggerWakeUp();
    }
    
    triggerWakeUp() {
        if (!this.isSleeping) return;
        
        console.log('☀️ Companion: Triggering wake-up sequence');
        
        // Notify React component to handle the wake-up logic
        window.dispatchEvent(new CustomEvent('companion-sleep-change', {
            detail: { shouldSleep: false }
        }));
    }
    
    react() {
        // Don't react normally if angry, sad, or sleeping
        if (this.isAngry || this.isSad || this.isSleeping) return;
        
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
            // Don't process clicks if already angry, sad, sleeping, or if interactions are disabled
            if (this.isAngry || this.isSad || this.isSleeping || this.interactionOverlay) return;
            
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
        this.playSound('angry');

        this.previousState = {
            isMoving: this.isMoving,
            isFreeRoaming: this.isFreeRoaming
        };

        this.isAngry = true;
        this.isChasing = false;
        this.globalClickHistory = [];
        this.originalMouthElement = null;
        this.originalMouthPath = null;

        this.stopFreeRoam();
        this.stopMoving();

        this.character.classList.add('angry');
        this.container.classList.add('angry');

        await this.replaceWithAngryMouth();

        this.mouseMoveListener = () => {
            console.log('🐭 Mouse moved! Flammi starts chasing.');
            document.removeEventListener('mousemove', this.mouseMoveListener);
            clearTimeout(this.angryObservationTimeout);
            this.playGrumble();
            this.startChasing();
        };

        document.addEventListener('mousemove', this.mouseMoveListener);

        this.angryObservationTimeout = setTimeout(() => {
            console.log('😌 Mouse not moved, Flammi is calming down.');
            document.removeEventListener('mousemove', this.mouseMoveListener);
            this.returnToNormal();
        }, 5000);
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
        this.stopGrumble();
        
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
        this.stopGrumble();
        
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
        this.stopGrumble();

        if (this.angryObservationTimeout) {
            clearTimeout(this.angryObservationTimeout);
            this.angryObservationTimeout = null;
        }
        if (this.mouseMoveListener) {
            document.removeEventListener('mousemove', this.mouseMoveListener);
            this.mouseMoveListener = null;
        }
        
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
                    if (this.isFreeRoaming && !this.isAngry && !this.isSad && !this.isSleeping) {
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
        if (this.isAngry || this.isSad || this.isEating || this.isSleeping) return;
        
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
        
        // Listen for sleep state changes from React
        window.addEventListener('react-sleep-state-change', (event) => {
            const { isSleeping: reactSleepState } = event.detail;
            this.handleReactSleepStateChange(reactSleepState);
        });
        
        // Listen for wake-up requests from floating menu
        window.addEventListener('companion-wake-up-request', () => {
            this.handleWakeUpRequest();
        });
        
        // ✅ NEW: Listen for toy placement from React
        window.addEventListener('toy-placed', (event) => {
            const { element, toy, x, y } = event.detail;
            this.handleToyPlaced(element, toy, x, y);
        });
        
        // ✅ NEW: Listen for toy removal requests
        window.addEventListener('toy-remove-request', () => {
            this.exitPlayMode();
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
        if (this.isAngry || this.isSad || this.isEating || this.isSleeping) return;
        
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
        if (!this.foodElement || this.isEating || this.isSleeping) return;
        
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
    
    // ✅ NEW: Toy physics system methods
    handleToyPlaced(toyElement, toyData, x, y) {
        console.log('🎾 Toy placed by React:', toyData);
        
        // Store toy element and data
        this.toyElement = toyElement;
        this.currentToy = toyData;
        
        // Enter play mode with physics
        this.enterPlayMode();
    }
    
    enterPlayMode() {
        if (this.isPlayMode || !this.toyElement || !this.currentToy) return;
        
        console.log('🎮 Entering play mode with physics!');
        
        // Set play mode state
        this.isPlayMode = true;
        this.wasInPlayMode = true;
        
        // Stop all current behaviors
        this.stopFreeRoam();
        this.stopMoving();
        this.stopFocusedFeeding();
        
        // Apply gravity to Blobbi - make him fall to the bottom
        this.applyGravityToBlobbi();
        
        // Initialize toy physics
        this.initializeToyPhysics();
        
        // Start physics simulation
        this.startPhysicsSimulation();
    }
    
    applyGravityToBlobbi() {
        console.log('🌍 Applying gravity to Blobbi - falling to bottom!');
        
        // Disable free roaming completely during play mode
        this.isFreeRoaming = false;
        this.container.classList.remove('free-roaming');
        this.container.classList.add('falling', 'play-mode');
        
        // ✅ UPDATED: Calculate target position at bottom of screen (floor area)
        const bottomMargin = 80; // Space from bottom edge to create floor area
        const targetY = bottomMargin; // Distance from bottom edge
        
        // Animate falling to bottom
        this.animateFallToBottom(targetY);
    }
    
    animateFallToBottom(targetY) {
        const fallSpeed = 8;
        const fallInterval = setInterval(() => {
            // Move towards bottom
            if (this.position.y > targetY) {
                this.position.y -= fallSpeed;
                this.updatePosition();
            } else {
                // Reached bottom - stop falling
                this.position.y = targetY;
                this.updatePosition();
                clearInterval(fallInterval);
                
                // Add landed state and enable bottom area movement
                this.container.classList.remove('falling');
                this.container.classList.add('landed', 'bottom-area');
                
                console.log('🎯 Blobbi landed at bottom! Can now move freely in bottom area.');
                
                // ✅ NEW: Enable movement within bottom area
                this.enableBottomAreaMovement();
            }
        }, 20);
    }
    
    // ✅ NEW: Enable Blobbi to move freely within the bottom area during play mode
    enableBottomAreaMovement() {
        console.log('🎮 Enabling bottom area movement for Blobbi');
        
        // Start a modified free roam that keeps Blobbi in the bottom area
        this.startBottomAreaRoam();
    }
    
    // ✅ NEW: Modified free roam that constrains movement to bottom area
    startBottomAreaRoam() {
        if (!this.isPlayMode) return;
        
        console.log('🎯 Starting bottom area roam');
        
        // Start with an immediate movement
        this.performBottomAreaMove();
    }
    
    // ✅ NEW: Perform movement within bottom area only
    performBottomAreaMove() {
        if (!this.isPlayMode) return;
        
        // Define bottom area constraints
        const bottomMargin = 80; // Same as where Blobbi landed
        const topLimit = 200; // Don't go too high from bottom
        const sideMargin = 80; // Margin from sides
        
        // Generate random target within bottom area bounds
        const maxDistance = 200; // Maximum distance per move
        
        // Get current center position
        const currentCenterX = window.innerWidth - this.position.x - 60;
        const currentCenterY = window.innerHeight - this.position.y - 60;
        
        // Generate a target within bottom area
        let targetX, targetY;
        let attempts = 0;
        
        do {
            const angle = Math.random() * 2 * Math.PI;
            const distance = 50 + Math.random() * maxDistance;
            
            targetX = currentCenterX + Math.cos(angle) * distance;
            targetY = currentCenterY + Math.sin(angle) * distance;
            
            attempts++;
        } while (
            (targetX < sideMargin || targetX > window.innerWidth - sideMargin ||
             targetY < window.innerHeight - topLimit || targetY > window.innerHeight - bottomMargin) &&
            attempts < 10
        );
        
        // Fallback to random position within bottom area if we can't find a good nearby one
        if (attempts >= 10) {
            targetX = sideMargin + Math.random() * (window.innerWidth - 2 * sideMargin);
            targetY = window.innerHeight - topLimit + Math.random() * (topLimit - bottomMargin);
        }
        
        this.moveToPositionInBottomArea(targetX, targetY);
    }
    
    // ✅ NEW: Move to position but constrained to bottom area
    moveToPositionInBottomArea(targetX, targetY) {
        if (!this.isPlayMode) return;
        
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
            const currentCenterX = window.innerWidth - this.position.x - 60;
            const currentCenterY = window.innerHeight - this.position.y - 60;
            
            // Calculate distance to target
            const dx = this.targetPosition.x - currentCenterX;
            const dy = this.targetPosition.y - currentCenterY;
            
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 5) {
                this.stopBottomAreaMoving();
                return;
            }
            
            const speed = 3;
            const vx = (dx / distance) * speed;
            const vy = (dy / distance) * speed;
            
            // Update position (remember: position.x is distance from right edge, position.y is distance from bottom)
            this.position.x -= vx; // Subtract because x is measured from right
            this.position.y -= vy; // Subtract because y is measured from bottom
            
            // ✅ NEW: Keep within bottom area bounds
            const bottomMargin = 80;
            const topLimit = 200;
            const sideMargin = 20;
            
            this.position.x = Math.max(sideMargin, Math.min(window.innerWidth - 120 - sideMargin, this.position.x));
            this.position.y = Math.max(bottomMargin, Math.min(topLimit, this.position.y));
            
            this.updatePosition();
        }, 30);
    }
    
    // ✅ NEW: Stop bottom area movement
    stopBottomAreaMoving() {
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
            this.moveInterval = null;
        }
        this.character.classList.remove('walking');
        this.container.classList.remove('walking');
        
        // Schedule next movement in bottom area
        if (this.isPlayMode) {
            this.scheduleNextBottomAreaMove();
        }
    }
    
    // ✅ NEW: Schedule next movement in bottom area
    scheduleNextBottomAreaMove() {
        if (!this.isPlayMode) return;
        
        // Random pause between 1-4 seconds
        const pauseDuration = 1000 + Math.random() * 3000;
        
        this.pauseTimeout = setTimeout(() => {
            if (this.isPlayMode) {
                // 90% chance to move, 10% chance to pause longer
                if (Math.random() < 0.9) {
                    this.performBottomAreaMove();
                } else {
                    // Longer pause (2-5 seconds)
                    const longPause = 2000 + Math.random() * 3000;
                    
                    this.pauseTimeout = setTimeout(() => {
                        if (this.isPlayMode) {
                            this.performBottomAreaMove();
                        }
                    }, longPause);
                }
            }
        }, pauseDuration);
    }
    
    initializeToyPhysics() {
        if (!this.toyElement) return;
        
        const toyRect = this.toyElement.getBoundingClientRect();
        
        // ✅ UPDATED: Initialize toy physics state with proper ground level
        this.toyPhysics = {
            x: toyRect.left + toyRect.width / 2,
            y: toyRect.top + toyRect.height / 2,
            vx: 0,
            vy: 0,
            gravity: 0.5,
            bounce: 0.7,
            friction: 0.98,
            groundY: window.innerHeight - 80, // Same level as Blobbi's bottom area
            isDragging: false,
            dragOffset: { x: 0, y: 0 }
        };
        
        // Set up toy-specific physics and interactions
        this.setupToySpecificBehavior();
    }
    
    setupToySpecificBehavior() {
        if (!this.currentToy) return;
        
        switch (this.currentToy.id) {
            case 'toy_ball':
                this.setupBallBehavior();
                break;
            case 'toy_teddy':
                this.setupTeddyBearBehavior();
                break;
            case 'toy_blocks':
                // Not implemented yet as per requirements
                console.log('🧱 Building blocks not implemented yet');
                break;
            default:
                console.log('🎾 Unknown toy type, using default physics');
        }
    }
    
    setupBallBehavior() {
        console.log('⚽ Setting up ball physics and interactions');
        
        // Ball should appear in middle of screen initially
        this.toyPhysics.x = window.innerWidth / 2;
        this.toyPhysics.y = window.innerHeight / 3;
        this.toyPhysics.bounce = 0.8; // Higher bounce for ball
        
        // ✅ NEW: Scale ball to be 1/3 the size of Blobbi (Blobbi is ~120px, so ball should be ~40px)
        if (this.toyElement) {
            this.toyElement.style.width = '40px';
            this.toyElement.style.height = '40px';
        }
        
        // Set up click interactions for ball
        this.setupBallClickInteraction();
        
        // Update toy element position
        this.updateToyPosition();
    }
    
    setupBallClickInteraction() {
        if (!this.toyElement) return;
        
        this.toyElement.addEventListener('click', (e) => {
            if (this.toyPhysics.isDragging) return;
            
            console.log('⚽ Ball clicked!');
            
            // ✅ UPDATED: Click position determines bounce direction (opposite of click)
            const ballRect = this.toyElement.getBoundingClientRect();
            const ballCenterX = ballRect.left + ballRect.width / 2;
            const clickX = e.clientX;
            
            // Determine bounce direction - opposite of click position
            let bounceDirection = 1; // Default right
            if (clickX < ballCenterX) {
                bounceDirection = 1; // Click on left side makes ball go right
            } else {
                bounceDirection = -1; // Click on right side makes ball go left
            }
            
            // ✅ ENHANCED: Stronger bounce impulse for more responsive interaction
            this.toyPhysics.vx = bounceDirection * (4 + Math.random() * 3);
            this.toyPhysics.vy = -6 - Math.random() * 3; // Stronger upward bounce
            
            console.log(`⚽ Ball bouncing ${bounceDirection > 0 ? 'right' : 'left'} (clicked ${clickX < ballCenterX ? 'left' : 'right'} side)`);
        });
    }
    
    setupTeddyBearBehavior() {
        console.log('🧸 Setting up teddy bear physics and interactions');
        
        // ✅ UPDATED: Teddy bear should be 2x the size of Blobbi and affected by gravity
        this.toyPhysics.gravity = 0.5; // Normal gravity like other objects
        this.toyPhysics.bounce = 0.4; // Less bouncy
        this.toyPhysics.friction = 0.95; // More friction
        
        // ✅ NEW: Scale teddy bear to be twice the height of Blobbi (Blobbi is ~120px, so teddy should be ~240px)
        if (this.toyElement) {
            this.toyElement.style.width = '120px';
            this.toyElement.style.height = '120px';
        }
        
        // Make teddy bear draggable
        this.setupTeddyDragInteraction();
        
        // Set up collision detection for hearts
        this.setupTeddyHeartInteraction();
        
        // Update toy element position
        this.updateToyPosition();
    }
    
    setupTeddyDragInteraction() {
        if (!this.toyElement) return;
        
        let isDragging = false;
        
        const onPointerDown = (e) => {
            isDragging = true;
            this.toyPhysics.isDragging = true;
            
            const toyRect = this.toyElement.getBoundingClientRect();
            this.toyPhysics.dragOffset = {
                x: e.clientX - toyRect.left,
                y: e.clientY - toyRect.top
            };
            
            // Stop physics while dragging
            this.toyPhysics.vx = 0;
            this.toyPhysics.vy = 0;
            
            console.log('🧸 Started dragging teddy bear');
            e.preventDefault();
        };
        
        const onPointerMove = (e) => {
            if (!isDragging) return;
            
            // Update toy position to follow mouse
            this.toyPhysics.x = e.clientX - this.toyPhysics.dragOffset.x + this.toyElement.offsetWidth / 2;
            this.toyPhysics.y = e.clientY - this.toyPhysics.dragOffset.y + this.toyElement.offsetHeight / 2;
            
            this.updateToyPosition();
        };
        
        const onPointerUp = () => {
            if (!isDragging) return;
            
            isDragging = false;
            this.toyPhysics.isDragging = false;
            
            console.log('🧸 Stopped dragging teddy bear');
        };
        
        this.toyElement.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    }
    
    setupTeddyHeartInteraction() {
        // This will be called during physics simulation to check for Blobbi collision
        // Implementation in the physics loop
    }
    
    startPhysicsSimulation() {
        if (this.physicsInterval) {
            clearInterval(this.physicsInterval);
        }
        
        console.log('🎮 Starting physics simulation');
        
        this.physicsInterval = setInterval(() => {
            this.updateToyPhysics();
            this.checkToyCollisions();
        }, 16); // ~60 FPS
    }
    
    updateToyPhysics() {
        if (!this.toyElement || this.toyPhysics.isDragging) return;
        
        // Apply gravity
        this.toyPhysics.vy += this.toyPhysics.gravity;
        
        // Apply velocity
        this.toyPhysics.x += this.toyPhysics.vx;
        this.toyPhysics.y += this.toyPhysics.vy;
        
        // Apply friction
        this.toyPhysics.vx *= this.toyPhysics.friction;
        
        // Ground collision
        if (this.toyPhysics.y >= this.toyPhysics.groundY) {
            this.toyPhysics.y = this.toyPhysics.groundY;
            this.toyPhysics.vy *= -this.toyPhysics.bounce;
            
            // Stop small bounces
            if (Math.abs(this.toyPhysics.vy) < 1) {
                this.toyPhysics.vy = 0;
            }
        }
        
        // Wall collisions
        const toyWidth = this.toyElement.offsetWidth;
        if (this.toyPhysics.x <= toyWidth / 2) {
            this.toyPhysics.x = toyWidth / 2;
            this.toyPhysics.vx *= -this.toyPhysics.bounce;
        } else if (this.toyPhysics.x >= window.innerWidth - toyWidth / 2) {
            this.toyPhysics.x = window.innerWidth - toyWidth / 2;
            this.toyPhysics.vx *= -this.toyPhysics.bounce;
        }
        
        // Update visual position
        this.updateToyPosition();
    }
    
    updateToyPosition() {
        if (!this.toyElement) return;
        
        const toyWidth = this.toyElement.offsetWidth;
        const toyHeight = this.toyElement.offsetHeight;
        
        this.toyElement.style.left = `${this.toyPhysics.x - toyWidth / 2}px`;
        this.toyElement.style.top = `${this.toyPhysics.y - toyHeight / 2}px`;
    }
    
    checkToyCollisions() {
        if (!this.toyElement || !this.currentToy) return;
        
        // Get Blobbi's position
        const blobbiRect = this.character.getBoundingClientRect();
        const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;
        const blobbiCenterY = blobbiRect.top + blobbiRect.height / 2;
        
        // Get toy position
        const toyRect = this.toyElement.getBoundingClientRect();
        const toyCenterX = toyRect.left + toyRect.width / 2;
        const toyCenterY = toyRect.top + toyRect.height / 2;
        
        // Calculate distance
        const distance = Math.sqrt(
            Math.pow(blobbiCenterX - toyCenterX, 2) + 
            Math.pow(blobbiCenterY - toyCenterY, 2)
        );
        
        // ✅ UPDATED: Check for collision (adjust threshold based on new toy sizes)
        const collisionThreshold = this.currentToy.id === 'toy_teddy' ? 100 : 50; // Larger threshold for bigger teddy, smaller for smaller ball
        
        if (distance < collisionThreshold) {
            this.handleToyCollision();
        }
    }
    
    handleToyCollision() {
        if (!this.currentToy) return;
        
        switch (this.currentToy.id) {
            case 'toy_ball':
                this.handleBallCollision();
                break;
            case 'toy_teddy':
                this.handleTeddyCollision();
                break;
        }
    }
    
    handleBallCollision() {
        console.log('⚽ Blobbi kicked the ball!');
        
        // Calculate kick direction based on Blobbi's position relative to ball
        const blobbiRect = this.character.getBoundingClientRect();
        const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;
        
        const toyRect = this.toyElement.getBoundingClientRect();
        const toyCenterX = toyRect.left + toyRect.width / 2;
        
        // Kick ball away from Blobbi
        const kickDirection = toyCenterX > blobbiCenterX ? 1 : -1;
        
        // Apply kick impulse
        this.toyPhysics.vx = kickDirection * (4 + Math.random() * 2);
        this.toyPhysics.vy = -3 - Math.random() * 2;
        
        // Add some randomness to make it more fun
        this.toyPhysics.vx += (Math.random() - 0.5) * 2;
    }
    
    handleTeddyCollision() {
        console.log('🧸 Blobbi is cuddling with the teddy bear!');
        
        // Show hearts when touching teddy bear
        this.showTeddyHearts();
        
        // Small push to teddy bear
        const blobbiRect = this.character.getBoundingClientRect();
        const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;
        
        const toyRect = this.toyElement.getBoundingClientRect();
        const toyCenterX = toyRect.left + toyRect.width / 2;
        
        const pushDirection = toyCenterX > blobbiCenterX ? 1 : -1;
        this.toyPhysics.vx += pushDirection * 0.5;
    }
    
    showTeddyHearts() {
        // ✅ UPDATED: Reduced number of hearts emitted on contact
        const hearts = ['💖', '💕', '💗', '🥰', '😍'];
        const numHearts = 1 + Math.floor(Math.random() * 2); // 1-2 hearts (reduced from 2-3)
        
        for (let i = 0; i < numHearts; i++) {
            setTimeout(() => {
                this.createTeddyHeart(hearts[Math.floor(Math.random() * hearts.length)]);
            }, i * 400); // Slightly longer delay between hearts
        }
    }
    
    createTeddyHeart(heartType) {
        const heart = document.createElement('div');
        
        // Get Blobbi's current position
        const blobbiRect = this.character.getBoundingClientRect();
        const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;
        const blobbiCenterY = blobbiRect.top + blobbiRect.height / 2;
        
        // Random offset around Blobbi
        const offsetX = (Math.random() - 0.5) * 60;
        const offsetY = (Math.random() - 0.5) * 40;
        
        heart.style.cssText = `
            position: fixed;
            left: ${blobbiCenterX + offsetX - 15}px;
            top: ${blobbiCenterY + offsetY - 15}px;
            font-size: 20px;
            z-index: 10000;
            pointer-events: none;
            user-select: none;
            animation: teddyHeartFloat 2.5s ease-out forwards;
        `;
        heart.textContent = heartType;
        heart.classList.add('teddy-heart-emoji');
        
        // Add heart float animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes teddyHeartFloat {
                0% { 
                    transform: scale(0) translateY(0); 
                    opacity: 0; 
                }
                20% { 
                    transform: scale(1.1) translateY(-5px); 
                    opacity: 1; 
                }
                100% { 
                    transform: scale(0.9) translateY(-40px); 
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
        }, 2500);
    }
    
    exitPlayMode() {
        if (!this.isPlayMode) return;
        
        console.log('🎮 Exiting play mode');
        
        // Clear play mode state
        this.isPlayMode = false;
        
        // Stop physics simulation
        if (this.physicsInterval) {
            clearInterval(this.physicsInterval);
            this.physicsInterval = null;
        }
        
        // ✅ NEW: Clear bottom area movement timers
        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
            this.pauseTimeout = null;
        }
        
        // Remove toy element
        if (this.toyElement) {
            this.toyElement.remove();
            this.toyElement = null;
        }
        
        // Clear toy data
        this.currentToy = null;
        
        // ✅ UPDATED: Remove all play mode classes including bottom-area
        this.container.classList.remove('falling', 'play-mode', 'landed', 'bottom-area');
        
        // Re-enable free roaming
        this.isFreeRoaming = true;
        this.container.classList.add('free-roaming');
        
        // Notify React component that toy interaction ended
        window.dispatchEvent(new CustomEvent('companion-toy-interaction-ended'));
        
        // Resume normal behavior after a short delay
        setTimeout(() => {
            if (this.isFreeRoaming && !this.isAngry && !this.isSad && !this.isEating && !this.isSleeping) {
                this.startFreeRoam();
            }
        }, 1000);
    }
    
    // Speech bubble functionality
    showSpeechBubble(message = null) {
        // Don't show speech bubble if already showing one or if in certain states
        if (this.isShowingSpeechBubble || this.isAngry || this.isSad || this.isEating || this.isSleeping) return;
        
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
        
        // ✅ NEW: Clean up toy physics system
        this.exitPlayMode();
        
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
        
        // Stop bed proximity detection and cleanup bed tracking
        this.stopBedProximityDetection();
        this.cleanupBedTracking();
        
        // ✅ ENHANCED: Stop all audio and cleanup audio system
        this.stopAllAudio();
        
        // Clear audio settings check interval
        if (this.audioSettingsCheckInterval) {
            clearInterval(this.audioSettingsCheckInterval);
            this.audioSettingsCheckInterval = null;
        }
        
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
    
    // ✅ NEW: Public method to exit play mode
    stopPlaying() {
        this.exitPlayMode();
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