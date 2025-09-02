import { useState } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useAddCoins } from '@/hooks/useCoinBalance';

interface LNURLPayResponse {
  callback: string;
  maxSendable: number;
  minSendable: number;
  metadata: string;
  commentAllowed?: number;
  tag: 'payRequest';
}

interface InvoiceResponse {
  pr: string; // BOLT11 invoice
  routes?: unknown[];
}

export interface CoinPack {
  id: string;
  coins: number;
  sats: number;
  name: string;
}

export const COIN_PACKS: CoinPack[] = [
  { id: 'pack-10k', coins: 10_000, sats: 1_000, name: 'Starter Pack' },
  { id: 'pack-50k', coins: 50_000, sats: 5_000, name: 'Premium Pack' },
  { id: 'pack-120k', coins: 120_000, sats: 12_000, name: 'Elite Pack' },
];

const LIGHTNING_ADDRESS = 'shiftyhome75@walletofsatoshi.com';
const LNURL_BECH32 = 'lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhhx6rfve68j6r0d4jnwdgzd6klh';

export function useLightningPayment() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { mutate: publishEvent } = useNostrPublish();
  const addCoins = useAddCoins();

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoice, setInvoice] = useState<string>('');
  const [selectedPack, setSelectedPack] = useState<CoinPack | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'awaiting' | 'paid' | 'failed'>('idle');
  const [paymentHash, setPaymentHash] = useState<string>('');

  const decodeLNURL = async (lnurl: string): Promise<string> => {
    try {
      // Simple bech32 decoding for lnurl
      const { bech32 } = await import('bech32');
      const { words } = bech32.decode(lnurl, 1023);
      const buffer = Buffer.from(bech32.fromWords(words));
      return buffer.toString('utf8');
    } catch (error) {
      throw new Error('Failed to decode LNURL');
    }
  };

  const getLNURLPayMetadata = async (): Promise<LNURLPayResponse> => {
    try {
      const url = await decodeLNURL(LNURL_BECH32);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch LNURL metadata');
      }
      return await response.json();
    } catch (error) {
      throw new Error(`LNURL metadata error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const generateInvoice = async (amountMsats: number): Promise<InvoiceResponse> => {
    try {
      const metadata = await getLNURLPayMetadata();

      // Validate amount
      if (amountMsats < metadata.minSendable || amountMsats > metadata.maxSendable) {
        throw new Error(`Amount must be between ${metadata.minSendable / 1000} and ${metadata.maxSendable / 1000} sats`);
      }

      const callbackUrl = new URL(metadata.callback);
      callbackUrl.searchParams.set('amount', amountMsats.toString());

      const response = await fetch(callbackUrl.toString());
      if (!response.ok) {
        throw new Error('Failed to generate invoice');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Invoice generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const initiatePurchase = async (pack: CoinPack): Promise<{ invoice: string; paymentHash: string }> => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    setIsLoading(true);
    try {
      setSelectedPack(pack);

      // Generate invoice (sats to msats)
      const amountMsats = pack.sats * 1000;
      const invoiceResponse = await generateInvoice(amountMsats);

      // Extract payment hash from invoice - simplified approach
      // For now, we'll generate a hash from the invoice string
      // In production, you'd want to properly parse the BOLT11 invoice
      const paymentHash = `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('Generated payment hash for invoice:', paymentHash);

      setInvoice(invoiceResponse.pr);
      setPaymentHash(paymentHash);
      setPaymentStatus('awaiting');

      return { invoice: invoiceResponse.pr, paymentHash };
    } catch (error) {
      setPaymentStatus('failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const payWithWebLN = async (): Promise<void> => {
    if (!invoice || !selectedPack || !user) {
      throw new Error('No invoice or selected pack');
    }

    setIsProcessing(true);
    try {
      // Check if WebLN is available
      if (!window.webln) {
        throw new Error('WebLN wallet not found. Please install a WebLN-enabled wallet extension.');
      }

      // Request WebLN to enable
      await window.webln.enable();

      // Send payment
      const paymentResponse = await window.webln.sendPayment(invoice);

      if (paymentResponse.preimage) {
        // Payment successful
        await creditCoins(selectedPack.coins, selectedPack.sats, paymentHash);
        setPaymentStatus('paid');

        toast({
          title: 'Payment Successful!',
          description: `${selectedPack.coins.toLocaleString()} coins added to your account.`,
        });
      } else {
        throw new Error('Payment failed - no preimage received');
      }
    } catch (error) {
      setPaymentStatus('failed');
      toast({
        title: 'WebLN Payment Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const creditCoins = async (coins: number, sats: number, bolt11Hash?: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      // Use the centralized addCoins function which handles event publishing
      await addCoins(coins, sats, bolt11Hash);

      // Update local state
      setPaymentStatus('paid');
    } catch (error) {
      console.error('Failed to credit coins:', error);
      throw new Error('Failed to credit coins to account');
    }
  };

  const startPaymentMonitoring = (paymentHash: string, coins: number, sats: number, timeoutMinutes: number = 10): void => {
    if (!user) return;

    const startTime = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const checkForZapReceipt = async () => {
      try {
        // Query for zap receipts (kind 9735) from our npub within the time window
        const events = await nostr.query([{
          kinds: [9735],
          authors: [user.pubkey],
          since: Math.floor(startTime / 1000),
        }]);

        // Look for a zap receipt that references our payment hash
        const zapReceipt = events.find(event => {
          const descriptionTag = event.tags.find(([name]) => name === 'description');
          if (!descriptionTag) return false;

          try {
            const description = JSON.parse(descriptionTag[1]);
            return description.hash === paymentHash;
          } catch {
            return false;
          }
        });

        if (zapReceipt) {
          // Extract amount from zap receipt
          const amountTag = zapReceipt.tags.find(([name]) => name === 'amount');
          const amountMsats = amountTag ? parseInt(amountTag[1]) : 0;
          const receivedSats = Math.floor(amountMsats / 1000);

          if (receivedSats >= sats) {
            await creditCoins(coins, sats, paymentHash);
            toast({
              title: 'Payment Confirmed!',
              description: `${coins.toLocaleString()} coins added to your account via zap receipt.`,
            });
            return;
          }
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          setPaymentStatus('failed');
          toast({
            title: 'Payment Timeout',
            description: 'Payment not confirmed within 10 minutes. Please try again.',
            variant: 'destructive',
          });
          return;
        }

        // Continue monitoring
        setTimeout(checkForZapReceipt, 5000); // Check every 5 seconds
      } catch (error) {
        console.error('Error checking for zap receipt:', error);
        // Continue monitoring
        setTimeout(checkForZapReceipt, 5000);
      }
    };

    checkForZapReceipt();
  };

  const resetPayment = (): void => {
    setInvoice('');
    setSelectedPack(null);
    setPaymentStatus('idle');
    setPaymentHash('');
    setIsProcessing(false);
    setIsLoading(false);
  };

  return {
    isLoading,
    isProcessing,
    invoice,
    selectedPack,
    paymentStatus,
    paymentHash,
    initiatePurchase,
    payWithWebLN,
    resetPayment,
    startPaymentMonitoring,
    COIN_PACKS,
  };
}

// Add WebLN type declarations
declare global {
  interface Window {
    webln?: {
      enable: () => Promise<void>;
      sendPayment: (invoice: string) => Promise<{ preimage: string }>;
    };
  }
}