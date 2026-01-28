/**
 * Unit Tests for Stats Tracker
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { StatsTracker } from '../../../src/utils/migration/stats-tracker';

describe('StatsTracker', () => {
  let tracker: StatsTracker;

  beforeEach(() => {
    tracker = new StatsTracker();
  });

  describe('initial state', () => {
    test('starts with zero counts', () => {
      const stats = tracker.getStats();
      expect(stats.total).toBe(0);
      expect(stats.migrated).toBe(0);
      expect(stats.skipped).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.reclassified).toBe(0);
    });

    test('has startTime set', () => {
      const stats = tracker.getStats();
      expect(stats.startTime).toBeInstanceOf(Date);
    });

    test('endTime is undefined initially', () => {
      const stats = tracker.getStats();
      expect(stats.endTime).toBeUndefined();
    });
  });

  describe('record()', () => {
    test('increments migrated count', () => {
      tracker.record('migrated');
      expect(tracker.getStats().migrated).toBe(1);
      expect(tracker.getStats().total).toBe(1);
    });

    test('increments skipped count', () => {
      tracker.record('skipped');
      expect(tracker.getStats().skipped).toBe(1);
      expect(tracker.getStats().total).toBe(1);
    });

    test('increments error count', () => {
      tracker.record('error');
      expect(tracker.getStats().errors).toBe(1);
      expect(tracker.getStats().total).toBe(1);
    });

    test('increments reclassified count', () => {
      tracker.record('reclassified');
      expect(tracker.getStats().reclassified).toBe(1);
      expect(tracker.getStats().total).toBe(1);
    });

    test('accumulates multiple records', () => {
      tracker.record('migrated');
      tracker.record('migrated');
      tracker.record('skipped');
      tracker.record('error');
      tracker.record('reclassified');

      const stats = tracker.getStats();
      expect(stats.total).toBe(5);
      expect(stats.migrated).toBe(2);
      expect(stats.skipped).toBe(1);
      expect(stats.errors).toBe(1);
      expect(stats.reclassified).toBe(1);
    });
  });

  describe('complete()', () => {
    test('sets endTime', () => {
      tracker.complete();
      const stats = tracker.getStats();
      expect(stats.endTime).toBeInstanceOf(Date);
    });

    test('endTime is after startTime', () => {
      tracker.complete();
      const stats = tracker.getStats();
      expect(stats.endTime!.getTime()).toBeGreaterThanOrEqual(stats.startTime.getTime());
    });
  });

  describe('getStats()', () => {
    test('returns a copy of stats', () => {
      tracker.record('migrated');
      const stats1 = tracker.getStats();
      tracker.record('migrated');
      const stats2 = tracker.getStats();

      expect(stats1.migrated).toBe(1);
      expect(stats2.migrated).toBe(2);
    });
  });

  describe('printSummary()', () => {
    test('returns formatted summary string', () => {
      tracker.record('migrated');
      tracker.record('migrated');
      tracker.record('skipped');
      tracker.record('error');
      tracker.complete();

      const summary = tracker.printSummary();
      expect(summary).toContain('Total files: 4');
      expect(summary).toContain('Migrated: 2');
      expect(summary).toContain('Skipped: 1');
      expect(summary).toContain('Errors: 1');
    });

    test('includes reclassified in summary when non-zero', () => {
      tracker.record('reclassified');
      tracker.complete();

      const summary = tracker.printSummary();
      expect(summary).toContain('Reclassified: 1');
    });

    test('includes duration when completed', () => {
      tracker.complete();
      const summary = tracker.printSummary();
      expect(summary).toContain('Duration:');
    });
  });
});
