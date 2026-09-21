// Suppress Figma Make internal preview errors
const originalError = console.error;
console.error = (...args: any[]) => {
  // Filter out Figma-specific internal errors
  const errorString = args.join(' ');
  
  if (
    errorString.includes('logPreviewError') ||
    errorString.includes('reduxState') ||
    errorString.includes('Figma internal')
  ) {
    // Silently ignore these Figma Make platform errors
    return;
  }
  
  // Log all other errors normally
  originalError.apply(console, args);
};

export {};
