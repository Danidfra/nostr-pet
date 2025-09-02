import { useState } from 'react';
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, Zap, ArrowLeft } from 'lucide-react';
import { useLightningPayment } from '@/hooks/useLightningPayment';
import { useToast } from '@/hooks/useToast';

interface NotEnoughCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetryPurchase: () => void;
  requiredCoins: number;
  currentCoins: number;
}

export function NotEnoughCoinsModal({
  isOpen,
  onClose,
  onRetryPurchase,
  requiredCoins,
  currentCoins
}: NotEnoughCoinsModalProps) {
  const { COIN_PACKS, initiatePurchase, resetPayment } = useLightningPayment();
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const handleBuyWithSats = () => {
    setIsPurchaseModalOpen(true);
  };

  const handleKeepPlaying = () => {
    onClose();
  };

  const handlePurchaseSuccess = () => {
    setIsPurchaseModalOpen(false);
    onClose();
    onRetryPurchase();
  };

  const handlePurchaseClose = () => {
    setIsPurchaseModalOpen(false);
    resetPayment();
  };

  return (
    <>
      <Dialog open={isOpen && !isPurchaseModalOpen} onOpenChange={onClose}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 flex items-center justify-center">
                <Coins className="w-4 h-4 text-white" />
              </div>
              Not Enough Coins
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Coin Balance Display */}
            <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-2xl border border-yellow-200/50 dark:border-yellow-600/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Current Balance</span>
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="font-bold text-yellow-700 dark:text-yellow-300">{currentCoins.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-red-800 dark:text-red-300">Required</span>
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="font-bold text-red-700 dark:text-red-300">{requiredCoins.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-yellow-200/50 dark:border-yellow-600/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-purple-800 dark:text-purple-300">Needed</span>
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-bold text-purple-700 dark:text-purple-300">
                      {(requiredCoins - currentCoins).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                You can earn more coins by playing games with your Blobbi, or you can buy coins with sats.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={handleKeepPlaying}
              className="flex-1 h-11 rounded-xl border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Keep Playing
            </Button>
            <Button
              onClick={handleBuyWithSats}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Zap className="w-4 h-4 mr-2" />
              Buy with Sats
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Modal */}
      <PurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={handlePurchaseClose}
        onSuccess={handlePurchaseSuccess}
        coinPacks={COIN_PACKS}
      />
    </>
  );
}

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  coinPacks: { id: string; coins: number; sats: number; name: string }[];
}

function PurchaseModal({ isOpen, onClose, onSuccess, coinPacks }: PurchaseModalProps) {
  const { initiatePurchase, isLoading, isProcessing, invoice, selectedPack, paymentStatus, payWithWebLN, startPaymentMonitoring } = useLightningPayment();
  const { toast } = useToast();

  const handlePackSelect = async (pack: { id: string; coins: number; sats: number; name: string }) => {
    try {
      await initiatePurchase(pack);
    } catch (error) {
      toast({
        title: 'Failed to Generate Invoice',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleWebLNPayment = async () => {
    try {
      await payWithWebLN();
      setTimeout(() => {
        onSuccess();
      }, 1000); // Small delay to show success state
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  const handleCopyInvoice = async () => {
    if (!invoice) return;

    try {
      await navigator.clipboard.writeText(invoice);
      toast({
        title: 'Invoice Copied!',
        description: 'BOLT11 invoice copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy invoice to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleTryLater = () => {
    if (selectedPack && invoice) {
      // Start monitoring in background
      startPaymentMonitoring(invoice, selectedPack.coins, selectedPack.sats);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            Buy Coins (⚡ sats)
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Purchase coin packs with Lightning payments
          </DialogDescription>
        </DialogHeader>

        {paymentStatus === 'idle' && (
          <div className="space-y-4">
            <div className="grid gap-3">
              {coinPacks.map((pack) => (
                <Card
                  key={pack.id}
                  className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200/50 dark:border-purple-600/50 rounded-xl cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
                  onClick={() => handlePackSelect(pack)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">{pack.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {pack.coins.toLocaleString()} coins • {pack.sats.toLocaleString()} sats
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0"
                    >
                      Buy
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {(paymentStatus === 'awaiting' || paymentStatus === 'paid' || paymentStatus === 'failed') && selectedPack && (
          <div className="space-y-6">
            {/* Selected Pack Info */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-600/50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">{selectedPack.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedPack.coins.toLocaleString()} coins • {selectedPack.sats.toLocaleString()} sats
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {selectedPack.coins.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">coins</div>
                </div>
              </div>
            </div>

            {paymentStatus === 'awaiting' && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Scan the QR code or copy the invoice to pay:
                  </p>

                  {/* QR Code */}
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-white rounded-xl shadow-inner">
                      {invoice && (
                        <QRCodeComponent
                          value={invoice}
                          size={200}
                          level="M"
                          includeMargin={true}
                          className="rounded-lg"
                        />
                      )}
                    </div>
                  </div>

                  {/* Invoice Actions */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCopyInvoice}
                      className="flex-1"
                    >
                      Copy Invoice
                    </Button>
                    {window.webln && (
                      <Button
                        onClick={handleWebLNPayment}
                        disabled={isProcessing}
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0"
                      >
                        {isProcessing ? 'Processing...' : 'Pay with WebLN'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="text-center">
                  <Button
                    variant="ghost"
                    onClick={handleTryLater}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    I'll try again later
                  </Button>
                </div>
              </div>
            )}

            {paymentStatus === 'paid' && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                  <span className="text-2xl text-white">✅</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Payment Successful!</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedPack.coins.toLocaleString()} coins added to your account.
                  </p>
                </div>
              </div>
            )}

            {paymentStatus === 'failed' && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center">
                  <span className="text-2xl text-white">❌</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Payment Failed</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    The payment could not be completed. Please try again.
                  </p>
                </div>
                <Button
                  onClick={() => handlePackSelect(selectedPack)}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                >
                  {isLoading ? 'Generating...' : 'Try Again'}
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-11 rounded-xl border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Card component for pack display
function Card({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={className} onClick={onClick}>
      {children}
    </div>
  );
}

// QR Code component
function QRCodeComponent({ value, size, level, includeMargin, className }: { value: string; size: number; level: string; includeMargin: boolean; className?: string }) {
  const [qrData, setQrData] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(value, {
        width: size,
        margin: includeMargin ? 1 : 0,
        errorCorrectionLevel: level as 'L' | 'M' | 'Q' | 'H',
      }).then((data) => {
        setQrData(data);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    });
  }, [value, size, includeMargin, level]);

  if (isLoading || !qrData) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-lg`} style={{ width: size, height: size }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return <img src={qrData} alt="QR Code" className={className} />;
}