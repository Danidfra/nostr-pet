
import React, { createContext, useContext, useState, ReactNode, useRef, useCallback, useEffect } from 'react';

interface AudioContextType {
  volume: number;
  isMuted: boolean;
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  playSound: (sound: 'angry' | 'eating' | 'swallow' | 'ouch' | 'cleaning') => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  const [volume, setVolumeState] = useState(() => {
    const savedVolume = localStorage.getItem('blobbi_audio_volume');
    const parsedVolume = savedVolume ? parseFloat(savedVolume) : 0.5;
    // ✅ ENHANCED: Ensure volume is clamped between 0 and 1
    return Math.max(0, Math.min(1, parsedVolume));
  });
  const [isMuted, setIsMutedState] = useState(() => {
    const savedMute = localStorage.getItem('blobbi_audio_muted');
    return savedMute === 'true';
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ✅ ENHANCED: Improved volume setter with validation and companion notification
  const setVolume = useCallback((newVolume: number) => {
    // Clamp volume between 0 and 1
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    
    console.log('🎵 React AudioContext: Setting volume', { 
      requested: newVolume, 
      clamped: clampedVolume,
      previous: volume 
    });
    
    setVolumeState(clampedVolume);
    localStorage.setItem('blobbi_audio_volume', clampedVolume.toString());
    
    // Apply to current audio if any
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : clampedVolume;
    }
    
    // ✅ NEW: Trigger storage event for companion to pick up changes
    // This ensures companion audio updates immediately
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'blobbi_audio_volume',
      oldValue: volume.toString(),
      newValue: clampedVolume.toString(),
      storageArea: localStorage
    }));
  }, [volume, isMuted]);

  // ✅ ENHANCED: Improved mute setter with companion notification
  const setIsMuted = useCallback((newMuteState: boolean) => {
    console.log('🎵 React AudioContext: Setting mute state', { 
      newState: newMuteState, 
      previous: isMuted 
    });
    
    setIsMutedState(newMuteState);
    localStorage.setItem('blobbi_audio_muted', newMuteState.toString());
    
    // Apply to current audio if any
    if (audioRef.current) {
      audioRef.current.volume = newMuteState ? 0 : volume;
    }
    
    // ✅ NEW: Trigger storage event for companion to pick up changes
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'blobbi_audio_muted',
      oldValue: isMuted.toString(),
      newValue: newMuteState.toString(),
      storageArea: localStorage
    }));
  }, [isMuted, volume]);

  // ✅ ENHANCED: Improved playSound with better volume handling
  const playSound = useCallback((sound: 'angry' | 'eating' | 'swallow' | 'ouch' | 'cleaning') => {
    console.log('🎵 React AudioContext: Playing sound', { 
      sound, 
      volume, 
      isMuted,
      effectiveVolume: isMuted ? 0 : volume 
    });
    
    // ✅ IMPROVED: Don't return early if muted, just set volume to 0
    // This allows very quiet sounds to still play when volume is low
    const effectiveVolume = isMuted ? 0 : volume;

    const audio = new Audio(`/companion/sounds/${sound}.mp3`);
    audio.volume = effectiveVolume;
    audioRef.current = audio;
    
    audio.play()
      .then(() => console.log(`✅ React AudioContext: ${sound} played successfully`))
      .catch(error => console.error(`❌ React AudioContext: Error playing ${sound}:`, error));
    
    // Clear reference when audio ends
    audio.addEventListener('ended', () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    });
  }, [volume, isMuted]);

  // ✅ NEW: Listen for external storage changes and update state accordingly
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'blobbi_audio_volume' && e.newValue !== null) {
        const newVolume = Math.max(0, Math.min(1, parseFloat(e.newValue)));
        if (newVolume !== volume) {
          console.log('🎵 React AudioContext: Volume updated from external source', { 
            oldVolume: volume, 
            newVolume 
          });
          setVolumeState(newVolume);
        }
      } else if (e.key === 'blobbi_audio_muted' && e.newValue !== null) {
        const newMuted = e.newValue === 'true';
        if (newMuted !== isMuted) {
          console.log('🎵 React AudioContext: Mute state updated from external source', { 
            oldMuted: isMuted, 
            newMuted 
          });
          setIsMutedState(newMuted);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [volume, isMuted]);

  return (
    <AudioContext.Provider value={{ volume, isMuted, setVolume, setIsMuted, playSound }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export default AudioContext;
