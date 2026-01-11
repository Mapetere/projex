/**
 * ChangeHistory - Tracks all portfolio modifications for undo functionality.
 * Stores changes in a commit-like manner so users can revert additions.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface PortfolioChange {
    id: string;                    // Unique change ID
    timestamp: string;             // ISO timestamp
    projectId: string;             // Which project was added
    projectName: string;           // Human-readable name
    action: 'ADD' | 'REMOVE';      // What action was taken
    file: string;                  // Which file was modified
    contentBefore: string;         // File content before change
    contentAfter: string;          // File content after change
    backupPath?: string;           // Path to backup file
}

export interface ChangeLog {
    version: string;
    changes: PortfolioChange[];
}

const HISTORY_DIR = join(homedir(), '.projex');
const HISTORY_FILE = join(HISTORY_DIR, 'history.json');

export class ChangeHistory {
    private log: ChangeLog;

    constructor() {
        this.log = this.load();
    }

    private load(): ChangeLog {
        if (!existsSync(HISTORY_FILE)) {
            return { version: '1.0', changes: [] };
        }

        try {
            const content = readFileSync(HISTORY_FILE, 'utf-8');
            return JSON.parse(content);
        } catch {
            return { version: '1.0', changes: [] };
        }
    }

    private save(): void {
        if (!existsSync(HISTORY_DIR)) {
            mkdirSync(HISTORY_DIR, { recursive: true });
        }
        writeFileSync(HISTORY_FILE, JSON.stringify(this.log, null, 2));
    }

    /**
     * Record a portfolio change
     */
    recordChange(change: Omit<PortfolioChange, 'id' | 'timestamp'>): PortfolioChange {
        const fullChange: PortfolioChange = {
            ...change,
            id: `change_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            timestamp: new Date().toISOString(),
        };

        this.log.changes.push(fullChange);
        this.save();

        return fullChange;
    }

    /**
     * Get recent changes (most recent first)
     */
    getRecentChanges(limit: number = 10): PortfolioChange[] {
        return [...this.log.changes]
            .reverse()
            .slice(0, limit);
    }

    /**
     * Get the last change made
     */
    getLastChange(): PortfolioChange | null {
        if (this.log.changes.length === 0) return null;
        return this.log.changes[this.log.changes.length - 1];
    }

    /**
     * Get a specific change by ID
     */
    getChange(changeId: string): PortfolioChange | null {
        return this.log.changes.find(c => c.id === changeId) || null;
    }

    /**
     * Undo a specific change by restoring the file
     */
    undoChange(changeId: string): { success: boolean; message: string } {
        const change = this.getChange(changeId);

        if (!change) {
            return { success: false, message: 'Change not found' };
        }

        try {
            // Restore the file to its previous state
            writeFileSync(change.file, change.contentBefore, 'utf-8');

            // Record the undo as a new change
            this.recordChange({
                projectId: change.projectId,
                projectName: change.projectName,
                action: 'REMOVE',
                file: change.file,
                contentBefore: change.contentAfter,
                contentAfter: change.contentBefore,
            });

            return {
                success: true,
                message: `Reverted: ${change.projectName} removed from ${change.file}`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to undo: ${error}`
            };
        }
    }

    /**
     * Undo the last change
     */
    undoLast(): { success: boolean; message: string } {
        const last = this.getLastChange();
        if (!last) {
            return { success: false, message: 'No changes to undo' };
        }

        // Don't undo a REMOVE action (that would add it back)
        if (last.action === 'REMOVE') {
            // Find the last ADD action instead
            const lastAdd = [...this.log.changes]
                .reverse()
                .find(c => c.action === 'ADD');

            if (!lastAdd) {
                return { success: false, message: 'No ADD changes to undo' };
            }

            return this.undoChange(lastAdd.id);
        }

        return this.undoChange(last.id);
    }

    /**
     * Get all changes for a specific project
     */
    getChangesForProject(projectId: string): PortfolioChange[] {
        return this.log.changes.filter(c => c.projectId === projectId);
    }

    /**
     * Clear all history (use with caution)
     */
    clearHistory(): void {
        this.log.changes = [];
        this.save();
    }
}
