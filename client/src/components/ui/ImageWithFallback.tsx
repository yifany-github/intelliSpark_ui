import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageWithFallbackProps {
  src?: string;
  alt: string;
  fallbackText: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showSpinner?: boolean;
}

// Utility function to convert relative URLs to absolute URLs
const getAbsoluteUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  return `${API_BASE_URL}${url}`;
};

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12", 
  lg: "h-16 w-16",
  xl: "h-24 w-24"
};

const ImageWithFallback = ({ 
  src, 
  alt, 
  fallbackText, 
  className,
  size = "md",
  showSpinner = true
}: ImageWithFallbackProps) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!src);

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  // Generate initials from fallback text
  const getInitials = (text: string) => {
    return text
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const absoluteUrl = getAbsoluteUrl(src);

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {absoluteUrl && !hasError && (
        <AvatarImage 
          src={absoluteUrl} 
          alt={alt}
          onError={handleError}
          onLoad={handleLoad}
        />
      )}
      <AvatarFallback className="bg-gradient-to-r from-primary/40 to-accent/40 text-white font-medium">
        {isLoading && showSpinner ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          getInitials(fallbackText)
        )}
      </AvatarFallback>
    </Avatar>
  );
};

export default ImageWithFallback;