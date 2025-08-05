import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { useToast } from '../../hooks/use-toast';
import { Link } from 'wouter';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import LanguageSelector from '../../components/settings/LanguageSelector';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { register, loginWithGoogle } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { navigateToHome } = useNavigation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('mustBeAtLeast6Chars'));
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('enterValidEmail'));
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password);
      toast({
        title: t('registrationSuccessful'),
        description: t('accountCreated'),
      });
      // Explicitly redirect to main app
      navigateToHome();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('registrationFailed');
      setError(errorMessage);
      toast({
        title: t('registrationFailed'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError('');
    setIsLoading(true);

    try {
      await loginWithGoogle();
      toast({
        title: t('registrationSuccessful'),
        description: t('accountCreated'),
      });
      // Explicitly redirect to main app
      navigateToHome();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <LanguageSelector type="interface" className="w-48" />
        </div>
        <Card className="w-full shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-green-100 rounded-full">
                <UserPlus className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center font-bold text-gray-800">{t('createAccount')}</CardTitle>
            <CardDescription className="text-center text-gray-600">
              {t('signUpToStart')}
            </CardDescription>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-medium">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('enterEmail')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="border-gray-300 focus:border-green-500 focus:ring-green-500"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-medium">{t('password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t('createPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                  minLength={6}
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
              <p className="text-xs text-gray-500">
                {t('mustBeAtLeast6Chars')}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">{t('confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t('confirmYourPassword')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
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
            
            <Button 
              type="submit" 
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5" 
              disabled={isLoading}
            >
              {isLoading ? t('creatingAccount') : t('createAccount')}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-gray-500 font-medium">{t('orContinueWith')}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full mt-4 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2.5"
              onClick={handleGoogleRegister}
              disabled={isLoading}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path 
                  fill="currentColor" 
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path 
                  fill="currentColor" 
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path 
                  fill="currentColor" 
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path 
                  fill="currentColor" 
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('continueWithGoogle')}
            </Button>
          </div>
          
          <div className="mt-6 text-center">
            <Link href="/login">
              <a className="text-sm text-green-600 hover:text-green-500 font-medium">
                {t('alreadyHaveAccount')}
              </a>
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default RegisterPage;