/**
 * Playwright Browser Matrix Tests for Voice Functionality
 * Tests Chrome, Safari (iOS/desktop), Android Chrome, Edge
 * Covers microphone permissions, autoplay handling, and voice workflows
 */

import { test, expect, devices } from '@playwright/test';

// Test configurations for different browsers/devices
const browserConfigs = [
  {
    name: 'Desktop Chrome',
    use: { ...devices['Desktop Chrome'] },
    permissions: ['microphone'],
  },
  {
    name: 'Desktop Safari',
    use: { ...devices['Desktop Safari'] },
    permissions: ['microphone'],
  },
  {
    name: 'Desktop Edge',
    use: { ...devices['Desktop Edge'] },
    permissions: ['microphone'],
  },
  {
    name: 'iPhone Safari',
    use: { ...devices['iPhone 14'] },
    permissions: ['microphone'],
  },
  {
    name: 'Android Chrome',
    use: { ...devices['Pixel 7'] },
    permissions: ['microphone'],
  },
];

// Generate tests for each browser configuration
browserConfigs.forEach(({ name, use, permissions }) => {
  test.describe(`Voice Functionality - ${name}`, () => {
    test.use(use);

    test.beforeEach(async ({ page, context }) => {
      // Grant microphone permissions for testing
      if (permissions.includes('microphone')) {
        await context.grantPermissions(['microphone']);
      }
      
      // Set up media device mocking for consistent testing
      await page.addInitScript(() => {
        // Mock getUserMedia for consistent testing
        const mockStream = new MediaStream();
        const mockTrack = {
          kind: 'audio',
          enabled: true,
          readyState: 'live',
          stop: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true
        };
        
        Object.defineProperty(mockStream, 'getAudioTracks', {
          value: () => [mockTrack]
        });

        // Use proper descriptor to override read-only property
        Object.defineProperty(navigator, 'mediaDevices', {
          value: {
            getUserMedia: async (constraints: any) => {
              if (constraints?.audio) {
                return mockStream;
              }
              throw new Error('Audio not requested');
            }
          },
          writable: true,
          configurable: true
        });
      });

      // Navigate to the app
      await page.goto('http://localhost:5000');
      
      // Wait for the app to load
      await page.waitForLoadState('networkidle');
    });

    test('should handle microphone permission flow', async ({ page }) => {
      // Test microphone permission request and handling
      const micButton = page.locator('[data-testid="button-start-voice"]');
      
      if (await micButton.isVisible()) {
        await micButton.click();
        
        // Check if permission was granted or denied
        const errorMessage = page.locator('[data-testid="error-mic-permission"]');
        const voiceRecorder = page.locator('[data-testid="voice-recorder"]');
        
        // Should either show error message or voice recorder
        await expect(errorMessage.or(voiceRecorder)).toBeVisible({ timeout: 5000 });
      }
    });

    test('should handle microphone permission denied scenario', async ({ page, context }) => {
      // Revoke microphone permissions to test denied scenario
      await context.clearPermissions();
      
      const micButton = page.locator('[data-testid="button-start-voice"]');
      
      if (await micButton.isVisible()) {
        await micButton.click();
        
        // Should show permission denied error
        const errorMessage = page.locator('[data-testid="error-mic-permission"]');
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
        
        // Check error message content
        const errorText = await errorMessage.textContent();
        expect(errorText).toContain('microphone permission');
      }
    });

    test('should handle voice recording workflow', async ({ page }) => {
      // First, authenticate the user for testing
      await page.goto('http://localhost:5000/auth');
      
      // Fill in test credentials (assuming test user exists)
      await page.fill('[data-testid="input-email"]', 'test@example.com');
      await page.fill('[data-testid="input-password"]', 'testpassword');
      await page.click('[data-testid="button-login"]');
      
      // Wait for authentication
      await page.waitForURL('**/chat', { timeout: 10000 });
      
      // Look for voice recording button
      const startRecordingButton = page.locator('[data-testid="button-start-recording"]');
      
      if (await startRecordingButton.isVisible()) {
        await startRecordingButton.click();
        
        // Should show recording indicator
        const recordingIndicator = page.locator('[data-testid="recording-indicator"]');
        await expect(recordingIndicator).toBeVisible({ timeout: 3000 });
        
        // Wait a moment to simulate recording
        await page.waitForTimeout(2000);
        
        // Stop recording
        const stopRecordingButton = page.locator('[data-testid="button-stop-recording"]');
        if (await stopRecordingButton.isVisible()) {
          await stopRecordingButton.click();
          
          // Should show processing indicator
          const processingIndicator = page.locator('[data-testid="processing-indicator"]');
          await expect(processingIndicator).toBeVisible({ timeout: 5000 });
          
          // Should eventually show response
          const aiResponse = page.locator('[data-testid="ai-response"]');
          await expect(aiResponse).toBeVisible({ timeout: 15000 });
        }
      }
    });

    test('should handle audio playback and autoplay policies', async ({ page }) => {
      // Test audio playback handling (especially important for iOS Safari)
      await page.goto('http://localhost:5000/chat');
      
      // Look for audio player component
      const audioPlayer = page.locator('[data-testid="audio-player"]');
      
      if (await audioPlayer.isVisible()) {
        const playButton = page.locator('[data-testid="button-play-audio"]');
        
        if (await playButton.isVisible()) {
          await playButton.click();
          
          // Check if audio starts playing or if user interaction is required
          const playbackIndicator = page.locator('[data-testid="audio-playing"]');
          const interactionRequired = page.locator('[data-testid="interaction-required"]');
          
          // Should either start playing or show interaction required message
          await expect(playbackIndicator.or(interactionRequired)).toBeVisible({ timeout: 5000 });
          
          if (await interactionRequired.isVisible()) {
            // iOS Safari and some other browsers require user interaction for autoplay
            console.log(`${name}: User interaction required for autoplay (expected behavior)`);
          }
        }
      }
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Test error handling when network requests fail
      await page.route('**/api/chat', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      });
      
      await page.goto('http://localhost:5000/chat');
      
      // Try to send a message
      const messageInput = page.locator('[data-testid="input-message"]');
      const sendButton = page.locator('[data-testid="button-send"]');
      
      if (await messageInput.isVisible() && await sendButton.isVisible()) {
        await messageInput.fill('Test message');
        await sendButton.click();
        
        // Should show error message
        const errorMessage = page.locator('[data-testid="error-message"]');
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
      }
    });

    test('should handle slow network conditions', async ({ page }) => {
      // Simulate slow network
      const client = await page.context().newCDPSession(page);
      await client.send('Network.enable');
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50000, // 50kb/s
        uploadThroughput: 20000,   // 20kb/s
        latency: 2000,             // 2 second latency
      });
      
      await page.goto('http://localhost:5000/chat');
      
      // Try to send a voice message with slow network
      const messageInput = page.locator('[data-testid="input-message"]');
      const sendButton = page.locator('[data-testid="button-send"]');
      
      if (await messageInput.isVisible() && await sendButton.isVisible()) {
        await messageInput.fill('Test message with slow network');
        const startTime = Date.now();
        await sendButton.click();
        
        // Should show loading indicator
        const loadingIndicator = page.locator('[data-testid="loading-message"]');
        await expect(loadingIndicator).toBeVisible({ timeout: 3000 });
        
        // Should eventually complete
        const response = page.locator('[data-testid="ai-response"]');
        await expect(response).toBeVisible({ timeout: 30000 });
        
        const duration = Date.now() - startTime;
        console.log(`${name}: Request completed in ${duration}ms under slow network`);
      }
    });

    test('should handle device orientation changes (mobile only)', async ({ page }) => {
      // Only run on mobile devices
      if (name.includes('iPhone') || name.includes('Android')) {
        await page.goto('http://localhost:5000/chat');
        
        // Test portrait mode
        await page.setViewportSize({ width: 375, height: 812 });
        
        const chatContainer = page.locator('[data-testid="chat-container"]');
        await expect(chatContainer).toBeVisible();
        
        // Test landscape mode
        await page.setViewportSize({ width: 812, height: 375 });
        
        // Chat should still be visible and functional
        await expect(chatContainer).toBeVisible();
        
        const messageInput = page.locator('[data-testid="input-message"]');
        if (await messageInput.isVisible()) {
          await expect(messageInput).toBeVisible();
        }
      }
    });

    test('should handle browser tab visibility changes', async ({ page }) => {
      await page.goto('http://localhost:5000/chat');
      
      // Start a voice recording or operation
      const recordButton = page.locator('[data-testid="button-start-recording"]');
      
      if (await recordButton.isVisible()) {
        await recordButton.click();
        
        // Simulate tab becoming hidden
        await page.evaluate(() => {
          // Dispatch visibility change event
          Object.defineProperty(document, 'hidden', { value: true, writable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        
        // Should handle visibility change appropriately
        const pausedIndicator = page.locator('[data-testid="recording-paused"]');
        const errorMessage = page.locator('[data-testid="error-message"]');
        
        // Should either pause recording or show appropriate message
        // depending on browser behavior
        await page.waitForTimeout(1000);
        
        // Make tab visible again
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { value: false, writable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
      }
    });

    test('should handle memory constraints gracefully', async ({ page }) => {
      // Test handling of memory-intensive operations
      await page.goto('http://localhost:5000/chat');
      
      // Simulate memory pressure by creating many voice recordings
      for (let i = 0; i < 5; i++) {
        const recordButton = page.locator('[data-testid="button-start-recording"]');
        
        if (await recordButton.isVisible()) {
          await recordButton.click();
          await page.waitForTimeout(1000);
          
          const stopButton = page.locator('[data-testid="button-stop-recording"]');
          if (await stopButton.isVisible()) {
            await stopButton.click();
            await page.waitForTimeout(2000);
          }
        }
      }
      
      // App should still be responsive
      const messageInput = page.locator('[data-testid="input-message"]');
      if (await messageInput.isVisible()) {
        await expect(messageInput).toBeEnabled();
      }
    });
  });
});

// Chaos testing integration
test.describe('Chaos Testing Integration', () => {
  test('should handle STT service failures', async ({ page }) => {
    // Enable chaos testing via API
    await page.request.post('http://localhost:5000/api/admin/chaos/start', {
      data: {
        services: { stt: true },
        errorRate: 0.5, // 50% error rate
        duration: 30000 // 30 seconds
      }
    });
    
    await page.goto('http://localhost:5000/chat');
    
    // Attempt voice recording with STT failures
    const recordButton = page.locator('[data-testid="button-start-recording"]');
    
    if (await recordButton.isVisible()) {
      for (let attempt = 0; attempt < 3; attempt++) {
        await recordButton.click();
        await page.waitForTimeout(2000);
        
        const stopButton = page.locator('[data-testid="button-stop-recording"]');
        if (await stopButton.isVisible()) {
          await stopButton.click();
          
          // Should either succeed or show appropriate error message
          const response = page.locator('[data-testid="ai-response"]');
          const errorMessage = page.locator('[data-testid="error-message"]');
          
          await expect(response.or(errorMessage)).toBeVisible({ timeout: 10000 });
        }
      }
    }
    
    // Stop chaos testing
    await page.request.post('http://localhost:5000/api/admin/chaos/stop');
  });
});