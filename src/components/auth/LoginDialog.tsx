// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useEffect, useRef, useState } from 'react';
import { Shield, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { useLoginActions } from '@/hooks/useLoginActions';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup?: () => void;
}

const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onLogin, onSignup }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [bunkerUri, setBunkerUri] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const login = useLoginActions();

  const handleExtensionLogin = () => {
    setIsLoading(true);
    try {
      if (!('nostr' in window)) {
        throw new Error('Nostr extension not found. Please install a NIP-07 extension.');
      }
      login.extension();
      onLogin();
      onClose();
    } catch (error) {
      console.error('Extension login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyLogin = () => {
    if (!nsec.trim()) return;
    setIsLoading(true);

    try {
      login.nsec(nsec);
      onLogin();
      onClose();
    } catch (error) {
      console.error('Nsec login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBunkerLogin = () => {
    if (!bunkerUri.trim() || !bunkerUri.startsWith('bunker://')) return;
    setIsLoading(true);

    try {
      login.bunker(bunkerUri);
      onLogin();
      onClose();
    } catch (error) {
      console.error('Bunker login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setNsec(content.trim());
    };
    reader.readAsText(file);
  };

  const handleSignupClick = () => {
    onClose();
    if (onSignup) {
      onSignup();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md p-0 overflow-hidden rounded-2xl shadow-elegant-xl border-border/50 backdrop-blur-sm bg-popover/95'>
        <DialogHeader className='px-6 pt-6 pb-0 relative'>
          <DialogTitle className='text-xl font-semibold text-center bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent'>Log in</DialogTitle>
          <DialogDescription className='text-center text-muted-foreground mt-2'>
            Access your account securely with your preferred method
          </DialogDescription>
        </DialogHeader>

        <div className='px-6 py-8 space-y-6'>
          <Tabs defaultValue={'nostr' in window ? 'extension' : 'key'} className='w-full'>
            <TabsList className='grid grid-cols-3 mb-6 bg-muted/50 backdrop-blur-sm border-border/50'>
              <TabsTrigger value='extension'>Extension</TabsTrigger>
              <TabsTrigger value='key'>Nsec</TabsTrigger>
              <TabsTrigger value='bunker'>Bunker</TabsTrigger>
            </TabsList>

            <TabsContent value='extension' className='space-y-4'>
              <div className='text-center p-4 rounded-lg bg-card/50 backdrop-blur-sm border-border/50 shadow-elegant'>
                <Shield className='w-12 h-12 mx-auto mb-3 text-primary' />
                <p className='text-sm text-muted-foreground mb-4'>
                  Login with one click using the browser extension
                </p>
                <Button
                  className='w-full rounded-full py-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg transition-all duration-300 hover:shadow-elegant-lg hover:scale-105'
                  onClick={handleExtensionLogin}
                  disabled={isLoading}
                >
                  {isLoading ? 'Logging in...' : 'Login with Extension'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value='key' className='space-y-4'>
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <label htmlFor='nsec' className='text-sm font-medium text-foreground'>
                    Enter your nsec
                  </label>
                  <Input
                    id='nsec'
                    value={nsec}
                    onChange={(e) => setNsec(e.target.value)}
                    className='rounded-lg bg-background/80 border-border/50 focus:border-purple-400 focus:ring-purple-400/50 focus:bg-background placeholder:text-muted-foreground/60 backdrop-blur-sm transition-all duration-200'
                    placeholder='nsec1...'
                  />
                </div>

                <div className='text-center'>
                  <p className='text-sm mb-2 text-muted-foreground'>Or upload a key file</p>
                  <input
                    type='file'
                    accept='.txt'
                    className='hidden'
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant='outline'
                    className='w-full bg-background/80 border-border/50 hover:bg-accent/80 hover:border-purple-300 transition-all duration-200 backdrop-blur-sm'
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className='w-4 h-4 mr-2' />
                    Upload Nsec File
                  </Button>
                </div>

                <Button
                  className='w-full rounded-full py-6 mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg transition-all duration-300 hover:shadow-elegant-lg hover:scale-105'
                  onClick={handleKeyLogin}
                  disabled={isLoading || !nsec.trim()}
                >
                  {isLoading ? 'Verifying...' : 'Login with Nsec'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value='bunker' className='space-y-4'>
              <div className='space-y-2'>
                <label htmlFor='bunkerUri' className='text-sm font-medium text-foreground'>
                  Bunker URI
                </label>
                <Input
                  id='bunkerUri'
                  value={bunkerUri}
                  onChange={(e) => setBunkerUri(e.target.value)}
                  className='rounded-lg bg-background/80 border-border/50 focus:border-purple-400 focus:ring-purple-400/50 focus:bg-background placeholder:text-muted-foreground/60 backdrop-blur-sm transition-all duration-200'
                  placeholder='bunker://'
                />
                {bunkerUri && !bunkerUri.startsWith('bunker://') && (
                  <p className='text-destructive text-xs'>URI must start with bunker://</p>
                )}
              </div>

              <Button
                className='w-full rounded-full py-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg transition-all duration-300 hover:shadow-elegant-lg hover:scale-105'
                onClick={handleBunkerLogin}
                disabled={isLoading || !bunkerUri.trim() || !bunkerUri.startsWith('bunker://')}
              >
                {isLoading ? 'Connecting...' : 'Login with Bunker'}
              </Button>
            </TabsContent>
          </Tabs>

          <div className='text-center text-sm'>
            <p className='text-muted-foreground'>
              Don't have an account?{' '}
              <button
                onClick={handleSignupClick}
                className='text-primary hover:underline font-medium transition-all duration-200 hover:text-purple-600 dark:hover:text-purple-400'
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
