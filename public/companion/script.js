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
                fart: '/companion/sounds/fart.mp3',
                'ball-kick': '/companion/sounds/ball-kick.mp3',
                'wood-block': '/companion/sounds/wood-block.mp3'

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
            dragOffset: { x: 0, y: 0 },
            rotation: 0, // ✅ NEW: Track rotation for rolling animation
            rotationSpeed: 0, // ✅ NEW: Track rotation speed
            soundIntensity: 1.0,

        };
        this.physicsInterval = null;
        this.wasInPlayMode = false;

        // ✅ NEW: Build Blocks specific physics system (completely isolated)
        this.buildBlocksSystem = {
            isActive: false,
            blocks: new Map(), // Track all build blocks with their physics state
            animationFrame: null,
            gravity: 0.8, // Pixels per frame
            friction: 0.98,
            bounceReduction: 0.3,
            stackTolerance: 5, // Pixels tolerance for stacking
            groundLevel: null
        };

        // ✅ NEW: Blobbi physics system for play mode
        this.blobbiPhysics = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            gravity: 0.5,
            bounce: 0.6,
            friction: 0.98,
            groundY: 0,
            isDragging: false,
            isPhysicsActive: false
        };
        this.blobbiPhysicsInterval = null;

        // ✅ NEW: Toy interaction behavior system
        this.toyInteractionInterval = null;
        this.isApproachingToy = false;
        this.toyInteractionCooldown = false;
        this.lastToyInteractionTime = 0;
        this.lastCollisionTime = 0; // ✅ NEW: For collision debouncing

        // ✅ NEW: Block selection system
        this.blockSelectionMenu = null;
        this.spawnedBlocks = new Map(); // Track spawned blocks by type
        this.maxBlocksPerType = 2; // Increased limit for more building possibilities
        this.blockMenuOpen = false; // Track menu state
        this.blockSizes = {
            'p-1': { height: 160 },
            'p-2': { height: 80 },
            'p-3': { height: 80 },
            'p-4': { height: 80 },
            'p-5': { height: 80 },
            'p-6': { height: 160 },
            'p-7': { height: 80 },
            'p-8': { height: 240 },
            'p-9': { height: 80 }
        }; // ✅ UPDATED: Only height specified, width will auto-adjust to preserve aspect ratio

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
        const { loop = false, replace = false, volume = null } = options;

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

        const effectiveVolume = this.audioManager.isMuted ? 0 : (volume !== null ? volume : this.audioManager.volume);

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
            if (this.audioManager.isMuted && volume === null) {
                console.log(`🔇 Not playing ${soundName} - muted`);
                return null;
            }

            console.log(`🎵 Playing ${soundName} one-shot with volume ${effectiveVolume}`);
            const audio = new Audio(soundPath);
            audio.volume = effectiveVolume;

            audio.play()
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

    playBallKickSound(intensity) {
        const volume = Math.min(1, Math.max(0, intensity));
        this.playAudio('ball-kick', { volume });
    }

    playWoodBlockSound(intensity = 1.0) {
        const volume = Math.min(1, Math.max(0, intensity));
        this.playAudio('wood-block', { volume });
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

        this.stopFreeRoam();
        setTimeout(() => {
        this.startFreeRoam();
        }, 1000)
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

        // ✅ NEW: Listen for toy box interactions (for removing blocks)
        window.addEventListener('toy-box-interaction', (event) => {
            const { element } = event.detail;
            this.handleToyBoxInteraction(element);
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

        // ✅ NEW: Handle Build Blocks differently - create floating menu instead of spawning
        if (toyData.id === 'toy_blocks') {
            console.log('🧱 Build Blocks selected - activating isolated Build Blocks system');

            // Remove the placeholder toy element since we're using a floating menu (if it exists)
            if (toyElement && toyElement.parentNode) {
                toyElement.remove();
            }

            // Store toy data for blocks
            this.currentToy = toyData;
            this.toyElement = null; // No single toy element for blocks

            // ✅ NEW: Activate Build Blocks specific system (isolated)
            this.activateBuildBlocksSystem();

            // Create floating block selection menu instead of spawning a block
            this.createFloatingBlockMenu();
            return;
        }

        // Store toy element and data for other toys
        this.toyElement = toyElement;
        this.currentToy = toyData;

        // Enter play mode with physics for other toys
        this.enterPlayMode();
    }

    enterPlayMode() {
        if (this.isPlayMode || (!this.toyElement && this.currentToy?.id !== 'toy_blocks') || !this.currentToy) return;

        console.log('🎮 Entering play mode with physics!');

        // Set play mode state
        this.isPlayMode = true;
        this.wasInPlayMode = true;

        // ✅ NEW: Add global class to prevent unwanted drag behavior
        document.body.classList.add('toy-interaction-active');

        // Stop all current behaviors
        this.stopFreeRoam();
        this.stopMoving();
        this.stopFocusedFeeding();

        // Apply gravity to Blobbi - make him fall to the bottom
        this.applyGravityToBlobbi();

        // Initialize toy physics
        if (this.toyElement) {
            this.initializeToyPhysics();
        }

        // Start physics simulation
        if (this.toyElement) {
            this.startPhysicsSimulation();
        }
    }

    applyGravityToBlobbi() {
        console.log('🌍 Applying gravity to Blobbi - enabling physics!');

        // Disable free roaming completely during play mode
        this.isFreeRoaming = false;
        this.container.classList.remove('free-roaming');
        this.container.classList.add('play-mode');

        // ✅ NEW: Initialize Blobbi physics system
        this.initializeBlobbiPhysics();

        // ✅ NEW: Start Blobbi physics simulation
        this.startBlobbiPhysics();
    }





    // ✅ FIXED: More natural toy interaction behavior system
    startToyInteractionBehavior() {
        if (!this.isPlayMode || this.toyInteractionInterval) return;

        console.log('🎮 Starting toy interaction behavior system');

        // ✅ FIXED: More frequent checks with natural timing
        this.toyInteractionInterval = setInterval(() => {
            if (this.isPlayMode && !this.isApproachingToy && this.shouldInteractWithToy()) {
                // ✅ FIXED: Higher chance to interact when conditions are met
                // The shouldInteractWithToy() method already handles probability based on distance
                this.approachAndInteractWithToy();
            }
        }, 2000 + Math.random() * 3000); // Check every 2-5 seconds
    }

    // ✅ FIXED: More natural toy interaction timing
    shouldInteractWithToy() {
        if (!this.toyElement || !this.currentToy || this.toyInteractionCooldown) return false;

        // Don't interact if toy is being dragged
        if (this.toyPhysics.isDragging) return false;

        // ✅ FIXED: More reasonable interaction frequency (5-8 seconds between interactions)
        const now = Date.now();
        const minInteractionInterval = 5000 + Math.random() * 3000; // 5-8 seconds
        if (now - this.lastToyInteractionTime < minInteractionInterval) return false;

        // ✅ FIXED: More lenient speed check for ball interactions
        if (this.currentToy.id === 'toy_ball') {
            const speed = Math.sqrt(this.toyPhysics.vx * this.toyPhysics.vx + this.toyPhysics.vy * this.toyPhysics.vy);
            if (speed > 3) return false; // Allow interaction with faster moving balls
        }

        // ✅ NEW: Distance-based interaction probability (closer = more likely to interact)
        const blobbiRect = this.character.getBoundingClientRect();
        const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;
        const blobbiCenterY = blobbiRect.top + blobbiRect.height / 2;

        const toyRect = this.toyElement.getBoundingClientRect();
        const toyCenterX = toyRect.left + toyRect.width / 2;
        const toyCenterY = toyRect.top + toyRect.height / 2;

        const distance = Math.sqrt(
            Math.pow(blobbiCenterX - toyCenterX, 2) +
            Math.pow(blobbiCenterY - toyCenterY, 2)
        );

        // Higher probability when closer to toy
        const maxInteractionDistance = 300;
        if (distance > maxInteractionDistance) return false;

        const proximityFactor = 1 - (distance / maxInteractionDistance);
        const interactionProbability = 0.3 + (proximityFactor * 0.4); // 30-70% chance based on distance

        return Math.random() < interactionProbability;
    }

    // ✅ FIXED: Approach toy using physics impulses instead of movement system
    approachAndInteractWithToy() {
        if (!this.toyElement || !this.currentToy || this.isApproachingToy) return;

        console.log(`🎯 Blobbi is approaching the ${this.currentToy.name}!`);

        this.isApproachingToy = true;
        this.lastToyInteractionTime = Date.now();

        // Add excited state
        this.character.classList.add('excited');
        this.container.classList.add('excited');

        // ✅ FIXED: Use physics impulse to move towards toy
        this.moveTowardsToyWithPhysics();
    }

    // ✅ NEW: Move Blobbi towards toy using physics impulses
    moveTowardsToyWithPhysics() {
        if (!this.toyElement || !this.isApproachingToy) return;

        // Get toy position
        const toyRect = this.toyElement.getBoundingClientRect();
        const toyCenterX = toyRect.left + toyRect.width / 2;

        // Get Blobbi's current position
        const blobbiRect = this.character.getBoundingClientRect();
        const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;

        // Calculate direction to toy
        const dx = toyCenterX - blobbiCenterX;
        const distance = Math.abs(dx);

        // If close enough, perform interaction
        if (distance < 80) {
            console.log('🎮 Blobbi reached the toy! Performing interaction...');
            setTimeout(() => {
                this.performToyInteraction();
            }, 500);
            return;
        }

        // Apply physics impulse towards toy
        const direction = dx > 0 ? 1 : -1;
        const impulseStrength = Math.min(distance / 100, 3); // Scale impulse based on distance

        this.blobbiPhysics.vx += direction * impulseStrength;

        console.log(`🎯 Applied physics impulse towards toy: ${direction * impulseStrength}`);

        // Check again after a short delay
        setTimeout(() => {
            if (this.isApproachingToy) {
                this.moveTowardsToyWithPhysics();
            }
        }, 1000);
    }

    // ✅ NEW: Perform specific interaction based on toy type
    performToyInteraction() {
        if (!this.currentToy || !this.toyElement) return;

        console.log(`🎮 Blobbi is interacting with ${this.currentToy.name}!`);

        switch (this.currentToy.id) {
            case 'toy_ball':
                this.performBallInteraction();
                break;
            case 'toy_teddy':
                this.performTeddyInteraction();
                break;
            default:
                this.performGenericToyInteraction();
        }
    }

    // ✅ NEW: Ball-specific interaction
    performBallInteraction() {
        console.log('⚽ Blobbi is playing with the ball!');

        // Face the ball and get excited
        this.character.classList.add('excited');

        // Wait a moment, then kick the ball
        setTimeout(() => {
            if (this.isApproachingToy && this.toyElement) {
                // Calculate kick direction (away from Blobbi)
                const blobbiRect = this.character.getBoundingClientRect();
                const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;
                const toyRect = this.toyElement.getBoundingClientRect();
                const toyCenterX = toyRect.left + toyRect.width / 2;

                const kickDirection = toyCenterX > blobbiCenterX ? 1 : -1;

                // Apply kick impulse to ball
                this.toyPhysics.vx = kickDirection * (3 + Math.random() * 2);
                this.toyPhysics.vy = -2 - Math.random() * 2;

                // Add rotation impulse
                const ballRadius = this.toyElement.offsetWidth / 2;
                const kickRotationSpeed = this.toyPhysics.vx / ballRadius;
                this.toyPhysics.rotation += kickRotationSpeed * 0.3;

                console.log(`⚽ Blobbi kicked the ball ${kickDirection > 0 ? 'right' : 'left'}!`);

                // Show excitement reaction
                this.react();
            }

            this.finishToyInteraction();
        }, 1000);
    }

    // ✅ NEW: Teddy bear-specific interaction
    performTeddyInteraction() {
        console.log('🧸 Blobbi is cuddling with the teddy bear!');

        // Show love and affection
        this.character.classList.add('excited');

        // Show hearts
        setTimeout(() => {
            this.showTeddyHearts();
        }, 500);

        // Gently push teddy bear
        setTimeout(() => {
            if (this.isApproachingToy && this.toyElement) {
                const blobbiRect = this.character.getBoundingClientRect();
                const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;
                const toyRect = this.toyElement.getBoundingClientRect();
                const toyCenterX = toyRect.left + toyRect.width / 2;

                const pushDirection = toyCenterX > blobbiCenterX ? 1 : -1;
                this.toyPhysics.vx += pushDirection * 1;

                console.log('🧸 Blobbi gently nudged the teddy bear!');
            }

            this.finishToyInteraction();
        }, 2000);
    }

    // ✅ NEW: Generic toy interaction
    performGenericToyInteraction() {
        console.log('🎮 Blobbi is playing with the toy!');

        this.character.classList.add('excited');
        this.react();

        setTimeout(() => {
            this.finishToyInteraction();
        }, 1500);
    }

    // ✅ FIXED: More natural toy interaction completion with physics
    finishToyInteraction() {
        console.log('😊 Blobbi finished playing with the toy!');

        this.isApproachingToy = false;

        // Remove excited state
        this.character.classList.remove('excited');
        this.container.classList.remove('excited');

        // ✅ FIXED: More reasonable cooldown timing
        this.toyInteractionCooldown = true;
        setTimeout(() => {
            this.toyInteractionCooldown = false;
        }, 3000 + Math.random() * 4000); // 3-7 second cooldown

        // ✅ FIXED: Show satisfaction reaction
        setTimeout(() => {
            if (this.isPlayMode) {
                this.react(); // Show happiness after playing
            }
        }, 500);

        // ✅ FIXED: Add a small random impulse to keep Blobbi moving naturally
        setTimeout(() => {
            if (this.isPlayMode && !this.isApproachingToy) {
                // Add small random movement impulse
                this.blobbiPhysics.vx += (Math.random() - 0.5) * 2;
                console.log('🎯 Added post-interaction movement impulse');
            }
        }, 1500 + Math.random() * 1000); // 1.5-2.5 second pause
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
            groundY: window.innerHeight - (this.toyElement.offsetHeight / 2), // Toy touches the ground
            isDragging: false,
            dragOffset: { x: 0, y: 0 },
            rotation: 0, // ✅ NEW: Track rotation for rolling animation
            rotationSpeed: 0 // ✅ NEW: Track rotation speed
        };

        // Set up toy-specific physics and interactions
        this.setupToySpecificBehavior();
    }

    setupToySpecificBehavior() {
        if (!this.currentToy) return;

        // ✅ NEW: Add generic toy attributes for all toy types
        if (this.toyElement) {
            this.toyElement.setAttribute('data-toy', this.currentToy.id.replace('toy_', ''));
            this.toyElement.classList.add('companion-toy');
        }

        switch (this.currentToy.id) {
            case 'toy_ball':
                this.setupBallBehavior();
                break;
            case 'toy_teddy':
                this.setupTeddyBearBehavior();
                break;
            case 'toy_blocks':
                this.setupBlocksBehavior();
                break;
            default:
                this.setupGenericToyBehavior();
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

            // ✅ NEW: Ensure ball image has smooth rotation
            const ballImage = this.toyElement.querySelector('img');
            if (ballImage) {
                ballImage.style.transition = 'filter 0.2s ease-out';
                ballImage.style.transformOrigin = 'center center';
            }
        }

        // ✅ UPDATED: Update ground level for ball size
        this.toyPhysics.groundY = window.innerHeight - 20; // Ball touches the bottom edge (40px height / 2)

        // Set up click interactions for ball
        this.setupBallClickInteraction();

        // Update toy element position
        this.updateToyPosition();
    }

    setupBallClickInteraction() {
        if (!this.toyElement) return;

        // ✅ ENHANCED: Prevent default browser drag behavior for ball
        this.toyElement.style.userSelect = 'none';
        this.toyElement.style.webkitUserSelect = 'none';
        this.toyElement.style.webkitUserDrag = 'none';
        this.toyElement.style.webkitTouchCallout = 'none';
        this.toyElement.draggable = false;
        this.toyElement.style.cursor = 'grab';

        // Prevent context menu on long press (mobile)
        this.toyElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Prevent image drag specifically
        this.toyElement.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });

        // ✅ NEW: Enhanced interaction system with drag support
        this.setupBallDragAndClickInteraction();
    }

    setupBallDragAndClickInteraction() {
        if (!this.toyElement) return;

        let isDragging = false;
        let dragStarted = false;
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        const dragThreshold = 8; // Minimum pixels to move before starting drag
        const clickTimeThreshold = 200; // Maximum time for a click (ms)

        const onPointerDown = (e) => {
            // ✅ ENHANCED: Prevent all default behaviors immediately
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            dragStarted = false;
            startX = e.clientX;
            startY = e.clientY;
            startTime = Date.now();

            const ballRect = this.toyElement.getBoundingClientRect();
            this.toyPhysics.dragOffset = {
                x: e.clientX - ballRect.left,
                y: e.clientY - ballRect.top
            };

            // ✅ FIXED: Let CSS handle cursor during play mode
            if (!document.body.classList.contains('play-mode-active')) {
                document.body.style.cursor = 'grabbing';
                this.toyElement.style.cursor = 'grabbing';
            }

            // ✅ NEW: Add visual feedback for interaction start
            this.toyElement.style.transform = 'scale(1.05)';

            console.log('⚽ Pointer down on ball');
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;

            // ✅ ENHANCED: Prevent all default behaviors during interaction
            e.preventDefault();
            e.stopPropagation();

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Only start actual dragging after threshold is met
            if (!dragStarted && distance > dragThreshold) {
                dragStarted = true;
                this.toyPhysics.isDragging = true;

                // Stop physics while dragging
                this.toyPhysics.vx = 0;
                this.toyPhysics.vy = 0;

                // ✅ NEW: Add visual feedback for drag state
                this.toyElement.classList.add('dragging');
                this.toyElement.style.transform = 'scale(1.1)';
                this.toyElement.style.zIndex = '9999';
                this.toyElement.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';

                console.log('⚽ Started dragging ball');
            }

            if (dragStarted) {
                // ✅ ENHANCED: Smooth position updates with bounds checking
                const newX = e.clientX - this.toyPhysics.dragOffset.x + this.toyElement.offsetWidth / 2;
                const newY = e.clientY - this.toyPhysics.dragOffset.y + this.toyElement.offsetHeight / 2;

                // Keep within screen bounds
                const minX = this.toyElement.offsetWidth / 2;
                const maxX = window.innerWidth - this.toyElement.offsetWidth / 2;
                const minY = this.toyElement.offsetHeight / 2;
                const maxY = window.innerHeight - this.toyElement.offsetHeight / 2;

                this.toyPhysics.x = Math.max(minX, Math.min(maxX, newX));
                this.toyPhysics.y = Math.max(minY, Math.min(maxY, newY));

                // ✅ NEW: Reset rotation and rotation speed when dragging
                if (this.currentToy && this.currentToy.id === 'toy_ball') {
                    this.toyPhysics.rotation = 0;
                    this.toyPhysics.rotationSpeed = 0;
                }

                this.updateToyPosition();
            }
        };

        const onPointerUp = (e) => {
            if (!isDragging) return;

            // ✅ ENHANCED: Prevent default behaviors on release
            e.preventDefault();
            e.stopPropagation();

            const endTime = Date.now();
            const interactionTime = endTime - startTime;

            isDragging = false;

            // ✅ FIXED: Let CSS handle cursor during play mode
            if (!document.body.classList.contains('play-mode-active')) {
                document.body.style.cursor = '';
                this.toyElement.style.cursor = 'grab';
            }
            this.toyElement.style.transform = '';
            this.toyElement.style.zIndex = '';
            this.toyElement.style.filter = '';

            if (dragStarted) {
                // ✅ NEW: This was a drag operation - release the ball with physics
                this.toyPhysics.isDragging = false;
                dragStarted = false;

                // ✅ NEW: Remove visual feedback for drag state
                this.toyElement.classList.remove('dragging');

                console.log('⚽ Released ball from drag - physics resumed');
            } else if (interactionTime < clickTimeThreshold) {
                // ✅ NEW: This was a click/tap - trigger kick behavior
                this.handleBallKick(e);
            }
        };

        // ✅ ENHANCED: Use both pointer and touch events for maximum compatibility

        // Pointer events (modern browsers)
        this.toyElement.addEventListener('pointerdown', onPointerDown, { passive: false });
        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp, { passive: false });

        // Touch events (fallback for older mobile browsers)
        this.toyElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerDown({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (isDragging) {
                onPointerUp({
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        // Mouse events (fallback for older browsers)
        this.toyElement.addEventListener('mousedown', (e) => {
            onPointerDown(e);
        }, { passive: false });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                onPointerMove(e);
            }
        }, { passive: false });

        document.addEventListener('mouseup', (e) => {
            if (isDragging) {
                onPointerUp(e);
            }
        }, { passive: false });
    }

    handleBallKick(e) {
        console.log('⚽ Ball kicked!');

        // ✅ NEW: Add visual feedback for kick
        this.toyElement.style.transform = 'scale(1.2)';
        setTimeout(() => {
            this.toyElement.style.transform = '';
        }, 150);

        // ✅ UPDATED: Click position determines bounce direction (opposite of click)
        const ballRect = this.toyElement.getBoundingClientRect();
        const ballCenterX = ballRect.left + ballRect.width / 2;
        const clickX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : ballCenterX);

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

        // ✅ NEW: Add initial rotation impulse for more realistic kick
        if (this.currentToy && this.currentToy.id === 'toy_ball') {
            const ballRadius = this.toyElement.offsetWidth / 2;
            const initialRotationSpeed = this.toyPhysics.vx / ballRadius;
            this.toyPhysics.rotation += initialRotationSpeed * 0.5; // Add some initial spin
        }

        console.log(`⚽ Ball bouncing ${bounceDirection > 0 ? 'right' : 'left'} (clicked ${clickX < ballCenterX ? 'left' : 'right'} side)`);
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

        // ✅ UPDATED: Update ground level for teddy bear size
        this.toyPhysics.groundY = window.innerHeight - 60; // Teddy touches the bottom edge (120px height / 2)

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
        let dragStarted = false;
        let startX = 0;
        let startY = 0;
        const dragThreshold = 5; // Minimum pixels to move before starting drag

        // ✅ ENHANCED: Prevent default browser drag behavior
        this.toyElement.style.userSelect = 'none';
        this.toyElement.style.webkitUserSelect = 'none';
        this.toyElement.style.webkitUserDrag = 'none';
        this.toyElement.style.webkitTouchCallout = 'none';
        this.toyElement.draggable = false;

        // Prevent context menu on long press (mobile)
        this.toyElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Prevent image drag specifically
        this.toyElement.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });

        const onPointerDown = (e) => {
            // ✅ ENHANCED: Prevent all default behaviors immediately
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            dragStarted = false;
            startX = e.clientX;
            startY = e.clientY;

            const toyRect = this.toyElement.getBoundingClientRect();
            this.toyPhysics.dragOffset = {
                x: e.clientX - toyRect.left,
                y: e.clientY - toyRect.top
            };

            // ✅ FIXED: Let CSS handle cursor during play mode
            if (!document.body.classList.contains('play-mode-active')) {
                document.body.style.cursor = 'grabbing';
                this.toyElement.style.cursor = 'grabbing';
            }

            console.log('🧸 Pointer down on teddy bear');
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;

            // ✅ ENHANCED: Prevent all default behaviors during drag
            e.preventDefault();
            e.stopPropagation();

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Only start actual dragging after threshold is met
            if (!dragStarted && distance > dragThreshold) {
                dragStarted = true;
                this.toyPhysics.isDragging = true;

                // Stop physics while dragging
                this.toyPhysics.vx = 0;
                this.toyPhysics.vy = 0;

                // ✅ NEW: Add visual feedback for drag state
                this.toyElement.classList.add('dragging');
                this.toyElement.style.transform = 'scale(1.05)';
                this.toyElement.style.zIndex = '9999';
                this.toyElement.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';

                console.log('🧸 Started dragging teddy bear');
            }

            if (dragStarted) {
                // ✅ ENHANCED: Smooth position updates with bounds checking
                const newX = e.clientX - this.toyPhysics.dragOffset.x + this.toyElement.offsetWidth / 2;
                const newY = e.clientY - this.toyPhysics.dragOffset.y + this.toyElement.offsetHeight / 2;

                // Keep within screen bounds
                const minX = this.toyElement.offsetWidth / 2;
                const maxX = window.innerWidth - this.toyElement.offsetWidth / 2;
                const minY = this.toyElement.offsetHeight / 2;
                const maxY = window.innerHeight - this.toyElement.offsetHeight / 2;

                this.toyPhysics.x = Math.max(minX, Math.min(maxX, newX));
                this.toyPhysics.y = Math.max(minY, Math.min(maxY, newY));

                this.updateToyPosition();
            }
        };

        const onPointerUp = (e) => {
            if (!isDragging) return;

            // ✅ ENHANCED: Prevent default behaviors on release
            e.preventDefault();
            e.stopPropagation();

            isDragging = false;

            // ✅ FIXED: Let CSS handle cursor during play mode
            if (!document.body.classList.contains('play-mode-active')) {
                document.body.style.cursor = '';
                this.toyElement.style.cursor = 'grab';
            }
            this.toyElement.style.transform = '';
            this.toyElement.style.zIndex = '';
            this.toyElement.style.filter = '';

            if (dragStarted) {
                this.toyPhysics.isDragging = false;
                dragStarted = false;

                // ✅ NEW: Remove visual feedback for drag state
                this.toyElement.classList.remove('dragging');

                console.log('🧸 Stopped dragging teddy bear');
            }
        };

        // ✅ ENHANCED: Use both pointer and touch events for maximum compatibility

        // Pointer events (modern browsers)
        this.toyElement.addEventListener('pointerdown', onPointerDown, { passive: false });
        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp, { passive: false });

        // Touch events (fallback for older mobile browsers)
        this.toyElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerDown({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (isDragging) {
                onPointerUp({
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        // ✅ FIXED: Let CSS handle cursor during play mode
        if (!document.body.classList.contains('play-mode-active')) {
            this.toyElement.style.cursor = 'grab';
        }
    }

    setupTeddyHeartInteraction() {
        // This will be called during physics simulation to check for Blobbi collision
        // Implementation in the physics loop
    }

    // ✅ NEW: Setup behavior for building blocks
    setupBlocksBehavior() {
        console.log('🧱 Setting up building blocks physics and interactions');

        // ✅ NEW: Building blocks should be stackable and affected by gravity
        this.toyPhysics.gravity = 0.5; // Normal gravity
        this.toyPhysics.bounce = 0.2; // Low bounce for stability
        this.toyPhysics.friction = 0.9; // High friction for stacking

        // ✅ NEW: Scale blocks to be similar to ball size
        if (this.toyElement) {
            this.toyElement.style.width = '40px';
            this.toyElement.style.height = '40px';

            // ✅ NEW: Add specific data attribute for blocks
            this.toyElement.setAttribute('data-toy', 'blocks');
            this.toyElement.classList.add('companion-toy', 'blocks');
        }

        // ✅ UPDATED: Update ground level for blocks size
        this.toyPhysics.groundY = window.innerHeight - 20; // Blocks touch the bottom edge

        // Make blocks draggable like teddy bear
        this.setupBlocksDragInteraction();

        // Update toy element position
        this.updateToyPosition();
    }

    // ✅ NEW: Setup drag interaction for blocks (similar to teddy)
    setupBlocksDragInteraction() {
        if (!this.toyElement) return;

        // Use the same drag interaction as teddy bear
        this.setupGenericDragInteraction();
    }

    // ✅ NEW: Setup behavior for generic/unknown toys
    setupGenericToyBehavior() {
        console.log('🎾 Setting up generic toy physics and interactions');

        // ✅ NEW: Generic toys should have balanced physics
        this.toyPhysics.gravity = 0.5; // Normal gravity
        this.toyPhysics.bounce = 0.5; // Medium bounce
        this.toyPhysics.friction = 0.95; // Medium friction

        // ✅ NEW: Scale generic toys to medium size
        if (this.toyElement) {
            this.toyElement.style.width = '60px';
            this.toyElement.style.height = '60px';

            // ✅ NEW: Add generic data attribute
            this.toyElement.setAttribute('data-toy', 'generic');
            this.toyElement.classList.add('companion-toy', 'generic');
        }

        // ✅ UPDATED: Update ground level for generic toy size
        this.toyPhysics.groundY = window.innerHeight - 30; // Generic toy touches the bottom edge

        // Make generic toys draggable
        this.setupGenericDragInteraction();

        // Update toy element position
        this.updateToyPosition();
    }

    // ✅ NEW: Generic drag interaction for toys that don't need special behavior
    setupGenericDragInteraction() {
        if (!this.toyElement) return;

        let isDragging = false;
        let dragStarted = false;
        let startX = 0;
        let startY = 0;
        const dragThreshold = 5; // Minimum pixels to move before starting drag

        // ✅ ENHANCED: Prevent default browser drag behavior
        this.toyElement.style.userSelect = 'none';
        this.toyElement.style.webkitUserSelect = 'none';
        this.toyElement.style.webkitUserDrag = 'none';
        this.toyElement.style.webkitTouchCallout = 'none';
        this.toyElement.draggable = false;

        // Prevent context menu on long press (mobile)
        this.toyElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Prevent image drag specifically
        this.toyElement.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });

        const onPointerDown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            dragStarted = false;
            startX = e.clientX;
            startY = e.clientY;

            const toyRect = this.toyElement.getBoundingClientRect();
            this.toyPhysics.dragOffset = {
                x: e.clientX - toyRect.left,
                y: e.clientY - toyRect.top
            };

            // ✅ FIXED: Let CSS handle cursor during play mode
            if (!document.body.classList.contains('play-mode-active')) {
                document.body.style.cursor = 'grabbing';
                this.toyElement.style.cursor = 'grabbing';
            }

            console.log('🎾 Pointer down on generic toy');
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            e.stopPropagation();

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (!dragStarted && distance > dragThreshold) {
                dragStarted = true;
                this.toyPhysics.isDragging = true;

                this.toyPhysics.vx = 0;
                this.toyPhysics.vy = 0;

                this.toyElement.classList.add('dragging');
                this.toyElement.style.transform = 'scale(1.05)';
                this.toyElement.style.zIndex = '9999';
                this.toyElement.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';

                console.log('🎾 Started dragging generic toy');
            }

            if (dragStarted) {
                const newX = e.clientX - this.toyPhysics.dragOffset.x + this.toyElement.offsetWidth / 2;
                const newY = e.clientY - this.toyPhysics.dragOffset.y + this.toyElement.offsetHeight / 2;

                const minX = this.toyElement.offsetWidth / 2;
                const maxX = window.innerWidth - this.toyElement.offsetWidth / 2;
                const minY = this.toyElement.offsetHeight / 2;
                const maxY = window.innerHeight - this.toyElement.offsetHeight / 2;

                this.toyPhysics.x = Math.max(minX, Math.min(maxX, newX));
                this.toyPhysics.y = Math.max(minY, Math.min(maxY, newY));

                this.updateToyPosition();
            }
        };

        const onPointerUp = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            e.stopPropagation();

            isDragging = false;

            // ✅ FIXED: Let CSS handle cursor during play mode
            if (!document.body.classList.contains('play-mode-active')) {
                document.body.style.cursor = '';
                this.toyElement.style.cursor = 'grab';
            }
            this.toyElement.style.transform = '';
            this.toyElement.style.zIndex = '';
            this.toyElement.style.filter = '';

            if (dragStarted) {
                this.toyPhysics.isDragging = false;
                dragStarted = false;

                this.toyElement.classList.remove('dragging');

                console.log('🎾 Stopped dragging generic toy');
            }
        };

        // Add event listeners
        this.toyElement.addEventListener('pointerdown', onPointerDown, { passive: false });
        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp, { passive: false });

        // Touch events fallback
        this.toyElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerDown({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (isDragging) {
                onPointerUp({
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        // Set initial cursor style
        this.toyElement.style.cursor = 'grab';
    }

    startPhysicsSimulation() {
        if (this.physicsInterval) {
            clearInterval(this.physicsInterval);
        }

        console.log('🎮 Starting physics simulation');

        // ✅ NEW: Add physics-active class to disable CSS transitions during simulation
        if (this.toyElement) {
            this.toyElement.classList.add('physics-active');
        }

        this.physicsInterval = setInterval(() => {
            this.updateToyPhysics();
            this.checkToyCollisions();
        }, 16); // ~60 FPS
    }

    // ✅ NEW: Initialize Blobbi physics system
    initializeBlobbiPhysics() {
        // Get current Blobbi position and convert to physics coordinates
        const blobbiRect = this.character.getBoundingClientRect();
        const centerX = blobbiRect.left + blobbiRect.width / 2;
        const centerY = blobbiRect.top + blobbiRect.height / 2;

        // Initialize Blobbi physics state
        this.blobbiPhysics = {
            x: centerX,
            y: centerY,
            vx: 0,
            vy: 0,
            gravity: 0.5,
            bounce: 0.6,
            friction: 0.98,
            groundY: window.innerHeight - 60, // Blobbi touches the bottom edge (120px height / 2)
            isDragging: false,
            isPhysicsActive: true
        };

        console.log('🎯 Blobbi physics initialized at:', { x: centerX, y: centerY, groundY: this.blobbiPhysics.groundY });
    }

    // ✅ NEW: Start Blobbi physics simulation
    startBlobbiPhysics() {
        if (this.blobbiPhysicsInterval) {
            clearInterval(this.blobbiPhysicsInterval);
        }

        if (!this.blobbiPhysics.isPhysicsActive) return;

        console.log('🌍 Starting Blobbi physics simulation');

        // Add physics class to Blobbi
        this.container.classList.add('physics-active');

        this.blobbiPhysicsInterval = setInterval(() => {
            this.updateBlobbiPhysics();
        }, 16); // ~60 FPS
    }

    // ✅ NEW: Stop Blobbi physics simulation
    stopBlobbiPhysics() {
        if (this.blobbiPhysicsInterval) {
            clearInterval(this.blobbiPhysicsInterval);
            this.blobbiPhysicsInterval = null;
        }

        console.log('🛑 Stopped Blobbi physics simulation');
    }

    // ✅ NEW: Update Blobbi physics
    updateBlobbiPhysics() {
        if (!this.blobbiPhysics.isPhysicsActive || this.blobbiPhysics.isDragging) return;

        // Apply gravity
        this.blobbiPhysics.vy += this.blobbiPhysics.gravity;

        // Apply velocity
        this.blobbiPhysics.x += this.blobbiPhysics.vx;
        this.blobbiPhysics.y += this.blobbiPhysics.vy;

        // Apply friction
        this.blobbiPhysics.vx *= this.blobbiPhysics.friction;

        // Ground collision
        if (this.blobbiPhysics.y >= this.blobbiPhysics.groundY) {
            this.blobbiPhysics.y = this.blobbiPhysics.groundY;
            this.blobbiPhysics.vy *= -this.blobbiPhysics.bounce;

            // Stop small bounces
            if (Math.abs(this.blobbiPhysics.vy) < 1) {
                this.blobbiPhysics.vy = 0;

                // ✅ FIXED: When Blobbi lands and stops bouncing, enable toy interactions but keep physics
                if (Math.abs(this.blobbiPhysics.vx) < 0.5 && !this.toyInteractionInterval) {
                    this.transitionToBottomAreaMovement();
                }
            }

            // ✅ NEW: Add occasional random movement impulses when on ground to keep things interesting
            if (this.blobbiPhysics.vy === 0 && Math.abs(this.blobbiPhysics.vx) < 0.5) {
                // 1% chance per frame to add a small random impulse
                if (Math.random() < 0.01) {
                    this.blobbiPhysics.vx += (Math.random() - 0.5) * 2; // Small random horizontal impulse
                    console.log('🎯 Blobbi got a random movement impulse while on ground');
                }
            }
        }

        // Wall collisions
        const blobbiWidth = 120;
        if (this.blobbiPhysics.x <= blobbiWidth / 2) {
            this.blobbiPhysics.x = blobbiWidth / 2;
            this.blobbiPhysics.vx *= -this.blobbiPhysics.bounce;
        } else if (this.blobbiPhysics.x >= window.innerWidth - blobbiWidth / 2) {
            this.blobbiPhysics.x = window.innerWidth - blobbiWidth / 2;
            this.blobbiPhysics.vx *= -this.blobbiPhysics.bounce;
        }

        // Update Blobbi's visual position
        this.updateBlobbiPosition();
    }

    // ✅ NEW: Update Blobbi's visual position from physics
    updateBlobbiPosition() {
        // Convert physics coordinates back to position system
        // position.x is distance from right edge, position.y is distance from bottom edge
        this.position.x = window.innerWidth - this.blobbiPhysics.x - 60; // 60 is half of Blobbi's width
        this.position.y = window.innerHeight - this.blobbiPhysics.y - 60; // 60 is half of Blobbi's height

        // Keep within bounds
        this.position.x = Math.max(0, Math.min(window.innerWidth - 120, this.position.x));
        this.position.y = Math.max(0, Math.min(window.innerHeight - 120, this.position.y));

        this.updatePosition();
    }

    // ✅ FIXED: Keep physics active but enable toy interactions
    transitionToBottomAreaMovement() {
        console.log('🎯 Blobbi landed! Physics stays active, enabling toy interactions');

        // ✅ FIXED: Keep physics simulation running - don't stop it!
        // this.stopBlobbiPhysics(); // REMOVED - keep physics active
        // this.blobbiPhysics.isPhysicsActive = false; // REMOVED - keep physics active

        // Remove falling class but keep physics-active
        this.container.classList.remove('falling');
        this.container.classList.add('landed', 'bottom-area');

        // ✅ FIXED: Don't enable bottom area movement - physics handles movement now
        // this.enableBottomAreaMovement(); // REMOVED - physics handles movement

        // Enable toy interactions
        this.startToyInteractionBehavior();
    }

    updateToyPhysics() {
        if (!this.toyElement || this.toyPhysics.isDragging) return;

        // Apply gravity
        this.toyPhysics.vy += this.toyPhysics.gravity;

        // Apply velocity
        this.toyPhysics.x += this.toyPhysics.vx;
        this.toyPhysics.y += this.toyPhysics.vy;

        // ✅ NEW: Calculate rolling rotation for ball
        if (this.currentToy && this.currentToy.id === 'toy_ball') {
            // Calculate rotation based on horizontal movement
            // Rotation speed is proportional to horizontal velocity
            const ballRadius = this.toyElement.offsetWidth / 2;
            const rotationIncrement = this.toyPhysics.vx / ballRadius; // Realistic rolling physics
            this.toyPhysics.rotation += rotationIncrement;

            // Store rotation speed for visual effects
            this.toyPhysics.rotationSpeed = Math.abs(rotationIncrement);
        }

        // Apply friction
        this.toyPhysics.vx *= this.toyPhysics.friction;

        // ✅ UPDATED: Ground collision with proper positioning
        const toyHeight = this.toyElement.offsetHeight;
        const groundY = window.innerHeight - toyHeight / 2; // Toy touches the bottom edge

        if (this.toyPhysics.y >= groundY) {
            const collisionIntensity = Math.abs(this.toyPhysics.vy) / 10;
            if (collisionIntensity > 0.1) {
                this.playBallKickSound(collisionIntensity);
            }
            this.toyPhysics.y = groundY;
            this.toyPhysics.vy *= -this.toyPhysics.bounce;

            // Stop small bounces
            if (Math.abs(this.toyPhysics.vy) < 1) {
                this.toyPhysics.vy = 0;
            }

            // ✅ NEW: Add slight rotation damping when ball is on ground
            if (this.currentToy && this.currentToy.id === 'toy_ball' && Math.abs(this.toyPhysics.vx) < 0.5) {
                this.toyPhysics.rotationSpeed *= 0.95; // Gradually slow down rotation
            }
        }

        // Wall collisions
        const toyWidth = this.toyElement.offsetWidth;
        if (this.toyPhysics.x <= toyWidth / 2) {
            const collisionIntensity = Math.abs(this.toyPhysics.vx) / 10;
            if (collisionIntensity > 0.1) {
                this.playBallKickSound(collisionIntensity);
            }
            this.toyPhysics.x = toyWidth / 2;
            this.toyPhysics.vx *= -this.toyPhysics.bounce;
        } else if (this.toyPhysics.x >= window.innerWidth - toyWidth / 2) {
            const collisionIntensity = Math.abs(this.toyPhysics.vx) / 10;
            if (collisionIntensity > 0.1) {
                this.playBallKickSound(collisionIntensity);
            }
            this.toyPhysics.x = window.innerWidth - toyWidth / 2;
            this.toyPhysics.vx *= -this.toyPhysics.bounce;
        }

        // Update visual position and rotation
        this.updateToyPosition();
    }

    updateToyPosition() {
        if (!this.toyElement) return;

        const toyWidth = this.toyElement.offsetWidth;
        const toyHeight = this.toyElement.offsetHeight;

        this.toyElement.style.left = `${this.toyPhysics.x - toyWidth / 2}px`;
        this.toyElement.style.top = `${this.toyPhysics.y - toyHeight / 2}px`;

        // ✅ NEW: Apply rolling rotation for ball
        if (this.currentToy && this.currentToy.id === 'toy_ball') {
            const rotationDegrees = this.toyPhysics.rotation * (180 / Math.PI); // Convert radians to degrees

            // Find the image element inside the toy element
            const ballImage = this.toyElement.querySelector('img');
            if (ballImage) {
                ballImage.style.transform = `rotate(${rotationDegrees}deg)`;

                // ✅ NEW: Add subtle motion blur effect when ball is moving fast
                if (this.toyPhysics.rotationSpeed > 0.1) {
                    const blurAmount = Math.min(this.toyPhysics.rotationSpeed * 2, 3); // Max 3px blur
                    ballImage.style.filter = `blur(${blurAmount}px)`;
                } else {
                    ballImage.style.filter = '';
                }
            } else {
                // Fallback for emoji-based ball
                this.toyElement.style.transform = `rotate(${rotationDegrees}deg)`;
            }
        }
    }

    // ✅ FIXED: Reliable collision detection with debouncing
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

        // ✅ FIXED: Improved collision thresholds and debouncing
        const collisionThreshold = this.currentToy.id === 'toy_teddy' ? 90 : 55;

        // ✅ FIXED: Add collision debouncing to prevent flickering
        const now = Date.now();
        const collisionCooldown = 1000; // 1 second between collision triggers

        if (distance < collisionThreshold) {
            // ✅ FIXED: Don't trigger collision if intentionally approaching or in cooldown
            if (!this.isApproachingToy &&
                (!this.lastCollisionTime || now - this.lastCollisionTime > collisionCooldown)) {

                this.lastCollisionTime = now;
                this.handleToyCollision();

                console.log(`💥 Collision detected! Distance: ${Math.round(distance)}px, Threshold: ${collisionThreshold}px`);
            }
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

        const collisionIntensity = Math.sqrt(this.toyPhysics.vx * this.toyPhysics.vx + this.toyPhysics.vy * this.toyPhysics.vy) / 10;
        this.playBallKickSound(collisionIntensity);

        // Add some randomness to make it more fun
        this.toyPhysics.vx += (Math.random() - 0.5) * 2;

        // ✅ NEW: Add rotation impulse when Blobbi kicks the ball
        if (this.currentToy && this.currentToy.id === 'toy_ball') {
            const ballRadius = this.toyElement.offsetWidth / 2;
            const kickRotationSpeed = this.toyPhysics.vx / ballRadius;
            this.toyPhysics.rotation += kickRotationSpeed * 0.3; // Add some spin from the kick
        }
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

    // ✅ NEW: Floating block selection menu methods
    createFloatingBlockMenu() {
        console.log('🧱 Creating floating block selection menu');

        // Remove any existing menu
        if (this.blockSelectionMenu) {
            this.blockSelectionMenu.remove();
        }

        // Create floating menu container similar to main floating menu
        this.blockSelectionMenu = document.createElement('div');
        this.blockSelectionMenu.className = 'floating-block-menu';
        this.blockSelectionMenu.setAttribute('data-floating-block-menu', 'true');

        // ✅ NEW: Load saved position or use default
        const savedPosition = this.getBlockMenuPosition();

        // Position it on the left side of the screen
        this.blockSelectionMenu.style.cssText = `
            position: fixed;
            left: ${savedPosition.x}px;
            top: ${savedPosition.y}px;
            z-index: 10000;
            user-select: none;
            touch-action: none;
        `;

        // Create main menu button (blocks icon)
        const mainButton = this.createMainBlockButton();
        this.blockSelectionMenu.appendChild(mainButton);

        // Create expandable menu container
        const menuContainer = this.createBlockMenuContainer();
        this.blockSelectionMenu.appendChild(menuContainer);

        // ✅ NEW: Make the menu draggable
        this.setupBlockMenuDrag();

        document.body.appendChild(this.blockSelectionMenu);

        console.log('🧱 Floating block menu created and positioned');
    }

    // ✅ NEW: Get saved block menu position or default
    getBlockMenuPosition() {
        const saved = localStorage.getItem('blobbi-block-menu-position');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (error) {
                console.error('Failed to parse saved block menu position:', error);
            }
        }
        return { x: 20, y: window.innerHeight / 2 - 28 }; // Default position
    }

    // ✅ NEW: Save block menu position
    saveBlockMenuPosition(position) {
        localStorage.setItem('blobbi-block-menu-position', JSON.stringify(position));
    }

    // ✅ NEW: Setup drag functionality for block menu
    setupBlockMenuDrag() {
        if (!this.blockSelectionMenu) return;

        let isDragging = false;
        let dragStarted = false;
        let startX = 0;
        let startY = 0;
        let startMenuX = 0;
        let startMenuY = 0;
        const dragThreshold = 5;

        const onPointerDown = (e) => {
            // Only allow dragging from the main button, not the menu items
            if (!e.target.closest('.block-menu-main-button')) return;

            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            dragStarted = false;
            startX = e.clientX;
            startY = e.clientY;

            const rect = this.blockSelectionMenu.getBoundingClientRect();
            startMenuX = rect.left;
            startMenuY = rect.top;

            this.blockSelectionMenu.style.cursor = 'grabbing';
            console.log('🧱 Started dragging block menu');
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            e.stopPropagation();

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (!dragStarted && distance > dragThreshold) {
                dragStarted = true;
                console.log('🧱 Block menu drag confirmed');

                // Close menu if open during drag
                this.toggleBlockMenu(false);
            }

            if (dragStarted) {
                const newX = startMenuX + deltaX;
                const newY = startMenuY + deltaY;

                // Keep within screen bounds
                const menuWidth = 56; // Main button width
                const menuHeight = 56; // Main button height
                const maxX = window.innerWidth - menuWidth;
                const maxY = window.innerHeight - menuHeight;

                const boundedX = Math.max(0, Math.min(maxX, newX));
                const boundedY = Math.max(0, Math.min(maxY, newY));

                this.blockSelectionMenu.style.left = `${boundedX}px`;
                this.blockSelectionMenu.style.top = `${boundedY}px`;
            }
        };

        const onPointerUp = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            e.stopPropagation();

            isDragging = false;
            this.blockSelectionMenu.style.cursor = '';

            if (dragStarted) {
                // Save new position
                const rect = this.blockSelectionMenu.getBoundingClientRect();
                this.saveBlockMenuPosition({ x: rect.left, y: rect.top });
                dragStarted = false;
                console.log('🧱 Block menu drag completed and position saved');
            } else {
                // This was a click, not a drag - let the button handle it
                console.log('🧱 Block menu clicked (not dragged)');
            }
        };

        // Add event listeners
        this.blockSelectionMenu.addEventListener('pointerdown', onPointerDown, { passive: false });
        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp, { passive: false });

        // Touch events fallback
        this.blockSelectionMenu.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerDown({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    target: e.target,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (isDragging) {
                onPointerUp({
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });
    }

    createMainBlockButton() {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'block-menu-main-button';
        buttonContainer.style.cssText = `
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border: 2px solid rgba(147, 51, 234, 0.3);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            transition: all 0.2s ease;
            position: relative;
        `;

        // ✅ NEW: Use p-5.svg as the icon instead of emoji
        const icon = document.createElement('img');
        icon.src = '/companion/assets/toys/pieces/p-5.svg';
        icon.alt = 'Build Blocks';
        icon.style.cssText = `
            width: 28px;
            height: 28px;
            pointer-events: none;
            user-select: none;
        `;
        icon.draggable = false;
        buttonContainer.appendChild(icon);

        // Add pulsing animation
        const pulseRing = document.createElement('div');
        pulseRing.style.cssText = `
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: rgba(147, 51, 234, 0.2);
            animation: blockMenuPulse 2s infinite ease-in-out;
        `;
        buttonContainer.appendChild(pulseRing);

        // Add pulse animation keyframes
        if (!document.querySelector('#block-menu-pulse-animation')) {
            const style = document.createElement('style');
            style.id = 'block-menu-pulse-animation';
            style.textContent = `
                @keyframes blockMenuPulse {
                    0%, 100% { transform: scale(1); opacity: 0.2; }
                    50% { transform: scale(1.2); opacity: 0.1; }
                }
            `;
            document.head.appendChild(style);
        }

        // ✅ FIXED: Improved click handling to prevent conflicts with drag
        let clickTimeout = null;

        buttonContainer.addEventListener('click', (e) => {
            // Only handle click if it's not part of a drag operation
            if (!e.target.closest('.block-menu-main-button')) return;

            // Clear any existing timeout
            if (clickTimeout) {
                clearTimeout(clickTimeout);
            }

            // Delay the toggle to allow drag detection to work
            clickTimeout = setTimeout(() => {
                this.blockMenuOpen = !this.blockMenuOpen;
                this.toggleBlockMenu(this.blockMenuOpen);
                clickTimeout = null;
            }, 50);
        });

        // ✅ ENHANCED: Better hover effects with grab cursor
        buttonContainer.addEventListener('mouseenter', () => {
            buttonContainer.style.transform = 'scale(1.05)';
            buttonContainer.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.15)';
            buttonContainer.style.cursor = 'grab';
        });

        buttonContainer.addEventListener('mouseleave', () => {
            buttonContainer.style.transform = 'scale(1)';
            buttonContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        });

        // ✅ NEW: Handle active state for grabbing cursor
        buttonContainer.addEventListener('mousedown', () => {
            buttonContainer.style.cursor = 'grabbing';
        });

        buttonContainer.addEventListener('mouseup', () => {
            buttonContainer.style.cursor = 'grab';
        });

        return buttonContainer;
    }

    createBlockMenuContainer() {
        const container = document.createElement('div');
        container.className = 'block-menu-container';
        container.style.cssText = `
            position: absolute;
            left: 70px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border: 2px solid rgba(147, 51, 234, 0.3);
            border-radius: 12px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            display: none;
            opacity: 0;
            transition: all 0.3s ease;
        `;

        // Create grid for block buttons
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        `;

        // Add block buttons (p-1 to p-9)
        for (let i = 1; i <= 9; i++) {
            const blockButton = this.createFloatingBlockButton(i);
            grid.appendChild(blockButton);
        }

        container.appendChild(grid);
        return container;
    }

    createFloatingBlockButton(blockNumber) {
        const button = document.createElement('button');
        button.className = `floating-block-button block-${blockNumber}`;

        const blockType = `p-${blockNumber}`;
        const spawnedCount = this.spawnedBlocks.get(blockType) || 0;
        const isDisabled = spawnedCount >= this.maxBlocksPerType;

        button.style.cssText = `
            width: 44px;
            height: 44px;
            border: 2px solid ${isDisabled ? '#d1d5db' : '#8b5cf6'};
            border-radius: 8px;
            background: ${isDisabled ? '#f3f4f6' : 'white'};
            cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            opacity: ${isDisabled ? '0.5' : '1'};
            padding: 0;
            margin: 0;
            outline: none;
            user-select: none;
            -webkit-user-select: none;
            -webkit-user-drag: none;
            -webkit-touch-callout: none;
            touch-action: manipulation;
        `;

        // Add block image
        const img = document.createElement('img');
        img.src = `/companion/assets/toys/pieces/p-${blockNumber}.svg`;
        img.alt = `Block ${blockNumber}`;
        img.style.cssText = `
            width: 32px;
            height: 32px;
            pointer-events: none;
            user-select: none;
            -webkit-user-select: none;
            -webkit-user-drag: none;
            -webkit-touch-callout: none;
            padding: 0;
            margin: 0;
            border: none;
            outline: none;
            display: block;
        `;
        img.draggable = false;

        button.appendChild(img);

        // Add count badge if any blocks are spawned
        if (spawnedCount > 0) {
            const countBadge = document.createElement('div');
            countBadge.textContent = `${spawnedCount}`;
            countBadge.style.cssText = `
                position: absolute;
                top: -6px;
                right: -6px;
                background: ${isDisabled ? '#ef4444' : '#10b981'};
                color: white;
                border-radius: 8px;
                padding: 2px 4px;
                font-size: 10px;
                font-weight: 600;
                min-width: 16px;
                text-align: center;
                line-height: 1;
                pointer-events: none;
            `;
            button.appendChild(countBadge);
        }

        if (!isDisabled) {
            // ✅ ENHANCED: Better event handling to prevent conflicts
            button.addEventListener('mouseenter', () => {
                button.style.background = '#f3f4f6';
                button.style.transform = 'scale(1.05)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.background = 'white';
                button.style.transform = 'scale(1)';
            });

            // ✅ FIXED: Improved click handling with proper event management
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                console.log(`🧱 Spawning block ${blockNumber}`);
                this.spawnBlock(blockNumber);

                // ✅ UPDATED: Don't auto-close menu after spawning - let user continue building
                // Menu will stay open until user clicks outside or clicks the main button again
            });

            // ✅ NEW: Add touch event handling for better mobile support
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                button.style.background = '#e5e7eb';
                button.style.transform = 'scale(0.95)';
            });

            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();

                button.style.background = '#f3f4f6';
                button.style.transform = 'scale(1.05)';

                // Trigger the spawn action
                setTimeout(() => {
                    console.log(`🧱 Spawning block ${blockNumber} (touch)`);
                    this.spawnBlock(blockNumber);
                    // ✅ UPDATED: Don't auto-close menu on touch either
                }, 50);
            });
        }

        return button;
    }

    toggleBlockMenu(isOpen) {
        const container = this.blockSelectionMenu.querySelector('.block-menu-container');
        if (!container) return;

        if (isOpen) {
            container.style.display = 'block';
            // Update button states before showing
            this.updateFloatingBlockMenu();
            setTimeout(() => {
                container.style.opacity = '1';
                container.style.transform = 'translateY(-50%) scale(1)';
            }, 10);

            // ✅ NEW: Add click outside listener to close menu
            this.setupBlockMenuOutsideClickListener();
        } else {
            container.style.opacity = '0';
            container.style.transform = 'translateY(-50%) scale(0.9)';
            setTimeout(() => {
                container.style.display = 'none';
            }, 300);

            // ✅ NEW: Remove click outside listener
            this.removeBlockMenuOutsideClickListener();
        }
    }

    // ✅ NEW: Setup click outside listener for block menu
    setupBlockMenuOutsideClickListener() {
        // Remove any existing listener first
        this.removeBlockMenuOutsideClickListener();

        this.blockMenuOutsideClickListener = (e) => {
            // Check if click is outside the block menu
            if (!this.blockSelectionMenu.contains(e.target)) {
                this.blockMenuOpen = false;
                this.toggleBlockMenu(false);
            }
        };

        // Add listener with a small delay to prevent immediate closure
        setTimeout(() => {
            document.addEventListener('click', this.blockMenuOutsideClickListener, true);
        }, 100);
    }

    // ✅ NEW: Remove click outside listener for block menu
    removeBlockMenuOutsideClickListener() {
        if (this.blockMenuOutsideClickListener) {
            document.removeEventListener('click', this.blockMenuOutsideClickListener, true);
            this.blockMenuOutsideClickListener = null;
        }
    }

    updateFloatingBlockMenu() {
        if (!this.blockSelectionMenu) return;

        // Update all block buttons
        for (let i = 1; i <= 9; i++) {
            const button = this.blockSelectionMenu.querySelector(`.block-${i}`);
            if (button) {
                const blockType = `p-${i}`;
                const spawnedCount = this.spawnedBlocks.get(blockType) || 0;
                const isDisabled = spawnedCount >= this.maxBlocksPerType;

                // Update button appearance
                button.style.border = `2px solid ${isDisabled ? '#d1d5db' : '#8b5cf6'}`;
                button.style.background = isDisabled ? '#f3f4f6' : 'white';
                button.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
                button.style.opacity = isDisabled ? '0.5' : '1';
                button.disabled = isDisabled;

                // Update or add count badge
                let countBadge = button.querySelector('.count-badge');
                if (spawnedCount > 0) {
                    if (!countBadge) {
                        countBadge = document.createElement('div');
                        countBadge.className = 'count-badge';
                        countBadge.style.cssText = `
                            position: absolute;
                            top: -6px;
                            right: -6px;
                            color: white;
                            border-radius: 8px;
                            padding: 2px 4px;
                            font-size: 10px;
                            font-weight: 600;
                            min-width: 16px;
                            text-align: center;
                            line-height: 1;
                        `;
                        button.appendChild(countBadge);
                    }
                    countBadge.textContent = spawnedCount;
                    countBadge.style.background = isDisabled ? '#ef4444' : '#10b981';
                } else if (countBadge) {
                    countBadge.remove();
                }
            }
        }
    }

    createBlockButton(blockNumber) {
        const button = document.createElement('button');
        button.className = `block-button block-${blockNumber}`;

        // Check how many of this block type are already spawned
        const spawnedCount = this.spawnedBlocks.get(`p-${blockNumber}`) || 0;
        const isDisabled = spawnedCount >= this.maxBlocksPerType;

        button.style.cssText = `
            width: 60px;
            height: 60px;
            border: 2px solid ${isDisabled ? '#d1d5db' : '#8b5cf6'};
            border-radius: 8px;
            background: ${isDisabled ? '#f3f4f6' : 'white'};
            cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            opacity: ${isDisabled ? '0.5' : '1'};
        `;

        // Add block image
        const img = document.createElement('img');
        img.src = `/companion/assets/toys/pieces/p-${blockNumber}.svg`;
        img.alt = `Block ${blockNumber}`;
        img.style.cssText = `
            width: 40px;
            height: 40px;
            pointer-events: none;
            user-select: none;
        `;
        img.draggable = false;

        button.appendChild(img);

        // Add count indicator if any blocks are spawned
        if (spawnedCount > 0) {
            const countBadge = document.createElement('div');
            countBadge.textContent = `${spawnedCount}/${this.maxBlocksPerType}`;
            countBadge.style.cssText = `
                position: absolute;
                top: -8px;
                right: -8px;
                background: ${isDisabled ? '#ef4444' : '#10b981'};
                color: white;
                border-radius: 10px;
                padding: 2px 6px;
                font-size: 10px;
                font-weight: 600;
                min-width: 20px;
                text-align: center;
            `;
            button.appendChild(countBadge);
        }

        if (!isDisabled) {
            button.addEventListener('mouseenter', () => {
                button.style.background = '#f3f4f6';
                button.style.transform = 'scale(1.05)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.background = 'white';
                button.style.transform = 'scale(1)';
            });
            button.addEventListener('click', () => {
                this.spawnBlock(blockNumber);
            });
        }

        return button;
    }

    // ✅ NEW: Build Blocks System - Isolated physics and collision logic
    activateBuildBlocksSystem() {
        console.log('🧱 Activating Build Blocks System (isolated from other toys)');

        // Set play mode state
        this.isPlayMode = true;
        this.wasInPlayMode = true;

        // Stop all current behaviors
        this.stopFreeRoam();
        this.stopMoving();
        this.stopFocusedFeeding();

        // Initialize Build Blocks system
        this.buildBlocksSystem.isActive = true;
        this.buildBlocksSystem.groundLevel = window.innerHeight;

        // Apply gravity to Blobbi using existing Planck.js system
        this.applyGravityToBlobbi();

        // Start Build Blocks specific animation loop
        this.startBuildBlocksLoop();
    }

    // ✅ NEW: Build Blocks specific animation loop
    startBuildBlocksLoop() {
        if (this.buildBlocksSystem.animationFrame) {
            cancelAnimationFrame(this.buildBlocksSystem.animationFrame);
        }

        console.log('🧱 Starting Build Blocks animation loop');

        const loop = () => {
            if (!this.buildBlocksSystem.isActive) return;

            // Update all build blocks
            this.updateAllBuildBlocks();

            // Check collisions between all build blocks
            this.checkBuildBlocksCollisions();

            // Continue the loop
            this.buildBlocksSystem.animationFrame = requestAnimationFrame(loop);
        };

        this.buildBlocksSystem.animationFrame = requestAnimationFrame(loop);
    }

    // ✅ NEW: Update all build blocks physics
    updateAllBuildBlocks() {
        this.buildBlocksSystem.blocks.forEach((blockData) => {
            if (!blockData.isDragging) {
                // ✅ NEW: Continuously check if static blocks are still supported
                if (blockData.isStatic) {
                    this.checkBlockSupport(blockData);
                }

                this.updateBuildBlockPhysics(blockData);
            }
        });
    }

    // ✅ NEW: Continuously check if a static block is still supported by another block
    checkBlockSupport(blockData) {
        // Only check static blocks that are not on the ground
        if (!blockData.isStatic || blockData.y >= this.buildBlocksSystem.groundLevel - blockData.height) {
            return; // Block is on ground or not static, no need to check
        }

        // Check if this block is still touching the top of another block
        const isStillSupported = this.isBlockStillSupported(blockData);

        if (!isStillSupported) {
            // Block is no longer supported - reactivate gravity
            console.log(`🧱 Block ${blockData.type} is no longer supported - reactivating gravity!`);
            blockData.isStatic = false;
            blockData.supportedBy = null;
            // Give it a small initial downward velocity to start falling
            blockData.vy = 0.1;
        }
    }

    // ✅ NEW: Check if a block is still supported by another block below it
    isBlockStillSupported(blockData) {
        const blockRect = {
            left: blockData.x,
            right: blockData.x + blockData.width,
            top: blockData.y,
            bottom: blockData.y + blockData.height
        };

        // Check against all other blocks to see if any are supporting this one
        let hasSupport = false;

        this.buildBlocksSystem.blocks.forEach((otherBlock) => {
            if (otherBlock === blockData || otherBlock.isDragging) return;

            const otherRect = {
                left: otherBlock.x,
                right: otherBlock.x + otherBlock.width,
                top: otherBlock.y,
                bottom: otherBlock.y + otherBlock.height
            };

            // Check if this block's bottom is touching (or very close to) the other block's top
            const horizontalOverlap = blockRect.right > otherRect.left && blockRect.left < otherRect.right;
            const verticalContact = Math.abs(blockRect.bottom - otherRect.top) <= this.buildBlocksSystem.stackTolerance;

            // Also check that this block is actually above the other block
            const isAbove = blockRect.bottom <= otherRect.top + this.buildBlocksSystem.stackTolerance;

            if (horizontalOverlap && verticalContact && isAbove) {
                hasSupport = true;
                return; // Found support, can exit early
            }
        });

        return hasSupport;
    }

    // ✅ IMPROVED: Enhanced build block physics with precise stacking detection
    updateBuildBlockPhysics(blockData) {
        // Skip physics if block is static (grounded or resting on another block)
        if (blockData.isStatic) {
            return; // Completely skip physics for static blocks
        }

        // Apply gravity
        blockData.vy += this.buildBlocksSystem.gravity;

        // Apply velocity
        blockData.x += blockData.vx;
        blockData.y += blockData.vy;

        // Apply friction
        blockData.vx *= this.buildBlocksSystem.friction;

        // ✅ NEW: Check for stacking collision BEFORE updating position
        const stackingCollision = this.checkBlockStackingCollision(blockData);
        if (stackingCollision) {
            // Block is landing on another block - make it static immediately
            blockData.y = stackingCollision.landingY;

            // ✅ NEW: Play wood-block sound when block lands on another block
            const collisionIntensity = Math.abs(blockData.vy) / 10;
            if (collisionIntensity > 0.1) {
                this.playWoodBlockSound(collisionIntensity);
            }

            blockData.vy = 0;
            blockData.vx = 0;
            blockData.isStatic = true;
            blockData.supportedBy = stackingCollision.supportBlock;

            console.log(`🧱 Block ${blockData.type} landed on ${stackingCollision.supportBlock.type} and became static`);
        }

        // Ground collision detection
        const groundY = this.buildBlocksSystem.groundLevel - blockData.height;
        if (blockData.y >= groundY) {
            blockData.y = groundY;

            // ✅ NEW: Play wood-block sound when block hits ground
            const collisionIntensity = Math.abs(blockData.vy) / 10;
            if (collisionIntensity > 0.1) {
                this.playWoodBlockSound(collisionIntensity);
            }

            blockData.vy = 0;
            blockData.vx = 0;
            blockData.isStatic = true;

            console.log(`🧱 Block ${blockData.type} landed on ground and became static`);
        }

        // Wall collisions
        if (blockData.x <= 0) {
            blockData.x = 0;

            // ✅ NEW: Play wood-block sound when block hits left wall
            const collisionIntensity = Math.abs(blockData.vx) / 10;
            if (collisionIntensity > 0.1) {
                this.playWoodBlockSound(collisionIntensity);
            }

            blockData.vx = 0;
        } else if (blockData.x >= window.innerWidth - blockData.width) {
            blockData.x = window.innerWidth - blockData.width;

            // ✅ NEW: Play wood-block sound when block hits right wall
            const collisionIntensity = Math.abs(blockData.vx) / 10;
            if (collisionIntensity > 0.1) {
                this.playWoodBlockSound(collisionIntensity);
            }

            blockData.vx = 0;
        }

        // Update visual position
        blockData.element.style.left = `${blockData.x}px`;
        blockData.element.style.top = `${blockData.y}px`;
    }

    // ✅ IMPROVED: Enhanced collision detection with precise stacking logic
    checkBuildBlocksCollisions() {
        // Check Blobbi vs build blocks collisions
        if (this.blobbiPhysics && this.blobbiPhysics.isPhysicsActive) {
            this.checkBlobbiVsBuildBlocks();
        }

        // ✅ NEW: Check for side-to-side collisions between blocks (not stacking)
        const blockArray = Array.from(this.buildBlocksSystem.blocks.values());

        for (let i = 0; i < blockArray.length; i++) {
            for (let j = i + 1; j < blockArray.length; j++) {
                const block1 = blockArray[i];
                const block2 = blockArray[j];

                // Skip if either block is being dragged
                if (block1.isDragging || block2.isDragging) continue;

                // Check for horizontal (side-to-side) collisions only
                if (this.checkHorizontalBlockCollision(block1, block2)) {
                    this.handleHorizontalBlockCollision(block1, block2);
                }
            }
        }
    }

    // ✅ NEW: Check if a falling block should land on another block
    checkBlockStackingCollision(fallingBlock) {
        // Only check for blocks that are falling (have downward velocity)
        if (fallingBlock.vy <= 0 || fallingBlock.isStatic) {
            return null;
        }

        const fallingRect = {
            left: fallingBlock.x,
            right: fallingBlock.x + fallingBlock.width,
            top: fallingBlock.y,
            bottom: fallingBlock.y + fallingBlock.height
        };

        let bestLanding = null;
        let highestSupportY = this.buildBlocksSystem.groundLevel;

        // Check against all other blocks
        this.buildBlocksSystem.blocks.forEach((otherBlock) => {
            if (otherBlock === fallingBlock || otherBlock.isDragging) return;

            const otherRect = {
                left: otherBlock.x,
                right: otherBlock.x + otherBlock.width,
                top: otherBlock.y,
                bottom: otherBlock.y + otherBlock.height
            };

            // Check if falling block's bottom is touching or overlapping other block's top
            const horizontalOverlap = fallingRect.right > otherRect.left && fallingRect.left < otherRect.right;
            const verticalContact = fallingRect.bottom >= otherRect.top && fallingRect.top < otherRect.top;

            if (horizontalOverlap && verticalContact) {
                // This block can support the falling block
                const landingY = otherRect.top - fallingBlock.height;

                // Find the highest (closest to top) support
                if (otherRect.top < highestSupportY) {
                    highestSupportY = otherRect.top;
                    bestLanding = {
                        landingY: landingY,
                        supportBlock: otherBlock
                    };
                }
            }
        });

        return bestLanding;
    }

    // ✅ NEW: Check for horizontal (side-to-side) collisions between blocks
    checkHorizontalBlockCollision(block1, block2) {
        const rect1 = {
            left: block1.x,
            right: block1.x + block1.width,
            top: block1.y,
            bottom: block1.y + block1.height
        };

        const rect2 = {
            left: block2.x,
            right: block2.x + block2.width,
            top: block2.y,
            bottom: block2.y + block2.height
        };

        // Check for overlap
        const horizontalOverlap = rect1.right > rect2.left && rect1.left < rect2.right;
        const verticalOverlap = rect1.bottom > rect2.top && rect1.top < rect2.bottom;

        if (!horizontalOverlap || !verticalOverlap) return false;

        // Determine if this is a side-to-side collision (not stacking)
        const centerY1 = rect1.top + (rect1.bottom - rect1.top) / 2;
        const centerY2 = rect2.top + (rect2.bottom - rect2.top) / 2;
        const verticalDistance = Math.abs(centerY1 - centerY2);
        const combinedHalfHeights = (rect1.bottom - rect1.top) / 2 + (rect2.bottom - rect2.top) / 2;

        // If vertical centers are close, this is a side-to-side collision
        return verticalDistance < combinedHalfHeights * 0.8;
    }

    // ✅ NEW: Handle horizontal (side-to-side) collisions between blocks
    handleHorizontalBlockCollision(block1, block2) {
        const dx = (block2.x + block2.width/2) - (block1.x + block1.width/2);
        const distance = Math.abs(dx);
        const minDistance = (block1.width + block2.width) / 2;
        const overlap = minDistance - distance;

        if (overlap <= 0) return;

        // ✅ NEW: Play wood-block sound for block-to-block collision
        const relativeVelocity = Math.abs(block1.vx - block2.vx);
        const collisionIntensity = relativeVelocity / 10;
        if (collisionIntensity > 0.1) {
            this.playWoodBlockSound(collisionIntensity);
        }

        // Separate blocks horizontally
        const separationX = overlap / 2;
        const direction = dx > 0 ? 1 : -1;

        // Only move non-static blocks
        if (!block1.isStatic) {
            block1.x -= direction * separationX;
            block1.vx = 0;
        }
        if (!block2.isStatic) {
            block2.x += direction * separationX;
            block2.vx = 0;
        }

        // Keep blocks within screen bounds
        block1.x = Math.max(0, Math.min(window.innerWidth - block1.width, block1.x));
        block2.x = Math.max(0, Math.min(window.innerWidth - block2.width, block2.x));

        // Update visual positions
        block1.element.style.left = `${block1.x}px`;
        block2.element.style.left = `${block2.x}px`;
    }

    // ✅ NEW: Build Blocks specific collision detection
    buildBlocksElementsOverlap(elem1, elem2) {
        const rect1 = elem1.getBoundingClientRect();
        const rect2 = elem2.getBoundingClientRect();
        return !(
            rect1.right < rect2.left ||
            rect2.right < rect1.left ||
            rect1.bottom < rect2.top ||
            rect2.bottom < rect1.top
        );
    }



    // ✅ NEW: Check Blobbi vs build blocks collisions
    checkBlobbiVsBuildBlocks() {
        const blobbiRect = this.character.getBoundingClientRect();

        this.buildBlocksSystem.blocks.forEach((blockData) => {
            if (this.buildBlocksElementsOverlap(this.character, blockData.element)) {
                this.handleBlobbiBuildBlockCollision(blockData, blobbiRect);
            }
        });
    }

    // ✅ IMPROVED: Handle Blobbi vs build block collision with static block support
    handleBlobbiBuildBlockCollision(blockData, blobbiRect) {
        const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;
        const blobbiCenterY = blobbiRect.top + blobbiRect.height / 2;

        // Calculate collision response
        const dx = blockData.x + (blockData.width / 2) - blobbiCenterX;
        const dy = blockData.y + (blockData.height / 2) - blobbiCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        // Normalize collision vector
        const normalX = dx / distance;
        const normalY = dy / distance;

        // ✅ NEW: Only push block if it's not static, or if Blobbi hits it with enough force
        const blobbiSpeed = Math.sqrt(this.blobbiPhysics.vx * this.blobbiPhysics.vx + this.blobbiPhysics.vy * this.blobbiPhysics.vy);
        const strongHit = blobbiSpeed > 3;

        if (!blockData.isStatic || strongHit) {
            // Wake up the block and make it movable
            blockData.isStatic = false;
            blockData.supportedBy = null;

            // Push block away from Blobbi
            const pushStrength = strongHit ? 4 : 2;
            blockData.vx += normalX * pushStrength;
            blockData.vy += normalY * pushStrength;

            console.log(`🧱 Blobbi ${strongHit ? 'strongly' : 'gently'} pushed a build block!`);
        }

        // Blobbi bounces back slightly
        if (this.blobbiPhysics) {
            this.blobbiPhysics.vx -= normalX * 1;
            this.blobbiPhysics.vy -= normalY * 1;
        }

        // Show reaction
        if (Math.random() < 0.3) {
            this.react();
        }
    }

    // ✅ NEW: Setup Build Block entity (isolated system)
    setupBuildBlockEntity(blockElement, blockType, x, y, width, height) {
        console.log(`🧱 Setting up Build Block entity: ${blockType} with Build Blocks System`);

        // Create entity object for this block
        const blockData = {
            element: blockElement,
            type: blockType,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            width: width,
            height: height,
            isDragging: false,
            isStatic: false, // ✅ NEW: Track if block is static (not affected by gravity)
            supportedBy: null, // ✅ NEW: Track which block is supporting this one
            dragOffset: { x: 0, y: 0 }
        };

        // Store entity object on the element for easy access
        blockElement._buildBlockData = blockData;

        // Add to Build Blocks system
        this.buildBlocksSystem.blocks.set(blockElement, blockData);

        // Set up drag interaction for this block
        this.setupBuildBlockDragInteraction(blockElement, blockData);

        // Update initial position
        blockElement.style.left = `${x}px`;
        blockElement.style.top = `${y}px`;

        console.log(`🧱 Build Block entity created at: ${x}, ${y}`);
    }

    // ✅ NEW: Setup drag interaction for Build Blocks (isolated system)
    setupBuildBlockDragInteraction(blockElement, blockData) {
        let isDragging = false;
        let dragStarted = false;
        let startX = 0;
        let startY = 0;
        const dragThreshold = 5;

        // Prevent default browser drag behavior
        blockElement.style.userSelect = 'none';
        blockElement.style.webkitUserSelect = 'none';
        blockElement.style.webkitUserDrag = 'none';
        blockElement.style.webkitTouchCallout = 'none';
        blockElement.draggable = false;

        const onPointerDown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            dragStarted = false;
            startX = e.clientX;
            startY = e.clientY;

            const blockRect = blockElement.getBoundingClientRect();
            blockData.dragOffset = {
                x: e.clientX - blockRect.left,
                y: e.clientY - blockRect.top
            };

            blockElement.style.cursor = 'grabbing';
            console.log(`🧱 Pointer down on Build Block ${blockData.type}`);
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            e.stopPropagation();

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (!dragStarted && distance > dragThreshold) {
                dragStarted = true;
                blockData.isDragging = true;

                // ✅ NEW: Wake up block when dragging starts
                blockData.vx = 0;
                blockData.vy = 0;
                blockData.isStatic = false; // Block is no longer static when being dragged
                blockData.supportedBy = null; // No longer supported by another block

                blockElement.classList.add('dragging');
                blockElement.style.transform = 'scale(1.05)';
                blockElement.style.zIndex = '9999';
                blockElement.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';

                console.log(`🧱 Started dragging Build Block ${blockData.type}`);
            }

            if (dragStarted) {
                const newX = e.clientX - blockData.dragOffset.x;
                const newY = e.clientY - blockData.dragOffset.y;

                const minX = 0;
                const maxX = window.innerWidth - blockData.width;
                const minY = 0;
                const maxY = window.innerHeight - blockData.height;

                blockData.x = Math.max(minX, Math.min(maxX, newX));
                blockData.y = Math.max(minY, Math.min(maxY, newY));

                // Update visual position immediately
                blockElement.style.left = `${blockData.x}px`;
                blockElement.style.top = `${blockData.y}px`;
            }
        };

        const onPointerUp = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            e.stopPropagation();

            isDragging = false;

            blockElement.style.cursor = 'grab';
            blockElement.style.transform = '';
            blockElement.style.zIndex = '';
            blockElement.style.filter = '';

            if (dragStarted) {
                blockData.isDragging = false;
                dragStarted = false;

                blockElement.classList.remove('dragging');

                console.log(`🧱 Stopped dragging Build Block ${blockData.type}`);
            }
        };

        // Add event listeners
        blockElement.addEventListener('pointerdown', onPointerDown, { passive: false });
        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp, { passive: false });

        // Touch events fallback
        blockElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerDown({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (isDragging) {
                onPointerUp({
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        blockElement.style.cursor = 'grab';
    }

    // ✅ NEW: Stop Build Blocks system
    stopBuildBlocksSystem() {
        console.log('🧱 Stopping Build Blocks System');

        this.buildBlocksSystem.isActive = false;

        if (this.buildBlocksSystem.animationFrame) {
            cancelAnimationFrame(this.buildBlocksSystem.animationFrame);
            this.buildBlocksSystem.animationFrame = null;
        }

        // Clear all build blocks
        this.buildBlocksSystem.blocks.clear();
    }

    spawnBlock(blockNumber) {
        const blockType = `p-${blockNumber}`;
        const spawnedCount = this.spawnedBlocks.get(blockType) || 0;

        if (spawnedCount >= this.maxBlocksPerType) {
            console.log(`🧱 Cannot spawn more ${blockType} blocks - limit reached`);
            return;
        }

        console.log(`🧱 Spawning block ${blockType} with Build Blocks System`);

        // ✅ UPDATED: Get custom size for this block type (only height specified)
        const blockHeight = this.blockSizes[blockType]?.height || 60;

        // Create block element
        const blockElement = document.createElement('div');
        blockElement.className = `companion-block ${blockType}`;
        blockElement.setAttribute('data-block-type', blockType);

        // ✅ UPDATED: Only set height, let width auto-adjust to preserve aspect ratio
        blockElement.style.cssText = `
            position: fixed;
            height: ${blockHeight}px;
            z-index: 9997;
            pointer-events: auto;
            user-select: none;
            -webkit-user-select: none;
            -webkit-user-drag: none;
            -webkit-touch-callout: none;
            animation: blockDrop 0.5s ease-out;
            transition: transform 0.15s ease-out, filter 0.15s ease-out;
            filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));
            cursor: grab;
            padding: 0;
            margin: 0;
            border: none;
            outline: none;
        `;

        blockElement.draggable = false;

        // Add block image
        const img = document.createElement('img');
        img.src = `/companion/assets/toys/pieces/p-${blockNumber}.svg`;
        img.alt = `Block ${blockNumber}`;
        img.style.cssText = `
            width: auto;
            height: 100%;
            pointer-events: none;
            user-select: none;
            -webkit-user-select: none;
            -webkit-user-drag: none;
            -webkit-touch-callout: none;
            padding: 0;
            margin: 0;
            border: none;
            outline: none;
            display: block;
        `;
        img.draggable = false;

        // Prevent drag events
        img.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });

        blockElement.appendChild(img);

        // Prevent drag events on block element
        blockElement.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });

        blockElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Add drop animation if not already present
        if (!document.querySelector('#block-drop-animation')) {
            const style = document.createElement('style');
            style.id = 'block-drop-animation';
            style.textContent = `
                @keyframes blockDrop {
                    from {
                        transform: translateY(-20px) scale(0.8);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0) scale(1);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(blockElement);

        // ✅ UPDATED: Wait for image to load to get actual dimensions, then position and setup physics
        img.onload = () => {
            const actualWidth = blockElement.offsetWidth;
            const actualHeight = blockElement.offsetHeight;

            // Position block in center of screen initially
            const startX = window.innerWidth / 2 - (actualWidth / 2);
            const startY = window.innerHeight / 3;

            blockElement.style.left = `${startX}px`;
            blockElement.style.top = `${startY}px`;

            // ✅ NEW: Use Build Blocks system if current toy is blocks
            if (this.currentToy && this.currentToy.id === 'toy_blocks' && this.buildBlocksSystem.isActive) {
                this.setupBuildBlockEntity(blockElement, blockType, startX, startY, actualWidth, actualHeight);
            } else {
                // Use legacy system for other toys
                this.setupBlockPhysics(blockElement, blockType, startX + (actualWidth / 2), startY + (actualHeight / 2));
            }
        };

        // Fallback if image fails to load
        img.onerror = () => {
            // Use default dimensions
            const defaultWidth = blockHeight; // Square fallback
            const startX = window.innerWidth / 2 - (defaultWidth / 2);
            const startY = window.innerHeight / 3;

            blockElement.style.left = `${startX}px`;
            blockElement.style.top = `${startY}px`;
            blockElement.style.width = `${defaultWidth}px`;

            // ✅ NEW: Use Build Blocks system if current toy is blocks
            if (this.currentToy && this.currentToy.id === 'toy_blocks' && this.buildBlocksSystem.isActive) {
                this.setupBuildBlockEntity(blockElement, blockType, startX, startY, defaultWidth, blockHeight);
            } else {
                // Use legacy system for other toys
                this.setupBlockPhysics(blockElement, blockType, startX + (defaultWidth / 2), startY + (blockHeight / 2));
            }
        };

        // Update spawned blocks count
        this.spawnedBlocks.set(blockType, spawnedCount + 1);

        // Update the floating menu to reflect new count
        this.updateFloatingBlockMenu();
    }

    setupBlockPhysics(blockElement, blockType, x, y) {
        // ✅ UPDATED: Get actual dimensions from the rendered element
        const actualWidth = blockElement.offsetWidth;
        const actualHeight = blockElement.offsetHeight;

        // Create physics object for this block
        const blockPhysics = {
            element: blockElement,
            type: blockType,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            gravity: 0.5,
            bounce: 0.15, // ✅ REDUCED: Lower bounce for better stacking stability
            friction: 0.92, // ✅ ENHANCED: Higher friction for more realistic block behavior
            groundY: window.innerHeight - (actualHeight / 2),
            isDragging: false,
            dragOffset: { x: 0, y: 0 },
            width: actualWidth,
            height: actualHeight,
            isResting: false, // ✅ NEW: Track if block is at rest for optimization
            restThreshold: 0.3 // ✅ NEW: Velocity threshold for considering block at rest
        };

        // Store physics object on the element for easy access
        blockElement._physics = blockPhysics;

        // Set up drag interaction for this block
        this.setupBlockDragInteraction(blockElement, blockPhysics);

        // Add this block to the physics simulation
        if (!this.blockPhysicsObjects) {
            this.blockPhysicsObjects = [];
        }
        this.blockPhysicsObjects.push(blockPhysics);

        // Start block physics simulation if not already running
        if (!this.blockPhysicsInterval) {
            this.startBlockPhysicsSimulation();
        }

        // Update initial position
        this.updateBlockPosition(blockPhysics);
    }

    setupBlockDragInteraction(blockElement, blockPhysics) {
        let isDragging = false;
        let dragStarted = false;
        let startX = 0;
        let startY = 0;
        const dragThreshold = 5;

        // Prevent default browser drag behavior
        blockElement.style.userSelect = 'none';
        blockElement.style.webkitUserSelect = 'none';
        blockElement.style.webkitUserDrag = 'none';
        blockElement.style.webkitTouchCallout = 'none';
        blockElement.draggable = false;

        const onPointerDown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            dragStarted = false;
            startX = e.clientX;
            startY = e.clientY;

            const blockRect = blockElement.getBoundingClientRect();
            blockPhysics.dragOffset = {
                x: e.clientX - blockRect.left,
                y: e.clientY - blockRect.top
            };

            blockElement.style.cursor = 'grabbing';
            console.log(`🧱 Pointer down on block ${blockPhysics.type}`);
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            e.stopPropagation();

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (!dragStarted && distance > dragThreshold) {
                dragStarted = true;
                blockPhysics.isDragging = true;

                blockPhysics.vx = 0;
                blockPhysics.vy = 0;
                blockPhysics.isResting = false; // ✅ NEW: Wake up block when dragging starts

                blockElement.classList.add('dragging');
                blockElement.style.transform = 'scale(1.05)';
                blockElement.style.zIndex = '9999';
                blockElement.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';

                console.log(`🧱 Started dragging block ${blockPhysics.type}`);
            }

            if (dragStarted) {
                const newX = e.clientX - blockPhysics.dragOffset.x + blockPhysics.width / 2;
                const newY = e.clientY - blockPhysics.dragOffset.y + blockPhysics.height / 2;

                const minX = blockPhysics.width / 2;
                const maxX = window.innerWidth - blockPhysics.width / 2;
                const minY = blockPhysics.height / 2;
                const maxY = window.innerHeight - blockPhysics.height / 2;

                blockPhysics.x = Math.max(minX, Math.min(maxX, newX));
                blockPhysics.y = Math.max(minY, Math.min(maxY, newY));

                this.updateBlockPosition(blockPhysics);
            }
        };

        const onPointerUp = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            e.stopPropagation();

            isDragging = false;

            blockElement.style.cursor = 'grab';
            blockElement.style.transform = '';
            blockElement.style.zIndex = '';
            blockElement.style.filter = '';

            if (dragStarted) {
                blockPhysics.isDragging = false;
                dragStarted = false;

                blockElement.classList.remove('dragging');

                console.log(`🧱 Stopped dragging block ${blockPhysics.type}`);
            }
        };

        // Add event listeners
        blockElement.addEventListener('pointerdown', onPointerDown, { passive: false });
        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp, { passive: false });

        // Touch events fallback
        blockElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerDown({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                const touch = e.touches[0];
                onPointerMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (isDragging) {
                onPointerUp({
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                });
            }
        }, { passive: false });

        blockElement.style.cursor = 'grab';
    }

    startBlockPhysicsSimulation() {
        if (this.blockPhysicsInterval) {
            clearInterval(this.blockPhysicsInterval);
        }

        console.log('🧱 Starting block physics simulation');

        this.blockPhysicsInterval = setInterval(() => {
            if (this.blockPhysicsObjects) {
                this.blockPhysicsObjects.forEach(blockPhysics => {
                    this.updateBlockPhysics(blockPhysics);
                });

                // ✅ NEW: Check collisions between blocks and Blobbi
                this.checkBlockCollisions();
            }
        }, 16); // ~60 FPS
    }

    // ✅ NEW: Check collisions between blocks and Blobbi
    checkBlockCollisions() {
        if (!this.blockPhysicsObjects || !this.isPlayMode) return;

        // Get Blobbi's position
        const blobbiRect = this.character.getBoundingClientRect();
        const blobbiCenterX = blobbiRect.left + blobbiRect.width / 2;
        const blobbiCenterY = blobbiRect.top + blobbiRect.height / 2;
        const blobbiRadius = 60; // Blobbi's collision radius

        this.blockPhysicsObjects.forEach(blockPhysics => {
            if (blockPhysics.isDragging) return; // Skip dragged blocks

            // Get block position
            const blockCenterX = blockPhysics.x;
            const blockCenterY = blockPhysics.y;
            const blockRadius = Math.max(blockPhysics.width, blockPhysics.height) / 2;

            // Calculate distance
            const distance = Math.sqrt(
                Math.pow(blobbiCenterX - blockCenterX, 2) +
                Math.pow(blobbiCenterY - blockCenterY, 2)
            );

            const collisionThreshold = blobbiRadius + blockRadius - 10; // Slight overlap allowed

            if (distance < collisionThreshold) {
                this.handleBlobbiBlockCollision(blockPhysics, blobbiCenterX, blobbiCenterY, distance);
            }
        });

        // ✅ NEW: Check collisions between blocks themselves
        this.checkBlockToBlockCollisions();
    }

    // ✅ ENHANCED: More dynamic Blobbi-block interactions with physics-based responses
    handleBlobbiBlockCollision(blockPhysics, blobbiX, blobbiY, distance) {
        // Calculate collision response
        const dx = blockPhysics.x - blobbiX;
        const dy = blockPhysics.y - blobbiY;

        if (distance === 0) return; // Prevent division by zero

        // Normalize collision vector
        const normalX = dx / distance;
        const normalY = dy / distance;

        // ✅ ENHANCED: More varied interaction types based on Blobbi's velocity and position
        const blobbiSpeed = Math.sqrt(this.blobbiPhysics.vx * this.blobbiPhysics.vx + this.blobbiPhysics.vy * this.blobbiPhysics.vy);
        const isMovingFast = blobbiSpeed > 2;
        const isAboveBlock = blobbiY < blockPhysics.y;

        // ✅ NEW: Different interaction types
        if (isMovingFast) {
            // Fast collision - strong push
            const pushStrength = 2 + Math.random() * 3;
            blockPhysics.vx += normalX * pushStrength;
            blockPhysics.vy += normalY * pushStrength;

            // Add upward impulse for dramatic effect
            blockPhysics.vy -= 1 + Math.random() * 2;

            // Blobbi bounces back
            this.blobbiPhysics.vx -= normalX * (1 + Math.random());
            this.blobbiPhysics.vy -= normalY * (1 + Math.random());

            console.log('🧱💥 Blobbi crashed into a block with force!');

            // Show excited reaction
            if (Math.random() < 0.6) {
                this.react();
            }
        } else if (isAboveBlock && Math.abs(this.blobbiPhysics.vy) < 1) {
            // Gentle landing on top of block
            const gentlePush = 0.2 + Math.random() * 0.3;
            blockPhysics.vy += gentlePush;

            // Blobbi settles on top
            this.blobbiPhysics.vy = 0;
            this.blobbiPhysics.y = blockPhysics.y - (blockPhysics.height / 2) - 60; // Position on top

            console.log('🧱🎯 Blobbi landed gently on a block!');

            // Occasional happy reaction
            if (Math.random() < 0.3) {
                setTimeout(() => this.react(), 500);
            }
        } else {
            // Normal collision - moderate push with randomness
            const pushStrength = 0.8 + Math.random() * 1.5;
            const shouldPush = Math.random() < 0.8; // 80% chance to push

            if (shouldPush) {
                blockPhysics.vx += normalX * pushStrength;
                blockPhysics.vy += normalY * pushStrength;

                // Small upward impulse for liveliness
                blockPhysics.vy -= 0.3 + Math.random() * 0.7;

                console.log('🧱 Blobbi nudged a block!');

                // Occasional reaction
                if (Math.random() < 0.2) {
                    this.react();
                }
            }

            // Blobbi sometimes bounces off
            if (Math.random() < 0.5) {
                const bounceStrength = 0.5 + Math.random() * 1;
                this.blobbiPhysics.vx -= normalX * bounceStrength;
                this.blobbiPhysics.vy -= normalY * bounceStrength;
            }
        }

        // ✅ NEW: Add some randomness to make interactions feel more alive
        if (Math.random() < 0.1) { // 10% chance for extra random movement
            blockPhysics.vx += (Math.random() - 0.5) * 2;
            blockPhysics.vy -= Math.random() * 1;
            console.log('🧱✨ Block got an extra random impulse!');
        }
    }

    // ✅ ENHANCED: Improved block-to-block collision detection with better stacking support
    checkBlockToBlockCollisions() {
        if (!this.blockPhysicsObjects || this.blockPhysicsObjects.length < 2) return;

        for (let i = 0; i < this.blockPhysicsObjects.length; i++) {
            for (let j = i + 1; j < this.blockPhysicsObjects.length; j++) {
                const block1 = this.blockPhysicsObjects[i];
                const block2 = this.blockPhysicsObjects[j];

                // Skip if either block is being dragged
                if (block1.isDragging || block2.isDragging) continue;

                // ✅ ENHANCED: Use rectangular collision detection for better stacking
                if (this.checkRectangularCollision(block1, block2)) {
                    this.handleBlockToBlockCollision(block1, block2);
                }
            }
        }
    }

    // ✅ NEW: Rectangular collision detection for better block stacking
    checkRectangularCollision(block1, block2) {
        const block1Left = block1.x - block1.width / 2;
        const block1Right = block1.x + block1.width / 2;
        const block1Top = block1.y - block1.height / 2;
        const block1Bottom = block1.y + block1.height / 2;

        const block2Left = block2.x - block2.width / 2;
        const block2Right = block2.x + block2.width / 2;
        const block2Top = block2.y - block2.height / 2;
        const block2Bottom = block2.y + block2.height / 2;

        // Check for overlap
        return !(block1Right < block2Left ||
                 block1Left > block2Right ||
                 block1Bottom < block2Top ||
                 block1Top > block2Bottom);
    }

    // ✅ ENHANCED: Improved block-to-block collision handling with better stacking physics
    handleBlockToBlockCollision(block1, block2) {
        // Calculate overlap amounts
        const block1Left = block1.x - block1.width / 2;
        const block1Right = block1.x + block1.width / 2;
        const block1Top = block1.y - block1.height / 2;
        const block1Bottom = block1.y + block1.height / 2;

        const block2Left = block2.x - block2.width / 2;
        const block2Right = block2.x + block2.width / 2;
        const block2Top = block2.y - block2.height / 2;
        const block2Bottom = block2.y + block2.height / 2;

        // Calculate overlap amounts
        const overlapX = Math.min(block1Right - block2Left, block2Right - block1Left);
        const overlapY = Math.min(block1Bottom - block2Top, block2Bottom - block1Top);

        // ✅ NEW: Play wood-block sound for legacy block-to-block collision
        const relativeVelocity = Math.sqrt(
            Math.pow(block1.vx - block2.vx, 2) + Math.pow(block1.vy - block2.vy, 2)
        );
        const collisionIntensity = relativeVelocity / 10;
        if (collisionIntensity > 0.1) {
            this.playWoodBlockSound(collisionIntensity);
        }

        // Determine collision direction (resolve along smallest overlap)
        if (overlapX < overlapY) {
            // Horizontal collision
            const centerDiff = block2.x - block1.x;
            const separationX = overlapX * 0.5;

            if (centerDiff > 0) {
                // block2 is to the right of block1
                block1.x -= separationX;
                block2.x += separationX;
            } else {
                // block2 is to the left of block1
                block1.x += separationX;
                block2.x -= separationX;
            }

            // ✅ ENHANCED: Improved velocity exchange for horizontal collisions
            const relativeVx = block2.vx - block1.vx;
            const restitution = 0.2; // Low bounce for stable stacking

            if ((centerDiff > 0 && relativeVx < 0) || (centerDiff < 0 && relativeVx > 0)) {
                const impulse = relativeVx * restitution * 0.5;
                block1.vx += impulse;
                block2.vx -= impulse;
            }
        } else {
            // Vertical collision (stacking)
            const centerDiff = block2.y - block1.y;
            const separationY = overlapY * 0.5;

            if (centerDiff > 0) {
                // block2 is below block1
                block1.y -= separationY;
                block2.y += separationY;
            } else {
                // block2 is above block1
                block1.y += separationY;
                block2.y -= separationY;
            }

            // ✅ ENHANCED: Special handling for vertical stacking
            const relativeVy = block2.vy - block1.vy;
            const restitution = 0.1; // Very low bounce for stable stacking

            if ((centerDiff > 0 && relativeVy < 0) || (centerDiff < 0 && relativeVy > 0)) {
                const impulse = relativeVy * restitution * 0.5;
                block1.vy += impulse;
                block2.vy -= impulse;

                // ✅ NEW: Stop small vertical movements for stable stacking
                if (Math.abs(block1.vy) < 0.5) block1.vy = 0;
                if (Math.abs(block2.vy) < 0.5) block2.vy = 0;
            }
        }

        // ✅ NEW: Add friction between touching blocks for stability
        const frictionCoefficient = 0.95;
        block1.vx *= frictionCoefficient;
        block1.vy *= frictionCoefficient;
        block2.vx *= frictionCoefficient;
        block2.vy *= frictionCoefficient;
    }

    updateBlockPhysics(blockPhysics) {
        if (blockPhysics.isDragging) return;

        // ✅ NEW: Skip physics updates for resting blocks to improve performance
        const totalVelocity = Math.abs(blockPhysics.vx) + Math.abs(blockPhysics.vy);
        if (blockPhysics.isResting && totalVelocity < blockPhysics.restThreshold) {
            return; // Block is at rest, skip physics
        }

        // Apply gravity
        blockPhysics.vy += blockPhysics.gravity;

        // Apply velocity
        blockPhysics.x += blockPhysics.vx;
        blockPhysics.y += blockPhysics.vy;

        // Apply friction
        blockPhysics.vx *= blockPhysics.friction;

        // Ground collision
        if (blockPhysics.y >= blockPhysics.groundY) {
            blockPhysics.y = blockPhysics.groundY;

            // ✅ NEW: Play wood-block sound when legacy block hits ground
            const collisionIntensity = Math.abs(blockPhysics.vy) / 10;
            if (collisionIntensity > 0.1) {
                this.playWoodBlockSound(collisionIntensity);
            }

            blockPhysics.vy *= -blockPhysics.bounce;

            // ✅ ENHANCED: Better resting detection
            if (Math.abs(blockPhysics.vy) < 0.8) {
                blockPhysics.vy = 0;

                // ✅ NEW: Mark as resting if both velocities are low
                if (Math.abs(blockPhysics.vx) < blockPhysics.restThreshold) {
                    blockPhysics.isResting = true;
                }
            }
        }

        // Wall collisions using stored dimensions
        const blockWidth = blockPhysics.width;
        if (blockPhysics.x <= blockWidth / 2) {
            blockPhysics.x = blockWidth / 2;

            // ✅ NEW: Play wood-block sound when legacy block hits left wall
            const collisionIntensity = Math.abs(blockPhysics.vx) / 10;
            if (collisionIntensity > 0.1) {
                this.playWoodBlockSound(collisionIntensity);
            }

            blockPhysics.vx *= -blockPhysics.bounce;
        } else if (blockPhysics.x >= window.innerWidth - blockWidth / 2) {
            blockPhysics.x = window.innerWidth - blockWidth / 2;

            // ✅ NEW: Play wood-block sound when legacy block hits right wall
            const collisionIntensity = Math.abs(blockPhysics.vx) / 10;
            if (collisionIntensity > 0.1) {
                this.playWoodBlockSound(collisionIntensity);
            }

            blockPhysics.vx *= -blockPhysics.bounce;
        }

        // ✅ NEW: Wake up block if it starts moving again
        if (totalVelocity > blockPhysics.restThreshold) {
            blockPhysics.isResting = false;
        }

        this.updateBlockPosition(blockPhysics);
    }

    updateBlockPosition(blockPhysics) {
        if (!blockPhysics.element) return;

        const blockWidth = blockPhysics.width;
        const blockHeight = blockPhysics.height;

        blockPhysics.element.style.left = `${blockPhysics.x - blockWidth / 2}px`;
        blockPhysics.element.style.top = `${blockPhysics.y - blockHeight / 2}px`;
    }



    removeBlock(blockElement) {
        let blockType = null;

        // ✅ NEW: Handle both Build Blocks system and legacy system
        if (blockElement._buildBlockData) {
            // Build Blocks system
            blockType = blockElement._buildBlockData.type;
            console.log(`🧱 Removing Build Block ${blockType}`);

            // Remove from Build Blocks system
            this.buildBlocksSystem.blocks.delete(blockElement);
        } else if (blockElement._physics) {
            // Legacy system
            blockType = blockElement._physics.type;
            console.log(`🧱 Removing legacy block ${blockType}`);

            // Remove from physics objects array
            if (this.blockPhysicsObjects) {
                const index = this.blockPhysicsObjects.indexOf(blockElement._physics);
                if (index > -1) {
                    this.blockPhysicsObjects.splice(index, 1);
                }
            }
        } else {
            console.log('🧱 Cannot remove block - no physics data found');
            return;
        }

        // Update spawned blocks count
        const currentCount = this.spawnedBlocks.get(blockType) || 0;
        if (currentCount > 0) {
            this.spawnedBlocks.set(blockType, currentCount - 1);
        }

        // Remove element from DOM
        blockElement.remove();

        // Update floating menu
        this.updateFloatingBlockMenu();

        // Stop physics simulations if no blocks remain
        if (this.buildBlocksSystem.blocks.size === 0 && this.buildBlocksSystem.isActive) {
            // No need to stop Build Blocks system completely, just let it run empty
            console.log('🧱 No Build Blocks remaining, but keeping system active');
        }

        if (!this.blockPhysicsObjects || this.blockPhysicsObjects.length === 0) {
            if (this.blockPhysicsInterval) {
                clearInterval(this.blockPhysicsInterval);
                this.blockPhysicsInterval = null;
            }
        }
    }

    removeAllBlocks() {
        console.log('🧱 Removing all blocks from screen and physics engines');

        // ✅ ENHANCED: More thorough block removal with multiple selectors
        const allBlocks = document.querySelectorAll('.companion-block, [data-block-type], .companion-toy.blocks');
        console.log(`🧱 Found ${allBlocks.length} blocks to remove`);

        allBlocks.forEach((block, index) => {
            console.log(`🧱 Removing block ${index + 1}: ${block.className}`);

            // ✅ NEW: Remove from Build Blocks system
            if (block._buildBlockData) {
                this.buildBlocksSystem.blocks.delete(block);
                console.log(`🧱 Removed block from Build Blocks system`);
            }

            // Remove from Matter.js physics if enabled
            if (this.physicsEnabled && block._matterBody && this.matterEngine) {
                Matter.World.remove(this.matterEngine.world, block._matterBody);
                this.matterBodies.delete(block);
            }

            // Remove from legacy physics system
            if (block._physics) {
                if (this.blockPhysicsObjects) {
                    const index = this.blockPhysicsObjects.indexOf(block._physics);
                    if (index > -1) {
                        this.blockPhysicsObjects.splice(index, 1);
                        console.log(`🧱 Removed block from legacy physics objects array at index ${index}`);
                    }
                }
            }

            // Remove from DOM
            block.remove();
        });

        // ✅ ENHANCED: Clear all block-related data structures
        this.spawnedBlocks.clear();
        this.blockPhysicsObjects = [];

        // ✅ NEW: Clear Build Blocks system
        this.buildBlocksSystem.blocks.clear();

        // Clear Matter.js bodies if they exist
        if (this.matterBodies) {
            this.matterBodies.clear();
        }

        // ✅ ENHANCED: Stop all physics simulations
        if (this.blockPhysicsInterval) {
            clearInterval(this.blockPhysicsInterval);
            this.blockPhysicsInterval = null;
            console.log('🧱 Stopped legacy block physics simulation');
        }

        // Stop Matter.js physics if running
        if (this.matterRunner && this.matterRunner.enabled) {
            this.stopMatterPhysics();
        }
        if (this.matterUpdateInterval) {
            clearInterval(this.matterUpdateInterval);
            this.matterUpdateInterval = null;
        }

        console.log('🧱 All blocks successfully removed from screen and all physics engines');
    }

    removeFloatingBlockMenu() {
        console.log('🧱 Removing floating block selection menu from DOM');

        // ✅ ENHANCED: Remove the menu element if it exists
        if (this.blockSelectionMenu) {
            this.blockSelectionMenu.remove();
            this.blockSelectionMenu = null;
            console.log('🧱 Block selection menu removed');
        }

        // ✅ ENHANCED: Also search for and remove any orphaned block menus
        const orphanedMenus = document.querySelectorAll('[data-floating-block-menu="true"], .floating-block-menu');
        orphanedMenus.forEach((menu, index) => {
            console.log(`🧱 Removing orphaned block menu ${index + 1}`);
            menu.remove();
        });

        // ✅ ENHANCED: Reset menu state
        this.blockMenuOpen = false;
        this.removeBlockMenuOutsideClickListener();

        console.log('🧱 Floating block menu completely removed from DOM/UI');
    }

    // ✅ NEW: Handle toy box interactions for removing blocks
    handleToyBoxInteraction(element) {
        // Check if the element is a block
        if (element && element.classList.contains('companion-block')) {
            console.log('🧱 Block dragged into toy box - removing');
            this.removeBlock(element);

            // Show feedback
            if (window.flammiToast) {
                window.flammiToast(
                    "Block removed and returned to inventory!",
                    "🧱 Block Stored"
                );
            }
        }
    }

    // ✅ FIXED: Clean exit from play mode with proper state restoration
    exitPlayMode() {
        if (!this.isPlayMode) return;

        console.log('🎮 Exiting play mode - returning to normal behavior');

        // Clear play mode state
        this.isPlayMode = false;

        // ✅ NEW: Remove global class to restore normal drag behavior
        document.body.classList.remove('toy-interaction-active');

        // ✅ NEW: Stop Blobbi physics simulation
        this.stopBlobbiPhysics();
        this.blobbiPhysics.isPhysicsActive = false;

        // Stop toy physics simulation
        if (this.physicsInterval) {
            clearInterval(this.physicsInterval);
            this.physicsInterval = null;
        }

        // ✅ NEW: Remove physics-active class to restore CSS transitions
        if (this.toyElement) {
            this.toyElement.classList.remove('physics-active');
        }

        // ✅ ENHANCED: Complete cleanup of all toys and UI elements
        this.removeAllBlocks();
        this.removeFloatingBlockMenu();

        // ✅ NEW: Stop Build Blocks system
        this.stopBuildBlocksSystem();

        // ✅ NEW: Clear all play mode timers and intervals
        this.cleanupPlayModeTimers();

        // Reset toy interaction state
        this.isApproachingToy = false;
        this.toyInteractionCooldown = false;
        this.lastCollisionTime = 0;

        // Remove toy element
        if (this.toyElement) {
            this.toyElement.remove();
            this.toyElement = null;
        }

        // Clear toy data
        this.currentToy = null;

        // ✅ ENHANCED: Reset block menu state
        this.blockMenuOpen = false;
        this.removeBlockMenuOutsideClickListener();

        // ✅ FIXED: Remove all play mode classes and restore normal state
        this.container.classList.remove('falling', 'play-mode', 'landed', 'bottom-area', 'walking', 'excited', 'physics-active');
        this.character.classList.remove('walking', 'excited');

        // ✅ FIXED: Smooth transition back to normal roaming position
        this.transitionToNormalMode();

        // Notify React component that toy interaction ended
        window.dispatchEvent(new CustomEvent('companion-toy-interaction-ended'));

        console.log('🎯 Blobbi is transitioning back to normal roaming behavior!');
    }

    // ✅ ENHANCED: Clean up all play mode timers and intervals
    cleanupPlayModeTimers() {
        console.log('🧹 Cleaning up all play mode timers and intervals');

        // Clear movement and pause timers
        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
            this.pauseTimeout = null;
            console.log('🧹 Cleared pause timeout');
        }

        if (this.moveInterval) {
            clearInterval(this.moveInterval);
            this.moveInterval = null;
            console.log('🧹 Cleared move interval');
        }

        // Clear toy interaction timers
        if (this.toyInteractionInterval) {
            clearInterval(this.toyInteractionInterval);
            this.toyInteractionInterval = null;
            console.log('🧹 Cleared toy interaction interval');
        }

        // ✅ ENHANCED: Clean up Blobbi physics
        if (this.blobbiPhysicsInterval) {
            clearInterval(this.blobbiPhysicsInterval);
            this.blobbiPhysicsInterval = null;
            console.log('🧹 Cleared Blobbi physics interval');
        }

        // ✅ ENHANCED: Clean up block physics
        if (this.blockPhysicsInterval) {
            clearInterval(this.blockPhysicsInterval);
            this.blockPhysicsInterval = null;
            console.log('🧹 Cleared block physics interval');
        }

        // ✅ ENHANCED: Clean up physics simulation
        if (this.physicsInterval) {
            clearInterval(this.physicsInterval);
            this.physicsInterval = null;
            console.log('🧹 Cleared main physics interval');
        }

        // ✅ ENHANCED: Reset interaction states
        this.isApproachingToy = false;
        this.toyInteractionCooldown = false;
        this.lastToyInteractionTime = 0;
        this.lastCollisionTime = 0;

        console.log('🧹 All play mode timers and intervals cleaned up');
    }

    // ✅ ENHANCED: Smooth transition back to normal mode with proper position restoration
    transitionToNormalMode() {
        console.log('🎯 Transitioning Blobbi back to normal free-roaming behavior');

        // ✅ ENHANCED: Reset Blobbi physics completely
        this.blobbiPhysics = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            gravity: 0.5,
            bounce: 0.6,
            friction: 0.98,
            groundY: 0,
            isDragging: false,
            isPhysicsActive: false
        };

        // ✅ ENHANCED: Move Blobbi away from bottom edge to a more natural position
        const currentCenterX = window.innerWidth - this.position.x - 60;
        const currentCenterY = window.innerHeight - this.position.y - 60;

        // If Blobbi is stuck at the bottom, move to a better position
        if (currentCenterY > window.innerHeight - 150) {
            console.log('🎯 Blobbi was at bottom edge, moving to center area');
            const newCenterX = Math.max(100, Math.min(window.innerWidth - 100, currentCenterX));
            const newCenterY = window.innerHeight / 2; // Move to middle of screen

            // Convert to position coordinates
            this.position.x = window.innerWidth - newCenterX - 60;
            this.position.y = window.innerHeight - newCenterY - 60;

            // Keep within bounds
            this.position.x = Math.max(0, Math.min(window.innerWidth - 120, this.position.x));
            this.position.y = Math.max(0, Math.min(window.innerHeight - 120, this.position.y));

            this.updatePosition();
        }

        // ✅ ENHANCED: Re-enable free roaming across entire screen
        this.isFreeRoaming = true;
        this.container.classList.add('free-roaming');

        // ✅ NEW: Add transition class for smooth visual change
        this.container.classList.add('transitioning-to-normal');

        // Remove transition class after animation
        setTimeout(() => {
            this.container.classList.remove('transitioning-to-normal');
        }, 1000);

        // ✅ ENHANCED: Resume normal behavior with proper state checks
        setTimeout(() => {
            if (this.isFreeRoaming && !this.isAngry && !this.isSad && !this.isEating && !this.isSleeping && !this.isPlayMode) {
                console.log('🎯 Resuming normal free roam behavior - Blobbi is free to walk around the entire screen!');
                this.startFreeRoam();
            } else {
                console.log('🎯 Free roam not started due to current state:', {
                    isFreeRoaming: this.isFreeRoaming,
                    isAngry: this.isAngry,
                    isSad: this.isSad,
                    isEating: this.isEating,
                    isSleeping: this.isSleeping,
                    isPlayMode: this.isPlayMode
                });
            }
        }, 1200); // Slightly longer delay for smoother transition
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

        // ✅ NEW: Clean up toy physics system and blocks
        this.exitPlayMode();
        this.removeAllBlocks();

        // ✅ NEW: Clean up block menu outside click listener
        this.removeBlockMenuOutsideClickListener();

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
        if (this.toyInteractionInterval) clearInterval(this.toyInteractionInterval);
        if (this.blobbiPhysicsInterval) clearInterval(this.blobbiPhysicsInterval);

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