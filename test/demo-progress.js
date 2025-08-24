#!/usr/bin/env node

/**
 * Quick Demo of Progress Simulator
 * Shows the realistic loading bar in action (shorter duration)
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

  start(onProgress) {
    this.onProgress = onProgress;
    this.startTime = Date.now();
    this.currentProgress = 0;
    this.isComplete = false;
    this.lastUpdateTime = 0;
    
    console.log(chalk.blue('🚀 Starting progress simulation...'));
    console.log(chalk.gray('   This will simulate a realistic loading experience'));
    console.log(chalk.gray('   Progress updates every 2-8 seconds with natural timing\n'));
    
    this.simulateProgress();
  }

  complete() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
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

  simulateProgress() {
    const updateProgress = () => {
      if (this.isComplete) return;

      const now = Date.now();
      const elapsed = now - this.startTime;
      
      let newProgress = this.calculateNaturalProgress(elapsed);
      
      if (newProgress > this.currentProgress && newProgress < 95) {
        this.currentProgress = newProgress;
        
        const message = this.generateProgressMessage(this.currentProgress);
        
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

    const scheduleNextUpdate = () => {
      if (this.isComplete) return;
      
      // Shorter intervals for demo (2-8 seconds)
      const minInterval = 2000;
      const maxInterval = 8000;
      const interval = Math.random() * (maxInterval - minInterval) + minInterval;
      
      this.intervalId = setTimeout(() => {
        updateProgress();
        scheduleNextUpdate();
      }, interval);
    };

    scheduleNextUpdate();
  }

  calculateNaturalProgress(elapsed) {
    const totalDuration = 120000; // 2 minutes for demo
    
    if (elapsed >= totalDuration) {
      return 95;
    }
    
    const progressRatio = elapsed / totalDuration;
    
    let progress;
    if (progressRatio < 0.3) {
      // Fast start: 0-30% in first 30% of time
      progress = progressRatio * 2.5; // 0-75% of progress
    } else if (progressRatio < 0.7) {
      // Slow middle: 30-70% in middle 40% of time
      const middleProgress = 0.75 + (progressRatio - 0.3) * 0.2; // 75-83%
      progress = middleProgress;
    } else {
      // Fast end: 70-100% in last 30% of time
      const endProgress = 0.83 + (progressRatio - 0.7) * 0.4; // 83-95%
      progress = endProgress;
    }
    
    // Add randomness
    const randomness = (Math.random() - 0.5) * 0.1;
    progress = Math.max(0, Math.min(0.95, progress + randomness));
    
    return progress * 100;
  }

  generateProgressMessage(progress) {
    const messages = [
      `Progress: ${progress.toFixed(1)}% - Analyzing search results...`,
      `Progress: ${progress.toFixed(1)}% - Processing business data...`,
      `Progress: ${progress.toFixed(1)}% - Extracting contact information...`,
      `Progress: ${progress.toFixed(1)}% - Validating business profiles...`,
      `Progress: ${progress.toFixed(1)}% - Compiling results...`,
      `Progress: ${progress.toFixed(1)}% - Finalizing data...`
    ];
    
    const messageIndex = Math.floor((progress / 100) * messages.length);
    return messages[Math.min(messageIndex, messages.length - 1)];
  }
}

// Demo function
async function demoProgressSimulator() {
  console.log(chalk.blue.bold('🎬 Progress Simulator Demo'));
  console.log(chalk.gray('═══════════════════════════════════════\n'));
  
  const simulator = new ProgressSimulator();
  
  simulator.start((progressData) => {
    // Progress callback (not used in demo)
  });
  
  console.log(chalk.yellow('⏱️  Running demo for 2 minutes...'));
  console.log(chalk.yellow('   Watch the natural progress curve: fast start → slow middle → fast end\n'));
  
  // Wait for 2 minutes
  await new Promise(resolve => setTimeout(resolve, 120000));
  
  simulator.complete();
  
  console.log(chalk.green('\n🎉 Demo completed!'));
  console.log(chalk.gray('   Notice how progress was:'));
  console.log(chalk.gray('   • Fast at the beginning (0-75% in first 30% of time)'));
  console.log(chalk.gray('   • Slow in the middle (75-83% in middle 40% of time)'));
  console.log(chalk.gray('   • Fast again near the end (83-95% in last 30% of time)'));
  console.log(chalk.gray('   • Jumped to 100% immediately upon completion'));
}

// Run demo
if (import.meta.url.startsWith('file:') && process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/'))) {
  demoProgressSimulator().catch(console.error);
}

export { ProgressSimulator };
