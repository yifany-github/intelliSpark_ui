/**
 * JWT Token Validation Utilities
 * Shared utilities for handling JWT token validation and expiration
 */

export interface JWTPayload {
  exp?: number;
  sub?: string;
  iat?: number;
  [key: string]: any;
}

/**
 * Token validation configuration constants
 */
export const AUTH_CONFIG = {
  TOKEN_BUFFER_SECONDS: 60,
  TOKEN_CACHE_DURATION_MS: 30000, // 30 seconds
} as const;

/**
 * Cache for token validation results to improve performance
 */
const tokenValidityCache = new Map<string, { valid: boolean; timestamp: number }>();

/**
 * Safely decode base64 with proper padding
 */
function safeBase64Decode(str: string): string {
  try {
    // Add padding if needed
    const paddedStr = str.padEnd(str.length + (4 - str.length % 4) % 4, '=');
    return atob(paddedStr);
  } catch (error) {
    throw new Error('Invalid base64 encoding');
  }
}

/**
 * Check if JWT token is valid and not expired
 * @param token - JWT token string
 * @returns true if token is valid and not expired, false otherwise
 */
export const isTokenValid = (token: string): boolean => {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Check cache first for performance
  const cached = tokenValidityCache.get(token);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < AUTH_CONFIG.TOKEN_CACHE_DURATION_MS) {
    return cached.valid;
  }

  try {
    // Validate JWT format
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    
    // Decode and parse payload
    const payloadStr = safeBase64Decode(parts[1]);
    const payload: JWTPayload = JSON.parse(payloadStr);
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check if token has expiration and is not expired (with buffer)
    const isValid = !!(payload.exp && payload.exp > (currentTime + AUTH_CONFIG.TOKEN_BUFFER_SECONDS));
    
    // Cache the result
    tokenValidityCache.set(token, { valid: isValid, timestamp: now });
    
    return isValid;
  } catch (error) {
    // Cache negative result too
    tokenValidityCache.set(token, { valid: false, timestamp: now });
    return false;
  }
};

/**
 * Clear token validation cache (useful for testing or manual cache invalidation)
 */
export const clearTokenValidationCache = (): void => {
  tokenValidityCache.clear();
};

/**
 * Extract payload from JWT token without validation
 * @param token - JWT token string
 * @returns JWT payload or null if invalid
 */
export const getTokenPayload = (token: string): JWTPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payloadStr = safeBase64Decode(parts[1]);
    return JSON.parse(payloadStr) as JWTPayload;
  } catch (error) {
    return null;
  }
};

/**
 * Get token expiration date
 * @param token - JWT token string
 * @returns Date object or null if invalid
 */
export const getTokenExpirationDate = (token: string): Date | null => {
  const payload = getTokenPayload(token);
  if (!payload?.exp) {
    return null;
  }
  
  return new Date(payload.exp * 1000);
};

/**
 * Check if token will expire soon (within buffer time)
 * @param token - JWT token string
 * @returns true if token will expire within buffer time
 */
export const willTokenExpireSoon = (token: string): boolean => {
  const payload = getTokenPayload(token);
  if (!payload?.exp) {
    return true;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp <= (currentTime + AUTH_CONFIG.TOKEN_BUFFER_SECONDS);
};