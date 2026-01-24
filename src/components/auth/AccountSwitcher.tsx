// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { ChevronDown, LogOut, UserIcon, UserPlus, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { cn } from '@/lib/utils';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();

  if (!currentUser) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          'flex items-center gap-3 p-3 rounded-full w-full max-w-60',
          'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm',
          'border border-purple-200/50 dark:border-purple-600/50',
          'hover:bg-purple-50 dark:hover:bg-purple-900/20',
          'hover:border-purple-300 dark:hover:border-purple-500',
          'hover:shadow-elegant hover:scale-105',
          'transition-all duration-300',
          'text-gray-900 dark:text-gray-100'
        )}>
          <Avatar className='w-10 h-10 ring-2 ring-purple-200/50 dark:ring-purple-600/50'>
            <AvatarImage src={currentUser.metadata.picture} alt={currentUser.metadata.name} />
            <AvatarFallback className='bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 text-purple-700 dark:text-purple-300'>
              {currentUser.metadata.name?.charAt(0) || <UserIcon className='w-5 h-5' />}
            </AvatarFallback>
          </Avatar>
          <div className='flex-1 text-left block truncate'>
            <p className='font-medium text-sm truncate'>{currentUser.metadata.name || currentUser.pubkey}</p>
          </div>
          <ChevronDown className='w-4 h-4 text-purple-600 dark:text-purple-400' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn(
        'w-64 p-3 animate-scale-in shadow-xl backdrop-blur-sm rounded-2xl',
        'bg-white/95 dark:bg-gray-900/95',
        'border border-purple-200/50 dark:border-purple-600/50'
      )}>
        {/* Header */}
        <div className='flex items-center gap-2 mb-3 px-2'>
          <div className='w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center'>
            <UserIcon className='w-3.5 h-3.5 text-white' />
          </div>
          <div className='font-semibold text-sm bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent'>
            Switch Account
          </div>
        </div>

        {/* Current Account - Highlighted */}
        <div className={cn(
          'mb-3 p-3 rounded-xl',
          'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
          'border border-purple-200/50 dark:border-purple-600/50'
        )}>
          <div className='flex items-center gap-3'>
            <Avatar className='w-10 h-10 ring-2 ring-purple-300 dark:ring-purple-500'>
              <AvatarImage src={currentUser.metadata.picture} alt={currentUser.metadata.name} />
              <AvatarFallback className='bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 text-purple-700 dark:text-purple-300'>
                {currentUser.metadata.name?.charAt(0) || <UserIcon className='w-5 h-5' />}
              </AvatarFallback>
            </Avatar>
            <div className='flex-1 truncate'>
              <p className='text-sm font-semibold text-gray-900 dark:text-gray-100 truncate'>
                {currentUser.metadata.name || currentUser.pubkey}
              </p>
              <p className='text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1'>
                <Check className='w-3 h-3' />
                Active
              </p>
            </div>
          </div>
        </div>

        {/* Other Accounts */}
        {otherUsers.length > 0 && (
          <>
            <div className='text-xs font-medium text-gray-600 dark:text-gray-400 px-2 mb-2'>
              Other Accounts
            </div>
            <div className='space-y-1 mb-3'>
              {otherUsers.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => setLogin(user.id)}
                  className={cn(
                    'flex items-center gap-3 cursor-pointer p-3 rounded-xl',
                    'hover:bg-purple-50 dark:hover:bg-purple-900/20',
                    'border border-transparent hover:border-purple-200/50 dark:hover:border-purple-600/50',
                    'transition-all duration-200'
                  )}
                >
                  <Avatar className='w-8 h-8'>
                    <AvatarImage src={user.metadata.picture} alt={user.metadata.name} />
                    <AvatarFallback className='bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'>
                      {user.metadata.name?.charAt(0) || <UserIcon className='w-4 h-4' />}
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex-1 truncate'>
                    <p className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                      {user.metadata.name || user.pubkey}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </>
        )}

        <DropdownMenuSeparator className='my-2 bg-purple-200/50 dark:bg-purple-600/50' />

        {/* Add Account Button - Purple Gradient */}
        <DropdownMenuItem
          onClick={onAddAccountClick}
          className={cn(
            'flex items-center justify-center gap-2 cursor-pointer p-3 rounded-xl mb-2',
            'bg-gradient-to-r from-purple-500 to-pink-500',
            'hover:from-purple-600 hover:to-pink-600',
            'text-white font-medium shadow-lg',
            'transition-all duration-300 hover:shadow-elegant-lg hover:scale-[1.02]'
          )}
        >
          <UserPlus className='w-4 h-4' />
          <span>Add another account</span>
        </DropdownMenuItem>

        {/* Log Out Button - Destructive */}
        <DropdownMenuItem
          onClick={() => removeLogin(currentUser.id)}
          className={cn(
            'flex items-center justify-center gap-2 cursor-pointer p-3 rounded-xl',
            'text-red-600 dark:text-red-400 font-medium',
            'hover:bg-red-50 dark:hover:bg-red-900/20',
            'border border-transparent hover:border-red-200/50 dark:hover:border-red-600/50',
            'transition-all duration-200'
          )}
        >
          <LogOut className='w-4 h-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}