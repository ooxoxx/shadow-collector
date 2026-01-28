/**
 * Stats Tracker
 * Tracks migration statistics and provides summary output
 */

import type { MigrationStats } from './types';

export type RecordType = 'migrated' | 'skipped' | 'error' | 'reclassified';

export class StatsTracker {
  private stats: MigrationStats;

  constructor() {
    this.stats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      reclassified: 0,
      startTime: new Date(),
    };
  }

  record(type: RecordType): void {
    this.stats.total++;
    switch (type) {
      case 'migrated':
        this.stats.migrated++;
        break;
      case 'skipped':
        this.stats.skipped++;
        break;
      case 'error':
        this.stats.errors++;
        break;
      case 'reclassified':
        this.stats.reclassified++;
        break;
    }
  }

  complete(): void {
    this.stats.endTime = new Date();
  }

  getStats(): MigrationStats {
    return { ...this.stats };
  }

  printSummary(): string {
    const lines: string[] = [
      '==========================================',
      'Migration Summary',
      '==========================================',
      `Total files: ${this.stats.total}`,
      `Migrated: ${this.stats.migrated}`,
      `Skipped: ${this.stats.skipped}`,
      `Errors: ${this.stats.errors}`,
    ];

    if (this.stats.reclassified > 0) {
      lines.push(`Reclassified: ${this.stats.reclassified}`);
    }

    if (this.stats.endTime) {
      const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
      lines.push(`Duration: ${(duration / 1000).toFixed(2)}s`);
    }

    lines.push('==========================================');
    return lines.join('\n');
  }
}
