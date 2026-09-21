// Agora.io Configuration
// Set VITE_AGORA_APP_ID and optionally VITE_AGORA_TOKEN_SERVER_URL in .env
// Get your App ID from https://console.agora.io/
const rawTokenUrl = import.meta.env.VITE_AGORA_TOKEN_SERVER_URL;

export const AGORA_CONFIG = {
  APP_ID: import.meta.env.VITE_AGORA_APP_ID || 'e7f6e9aeecf14b2ba10e3f40be9f56e7',
  TOKEN_SERVER_URL: (rawTokenUrl === '' || rawTokenUrl === undefined) ? null : (rawTokenUrl as string),
};

// Generate a simple channel name based on class ID
export const generateChannelName = (classId: string | number) => {
  return `nexnoon_class_${classId}`;
};

// Generate a unique user ID
export const generateUserId = () => {
  return Math.floor(Math.random() * 1000000);
};