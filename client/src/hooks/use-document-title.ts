import { useEffect } from 'react';
import { APP_NAME } from '@/branding/brand';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    
    if (title) {
      document.title = `${title} | ${APP_NAME}`;
    } else {
      document.title = APP_NAME;
    }

    // Cleanup function to restore previous title
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}

export function setDocumentMeta() {
  // Set viewport meta tag
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');

  // Set description meta tag
  let description = document.querySelector('meta[name="description"]');
  if (!description) {
    description = document.createElement('meta');
    description.setAttribute('name', 'description');
    document.head.appendChild(description);
  }
  description.setAttribute('content', 'Advanced AI companion for emotional connection and dating skill development');

  // Set theme color
  let themeColor = document.querySelector('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement('meta');
    themeColor.setAttribute('name', 'theme-color');
    document.head.appendChild(themeColor);
  }
  themeColor.setAttribute('content', '#e11d48');

  // Link manifest
  let manifest = document.querySelector('link[rel="manifest"]');
  if (!manifest) {
    manifest = document.createElement('link');
    manifest.setAttribute('rel', 'manifest');
    document.head.appendChild(manifest);
  }
  manifest.setAttribute('href', '/site.webmanifest');

  // Add favicon
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.setAttribute('rel', 'icon');
    document.head.appendChild(favicon);
  }
  favicon.setAttribute('href', '/brand/hs-logo.svg');
  favicon.setAttribute('type', 'image/svg+xml');
}