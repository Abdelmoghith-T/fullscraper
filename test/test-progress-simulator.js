#!/usr/bin/env node

/**
 * Test Progress Simulator
 * Demonstrates the realistic loading bar experience
 */

import chalk from 'chalk';

/**
 * Progress Simulator - Creates realistic loading bar experience
 */
class ProgressSimulator {
  constructor() {
    this.currentProgress = 0;
    this.isComplete = false;
    this.startTime = Date.now();
    this.intervalId = null;
    this.lastUpdateTime = 0;
    this.phase = 'querying';
  }

  /**
   * Start the progress simulation
   */
  start(onProgress) {
    this.onProgress = onProgress;
    this.startTime = Date.now();
    this.currentProgress = 0;
    this.isComplete = false;
    this.lastUpdateTime = 0;
    
    console.log(chalk.blue('🚀 Starting progress simulation...'));
    console.log(chalk.gray('   This will simulate a realistic loading experience'));
    console.log(chalk.gray('   Progress updates every 5-20 seconds with natural timing\n'));
    
    // Start the progress simulation
    this.simulateProgress();
  }

  /**
   * Stop the progress simulation and jump to 100%
   */
  complete() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Jump to 100% immediately
    this.currentProgress = 100;
    this.isComplete = true;
    
    console.log(chalk.green('\n✅ Progress: 100% — Scraping complete!'));
    
    if (this.onProgress) {
      this.onProgress({
        processed: 100,
        total: 100,
        phase: this.phase,
        message: 'Progress: 100% — Scraping complete!'
      });
    }
  }

  /**
   * Simulate natural progress updates
   */
  simulateProgress() {
    const updateProgress = () => {
      if (this.isComplete) return;

      const now = Date.now();
      const elapsed = now - this.startTime;
      
      // Calculate natural progress based on elapsed time
      let newProgress = this.calculateNaturalProgress(elapsed);
      
      // Ensure progress doesn't go backwards and doesn't exceed 95% until completion
      if (newProgress > this.currentProgress && newProgress < 95) {
        this.currentProgress = newProgress;
        
        // Generate realistic progress message
        const message = this.generateProgressMessage(this.currentProgress);
        
        // Display progress update
        const elapsedSeconds = Math.floor(elapsed / 1000);
        console.log(chalk.cyan(`[${elapsedSeconds}s] ${message}`));
        
        if (this.onProgress) {
          this.onProgress({
            processed: Math.floor(this.currentProgress),
            total: 100,
            phase: this.phase,
            message: message
          });
        }
      }
      
      this.lastUpdateTime = now;
    };

    // Update progress every 5-20 seconds with random intervals
    const scheduleNextUpdate = () => {
      if (this.isComplete) return;
      
      // Random interval between 5-20 seconds
      const minInterval = 5000;
      const maxInterval = 20000;
      const interval = Math.random() * (maxInterval - minInterval) + minInterval;
      
      this.intervalId = setTimeout(() => {
        updateProgress();
        scheduleNextUpdate();
      }, interval);
    };

    // Start the first update
    scheduleNextUpdate();
  }

  /**
   * Calculate natural progress that feels realistic
   */
  calculateNaturalProgress(elapsed) {
    const totalDuration = 1020000; // 17 minutes total estimated time (17 * 60 * 1000)
    
    if (elapsed >= totalDuration) {
      return 95; // Cap at 95% until completion
    }
    
    // Create a natural curve: fast start, slow middle, fast end
    const progressRatio = elapsed / totalDuration;
    
    // Sigmoid-like curve for natural feel
    let progress;
    if (progressRatio < 0.3) {
      // Fast start: 0-30% in first 30% of time
      progress = progressRatio * 2.5; // 0-75% of progress in first 30% of time
    } else if (progressRatio < 0.7) {
      // Slow middle: 30-70% in middle 40% of time
      const middleProgress = 0.75 + (progressRatio - 0.3) * 0.2; // 75-83% of progress
      progress = middleProgress;
    } else {
      // Fast end: 70-100% in last 30% of time
      const endProgress = 0.83 + (progressRatio - 0.7) * 0.4; // 83-95% of progress
      progress = endProgress;
    }
    
    // Add some randomness to make it feel more natural
    const randomness = (Math.random() - 0.5) * 0.1; // ±5% randomness
    progress = Math.max(0, Math.min(0.95, progress + randomness));
    
    return progress * 100;
  }

  /**
   * Generate realistic progress messages
   */
  generateProgressMessage(progress) {
    const messages = [
      `Progress: ${progress.toFixed(1)}% - Analyzing search results...`,
      `Progress: ${progress.toFixed(1)}% - Processing business data...`,
      `Progress: ${progress.toFixed(1)}% - Extracting contact information...`,
      `Progress: ${progress.toFixed(1)}% - Validating business profiles...`,
      `Progress: ${progress.toFixed(1)}% - Compiling results...`,
      `Progress: ${progress.toFixed(1)}% - Finalizing data...`
    ];
    
    // Rotate through messages based on progress
    const messageIndex = Math.floor((progress / 100) * messages.length);
    return messages[Math.min(messageIndex, messages.length - 1)];
  }
}

// Test the progress simulator
async function testProgressSimulator() {
  console.log(chalk.blue.bold('🧪 Testing Progress Simulator'));
  console.log(chalk.gray('═══════════════════════════════════════════\n'));
  
  const simulator = new ProgressSimulator();
  
  // Start the simulation
  simulator.start((progressData) => {
    // This callback would be used by the actual application
    // For testing, we just display the progress
  });
  
  // Simulate a scraping process that takes some time
  console.log(chalk.yellow('⏱️  Simulating scraping process...'));
  console.log(chalk.yellow('   (This will run for about 17 minutes to show the full experience)'));
  console.log(chalk.yellow('   Press Ctrl+C to stop early and see immediate completion\n'));
  
  // Wait for 17 minutes to see the full progress
  await new Promise(resolve => setTimeout(resolve, 1020000));
  
  // Complete the simulation
  simulator.complete();
  
  console.log(chalk.green('\n🎉 Test completed successfully!'));
}

// Run the test
if (import.meta.url.startsWith('file:') && process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/'))) {
  testProgressSimulator().catch(console.error);
}

export { ProgressSimulator };
