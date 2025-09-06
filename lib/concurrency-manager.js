import chalk from 'chalk';

/**
 * ConcurrencyManager controls how many scraping jobs can run in parallel
 * and manages a FIFO waiting queue. It is stateless with respect to storage;
 * callers provide callbacks to update sessions and send messages.
 */
class ConcurrencyManager {
  constructor(defaultLimit = 3) {
    this.maxConcurrent = defaultLimit;
    this.activeUsers = new Set();
    this.queue = []; // [{ userId, startFn, updateSession, notifyQueued }]
    this.queuedUsers = new Set();
  }

  getLimit() {
    return this.maxConcurrent;
  }

  setLimit(newLimit) {
    const parsed = parseInt(newLimit, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new Error('Concurrency limit must be a positive integer');
    }
    this.maxConcurrent = parsed;
    console.log(chalk.blue(`⚙️ Concurrency limit set to ${this.maxConcurrent}`));
    this._drainQueue();
    return this.maxConcurrent;
  }

  /**
   * Attempt to start a scraping job for userId.
   * If capacity available: mark running, update session, run startFn.
   * Else: enqueue, set session to waiting, and notify user once.
   *
   * @param {string} userId
   * @param {Function} startFn - async function to execute the job
   * @param {Object} hooks
   * @param {Function} hooks.updateSession - (userId, partial) => void
   * @param {Function} hooks.notifyQueued - () => Promise<void>
   * @returns {Promise<'started'|'queued'|'already_running'|'already_queued'>}
   */
  async startScraping(userId, startFn, { updateSession, notifyQueued } = {}) {
    if (this.activeUsers.has(userId)) {
      return 'already_running';
    }

    if (this.activeUsers.size < this.maxConcurrent) {
      this.activeUsers.add(userId);
      try {
        if (typeof updateSession === 'function') {
          updateSession(userId, { 
            status: 'running', 
            currentStep: 'scraping_in_progress',
            meta: { jobStartTime: Date.now() }
          });
        }
      } catch (e) {
        console.warn('Failed to update session to running:', e.message);
      }

      // Fire and forget; startFn itself should handle completion and call finishScraping
      Promise.resolve()
        .then(() => startFn())
        .catch(err => {
          console.error('startFn error:', err?.message || err);
        });
      return 'started';
    }

    // Enqueue if not already queued
    if (this.queuedUsers.has(userId)) {
      return 'already_queued';
    }

    this.queue.push({ userId, startFn, updateSession, notifyQueued });
    this.queuedUsers.add(userId);

    try {
      if (typeof updateSession === 'function') {
        updateSession(userId, { status: 'waiting', currentStep: 'queued_for_scraping' });
      }
      if (typeof notifyQueued === 'function') {
        await notifyQueued();
      }
    } catch (e) {
      console.warn('Failed to notify or update session when queuing:', e.message);
    }

    console.log(chalk.yellow(`⏳ User queued for scraping (FIFO): ${userId}`));
    return 'queued';
  }

  /**
   * Mark user's job as finished and attempt to start next queued job.
   * @param {string} userId
   */
  async finishScraping(userId) {
    if (this.activeUsers.has(userId)) {
      this.activeUsers.delete(userId);
    }
    // If a user somehow still in queue, remove it
    if (this.queuedUsers.has(userId)) {
      this.queuedUsers.delete(userId);
      this.queue = this.queue.filter(q => q.userId !== userId);
    }
    await this._drainQueue();
  }

  /**
   * Handle admin textual commands.
   * Supports: ADMIN LIMIT <number>
   * @param {string} command
   * @returns {{success:boolean,message:string}}
   */
  adminCommand(command) {
    const upper = String(command || '').trim().toUpperCase();
    if (upper.startsWith('ADMIN LIMIT')) {
      const numStr = command.trim().split(/\s+/).pop();
      try {
        const newVal = this.setLimit(numStr);
        return { success: true, message: `✅ Concurrency limit set to ${newVal}` };
      } catch (e) {
        return { success: false, message: `❌ ${e.message}` };
      }
    }
    return { success: false, message: '❌ Unknown admin command' };
  }

  async _drainQueue() {
    while (this.activeUsers.size < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;
      const { userId, startFn, updateSession } = next;
      this.queuedUsers.delete(userId);
      this.activeUsers.add(userId);
      try {
        if (typeof updateSession === 'function') {
          updateSession(userId, { 
            status: 'running', 
            currentStep: 'scraping_in_progress',
            meta: { jobStartTime: Date.now() }
          });
        }
      } catch (e) {
        console.warn('Failed to update session when starting from queue:', e.message);
      }

      // Fire start
      Promise.resolve()
        .then(() => startFn())
        .catch(err => {
          console.error('Queued startFn error:', err?.message || err);
        });
    }
  }
}

const concurrencyManager = new ConcurrencyManager();
export default concurrencyManager;
export { ConcurrencyManager };


