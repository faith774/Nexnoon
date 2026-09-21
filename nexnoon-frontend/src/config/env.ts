// Environment configuration
// In production, these should come from environment variables

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL;
const apiUrl = import.meta.env.PROD && (!configuredApiUrl || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configuredApiUrl))
  ? 'https://nexnoon-backend.onrender.com/v1'
  : configuredApiUrl || 'http://localhost:4000/v1';

export const ENV = {
  // API Configuration
  API_BASE_URL: apiUrl,
  API_TIMEOUT: 30000,
  
  // App Configuration
  APP_NAME: 'Nexnoon',
  APP_VERSION: '1.0.0',
  
  // Feature Flags
  // Demo mode (mock-data fallback for pages with no backend) is permanently off:
  // this app now always talks to the real API, so every page needs a reachable,
  // seeded backend rather than silently falling back to fake data mid-demo.
  ENABLE_DEMO_MODE: false,
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  
  // Stripe (publishable key only - safe for frontend)
  STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',

  // Zoom Configuration (for live classes)
  ZOOM_SDK_KEY: import.meta.env.VITE_ZOOM_SDK_KEY || '',
  ZOOM_SDK_SECRET: import.meta.env.VITE_ZOOM_SDK_SECRET || '',
} as const;

// Check if running in development
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
