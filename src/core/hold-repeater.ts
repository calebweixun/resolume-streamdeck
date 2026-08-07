export class HoldRepeater {
  private holdTimer?: NodeJS.Timeout;
  private repeatTimer?: NodeJS.Timeout;
  private running = false;

  start(task: () => Promise<void>, delayMs: number, intervalMs: number): void {
    this.stop();
    void this.invoke(task);
    this.holdTimer = setTimeout(() => {
      this.holdTimer = undefined;
      void this.invoke(task);
      this.repeatTimer = setInterval(() => void this.invoke(task), intervalMs);
    }, delayMs);
  }

  stop(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    if (this.repeatTimer) clearInterval(this.repeatTimer);
    this.holdTimer = undefined;
    this.repeatTimer = undefined;
  }

  private async invoke(task: () => Promise<void>): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await task();
    } finally {
      this.running = false;
    }
  }
}
