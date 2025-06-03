import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useLoginActions } from '@/hooks/useLoginActions';
import { LogOut, User, Key, Wallet, ChevronDown, UserPlus } from 'lucide-react';
import { LoginArea } from '@/components/auth/LoginArea';

export function AccountSwitcher() {
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const { user } = useCurrentUser();
  const { logout } = useLoginActions();
  const author = useAuthor(user?.pubkey);
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || metadata?.display_name || 'Anonymous';
  const profileImage = metadata?.picture;
  const shortPubkey = user?.pubkey ? `${user.pubkey.slice(0, 8)}...${user.pubkey.slice(-4)}` : '';
  
  const handleDisconnect = () => {
    logout();
  };

  const handleSwitchAccount = () => {
    setShowLoginDialog(true);
  };

  if (!user) {
    return (
      <>
        <div className="fixed top-4 right-4 z-50">
          <Button
            onClick={handleSwitchAccount}
            variant="outline"
            size="sm"
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-50/80 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-500 shadow-lg transition-all duration-200"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Connect Account
          </Button>
        </div>

        <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-purple-600" />
                Connect Your Nostr Account
              </DialogTitle>
              <DialogDescription>
                Connect your Nostr account to start your Blobbi journey
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <LoginArea />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-purple-200 dark:border-purple-600 hover:bg-purple-50/80 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-500 shadow-lg p-2 h-auto transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border-2 border-purple-200">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback className="bg-gradient-to-r from-purple-400 to-pink-400 text-white text-xs">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-24">
                    {displayName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {shortPubkey}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-64 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-purple-200 dark:border-purple-600 shadow-xl">
            <DropdownMenuLabel className="pb-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-purple-200">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback className="bg-gradient-to-r from-purple-400 to-pink-400 text-white">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {displayName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {shortPubkey}
                  </span>
                  {metadata?.nip05 && (
                    <Badge variant="secondary" className="text-xs mt-1 w-fit">
                      ✓ {metadata.nip05}
                    </Badge>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={handleSwitchAccount}
              className="cursor-pointer hover:bg-purple-50/80 dark:hover:bg-purple-900/20 focus:bg-purple-50/80 dark:focus:bg-purple-900/20 transition-colors duration-150"
            >
              <UserPlus className="h-4 w-4 mr-2 text-gray-500" />
              <span className='text-gray-500'>Switch Account</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={handleDisconnect}
              className="cursor-pointer hover:bg-red-50/80 dark:hover:bg-red-900/20 focus:bg-red-50/80 dark:focus:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors duration-150"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span>Disconnect</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-600" />
              Switch Nostr Account
            </DialogTitle>
            <DialogDescription>
              Connect a different Nostr account or extension
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <LoginArea />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}