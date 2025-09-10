// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useState } from 'react';
import { Download, Key } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { toast } from '@/hooks/useToast.ts';
import { useLoginActions } from '@/hooks/useLoginActions';
import { generateSecretKey, nip19 } from 'nostr-tools';

interface SignupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SignupDialog: React.FC<SignupDialogProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'generate' | 'download' | 'done'>('generate');
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const login = useLoginActions();

  // Generate a proper nsec key using nostr-tools
  const generateKey = () => {
    setIsLoading(true);

    try {
      // Generate a new secret key
      const sk = generateSecretKey();

      // Convert to nsec format
      setNsec(nip19.nsecEncode(sk));
      setStep('download');
    } catch (error) {
      console.error('Failed to generate key:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate key. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadKey = () => {
    // Create a blob with the key text
    const blob = new Blob([nsec], { type: 'text/plain' });
    const url = globalThis.URL.createObjectURL(blob);

    // Create a temporary link element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nsec.txt';
    document.body.appendChild(a);
    a.click();

    // Clean up
    globalThis.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: 'Key downloaded',
      description: 'Your key has been downloaded. Keep it safe!',
    });
  };

  const finishSignup = () => {
    login.nsec(nsec);

    setStep('done');
    onClose();

    toast({
      title: 'Account created',
      description: 'You are now logged in.',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md p-0 overflow-hidden rounded-2xl shadow-elegant-xl border-border/50 backdrop-blur-sm bg-popover/95'>
        <DialogHeader className='px-6 pt-6 pb-0 relative'>
          <DialogTitle className='text-xl font-semibold text-center bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent'>
            {step === 'generate' && 'Create Your Account'}
            {step === 'download' && 'Download Your Key'}
            {step === 'done' && 'Setting Up Your Account'}
          </DialogTitle>
          <DialogDescription className='text-center text-muted-foreground mt-2'>
            {step === 'generate' && 'Generate a secure key for your account'}
            {step === 'download' && "Keep your key safe - you'll need it to log in"}
            {step === 'done' && 'Finalizing your account setup'}
          </DialogDescription>
        </DialogHeader>

        <div className='px-6 py-8 space-y-6'>
          {step === 'generate' && (
            <div className='text-center space-y-6'>
              <div className='p-4 rounded-lg bg-card/50 backdrop-blur-sm border-border/50 shadow-elegant flex items-center justify-center'>
                <Key className='w-16 h-16 text-primary' />
              </div>
              <p className='text-sm text-muted-foreground'>
                We'll generate a secure key for your account. You'll need this key to log in later.
              </p>
              <Button
                className='w-full rounded-full py-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg transition-all duration-300 hover:shadow-elegant-lg hover:scale-105'
                onClick={generateKey}
                disabled={isLoading}
              >
                {isLoading ? 'Generating key...' : 'Generate my key'}
              </Button>
            </div>
          )}

          {step === 'download' && (
            <div className='space-y-6'>
              <div className='p-4 rounded-lg border border-border/50 bg-background/80 backdrop-blur-sm overflow-auto'>
                <code className='text-xs break-all text-foreground'>{nsec}</code>
              </div>

              <div className='text-sm text-muted-foreground space-y-2'>
                <p className='font-medium text-destructive'>Important:</p>
                <ul className='list-disc pl-5 space-y-1'>
                  <li>This is your only way to access your account</li>
                  <li>Store it somewhere safe</li>
                  <li>Never share this key with anyone</li>
                </ul>
              </div>

              <div className='flex flex-col space-y-3'>
                <Button
                  variant='outline'
                  className='w-full bg-background/80 border-border/50 hover:bg-accent/80 transition-all duration-200 backdrop-blur-sm'
                  onClick={downloadKey}
                >
                  <Download className='w-4 h-4 mr-2' />
                  Download Key
                </Button>

                <Button
                  className='w-full rounded-full py-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg transition-all duration-300 hover:shadow-elegant-lg hover:scale-105'
                  onClick={finishSignup}
                >
                  I've saved my key, continue
                </Button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className='flex justify-center items-center py-8'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignupDialog;
