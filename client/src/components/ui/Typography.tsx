import React from 'react';
import { cn } from '@/lib/utils';

interface TypographyProps {
  variant: 'display-2xl' | 'display-xl' | 'display-lg' | 'heading-xl' | 'heading-lg' | 'heading-md' | 'heading-sm' | 'heading-xs' | 'body-xl' | 'body-lg' | 'body-md' | 'body-sm' | 'caption-lg' | 'caption-md' | 'caption-sm';
  element?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
  children: React.ReactNode;
  className?: string;
  serif?: boolean;
}

const variantStyles = {
  'display-2xl': 'text-display-2xl',
  'display-xl': 'text-display-xl',
  'display-lg': 'text-display-lg',
  'heading-xl': 'text-heading-xl',
  'heading-lg': 'text-heading-lg',
  'heading-md': 'text-heading-md',
  'heading-sm': 'text-heading-sm',
  'heading-xs': 'text-heading-xs',
  'body-xl': 'text-body-xl',
  'body-lg': 'text-body-lg',
  'body-md': 'text-body-md',
  'body-sm': 'text-body-sm',
  'caption-lg': 'text-caption-lg',
  'caption-md': 'text-caption-md',
  'caption-sm': 'text-caption-sm',
};

export function Typography({ 
  variant, 
  element = 'p', 
  children, 
  className = '', 
  serif = false 
}: TypographyProps) {
  const Component = element as keyof JSX.IntrinsicElements;
  
  return (
    <Component 
      className={cn(
        variantStyles[variant],
        serif ? 'font-serif' : 'font-sans',
        className
      )}
    >
      {children}
    </Component>
  );
}

// Convenience components for common usage
export const DisplayText = (props: Omit<TypographyProps, 'variant'> & { size: 'xl' | 'lg' | '2xl' }) => 
  <Typography {...props} variant={`display-${props.size}` as any} element="h1" serif />;

export const HeadingText = (props: Omit<TypographyProps, 'variant'> & { size: 'xl' | 'lg' | 'md' | 'sm' | 'xs', level?: 1 | 2 | 3 | 4 | 5 | 6 }) => 
  <Typography {...props} variant={`heading-${props.size}` as any} element={`h${props.level || 2}` as any} serif />;

export const BodyText = (props: Omit<TypographyProps, 'variant'> & { size: 'xl' | 'lg' | 'md' | 'sm' }) => 
  <Typography {...props} variant={`body-${props.size}` as any} element="p" />;

export const CaptionText = (props: Omit<TypographyProps, 'variant'> & { size: 'lg' | 'md' | 'sm' }) => 
  <Typography {...props} variant={`caption-${props.size}` as any} element="span" />;