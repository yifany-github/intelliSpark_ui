import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { Eye, EyeOff, LogIn, UserPlus, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

const AuthModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  title,
  description
}: AuthModalProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, register, loginWithGoogle } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const modalTitle = title || t('loginRequired');
  const modalDescription = description || t('pleaseSignIn');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setIsLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSuccess = () => {
    resetForm();
    toast({
      title: mode === 'login' ? t('loginSuccessful') : t('registrationSuccessful'),
      description: mode === 'login' ? t('welcomeBack') : t('accountCreated'),
    });
    onSuccess?.();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'register') {
        // Validation for registration
        if (password !== confirmPassword) {
          setError(t('passwordsDoNotMatch'));
          return;
        }
        if (password.length < 6) {
          setError(t('mustBeAtLeast6Chars'));
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setError(t('enterValidEmail'));
          return;
        }
        
        await register(email, password);
      } else {
        await login(email, password);
      }
      
      handleSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 
        mode === 'login' ? t('loginFailed') : t('registrationFailed');
      setError(errorMessage);
      toast({
        title: mode === 'login' ? t('loginFailed') : t('registrationFailed'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      await loginWithGoogle();
      handleSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('googleLoginFailed');
      setError(errorMessage);
      toast({
        title: t('googleLoginFailed'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                {mode === 'login' ? (
                  <>
                    <LogIn className="h-5 w-5 text-blue-600" />
                    {modalTitle}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 text-green-600" />
                    {t('createAccount')}
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {mode === 'login' ? modalDescription : t('signUpToStart')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="modal-email">{t('email')}</Label>
            <Input
              id="modal-email"
              type="email"
              placeholder={t('enterEmail')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="modal-password">{t('password')}</Label>
            <div className="relative">
              <Input
                id="modal-password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === 'login' ? t('enterPassword') : t('createPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="pr-10"
                minLength={mode === 'register' ? 6 : 1}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {mode === 'register' && (
              <p className="text-xs text-gray-500">{t('mustBeAtLeast6Chars')}</p>
            )}
          </div>
          
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="modal-confirm-password">{t('confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="modal-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t('confirmYourPassword')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10"
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
          
          <div className="flex flex-col gap-3 pt-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 
                (mode === 'login' ? t('signingIn') : t('creatingAccount')) : 
                (mode === 'login' ? t('signIn') : t('createAccount'))
              }
            </Button>
            
            {mode === 'login' && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t('orContinueWith')}</span>
                  </div>
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {t('continueWithGoogle')}
                </Button>
              </>
            )}
            
            <div className="text-center">
              <button
                type="button"
                onClick={switchMode}
                className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                disabled={isLoading}
              >
                {mode === 'login' 
                  ? t('dontHaveAccount') 
                  : t('alreadyHaveAccount')
                }
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;