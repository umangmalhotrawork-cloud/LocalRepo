/**
 * NEXUS CODEX HARNESS - INTERACTIVE 3-WAY CHANGESET CONFLICT RESOLUTION (Milestone 16)
 * 
 * Provides safe parent-controlled interactive 3-way conflict resolution when
 * multiple child/sibling ChangeSets conflict.
 * 
 * Model:
 *   BASE     = Common baseline known when child work began
 *   PARENT   = Current parent workspace content
 *   INCOMING = Child ChangeSet proposed content
 * 
 * Invariants:
 *   - No disk mutation occurs during inspection or conflict resolution.
 *   - Non-overlapping hunks can auto-merge.
 *   - Overlapping hunks are marked MANUAL_REQUIRED.
 *   - Final resolution creates ONE authoritative parent ChangeSet.
 *   - The parent ChangeSet re-runs the full parent safety pipeline (Firewall, Approval, Transactional Applier, Verification).
 *   - EvidenceGraph audit captures all original child ChangeSets, chosen resolutions, and transaction outcomes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  CONFLICT_TYPE,
  CONFLICT_STATUS,
  HUNK_STATUS,
  HUNK_RESOLUTION,
  EVENT_TYPES,
  generateConflictId,
} = require('./types');
const { ChangeSet, CHANGESET_STATUS } = require('./ChangeSet');
const { astDiffEngine } = require('./ASTDiffEngine');
const secretFilter = require('../../security/secretFilter');

let evidenceGraphInstance = null;
try {
  const { evidenceGraph } = require('../evidence/EvidenceGraph');
  evidenceGraphInstance = evidenceGraph;
} catch (e) {}

/**
 * Computes deterministic line-based diff operations between two texts.
 * Returns array of diff chunks: { op: 'EQUAL'|'DELETE'|'INSERT', lines: string[] }
 */
function computeLineDiff(originalText, modifiedText) {
  const origLines = (originalText === '' || originalText === null || originalText === undefined)
    ? []
    : originalText.split('\n');
  const modLines = (modifiedText === '' || modifiedText === null || modifiedText === undefined)
    ? []
    : modifiedText.split('\n');

  const N = origLines.length;
  const M = modLines.length;

  // Compute LCS (Longest Common Subsequence) DP matrix
  const dp = Array.from({ length: N + 1 }, () => new Int32Array(M + 1));
  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      if (origLines[i - 1] === modLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to extract diff chunks
  let i = N;
  let j = M;
  const rawOps = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      rawOps.push({ op: 'EQUAL', line: origLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawOps.push({ op: 'INSERT', line: modLines[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawOps.push({ op: 'DELETE', line: origLines[i - 1] });
      i--;
    }
  }

  rawOps.reverse();
  return rawOps;
}

/**
 * Performs a 3-way line-based merge between BASE, PARENT, and INCOMING.
 * Returns structured hunks with startLine, endLine, base, parent, incoming, status.
 */
function perform3WayLineMerge(baseText, parentText, incomingText) {
  // If parent and incoming are identical to base, it's unchanged
  if (parentText === baseText && incomingText === baseText) {
    return {
      status: CONFLICT_STATUS.AUTO_RESOLVED,
      hasConflict: false,
      resolvedContent: baseText,
      hunks: [
        {
          hunkId: 'hunk_0',
          startLine: 1,
          endLine: baseText.split('\n').length,
          base: baseText,
          parent: baseText,
          incoming: baseText,
          status: HUNK_STATUS.UNCHANGED,
          resolution: HUNK_RESOLUTION.KEEP_PARENT,
          resolvedContent: baseText,
        },
      ],
    };
  }

  // If only incoming changed (parent is unchanged from base)
  if (parentText === baseText && incomingText !== baseText) {
    return {
      status: CONFLICT_STATUS.AUTO_RESOLVED,
      hasConflict: false,
      resolvedContent: incomingText,
      hunks: [
        {
          hunkId: 'hunk_0',
          startLine: 1,
          endLine: incomingText.split('\n').length,
          base: baseText,
          parent: parentText,
          incoming: incomingText,
          status: HUNK_STATUS.INCOMING_ONLY,
          resolution: HUNK_RESOLUTION.KEEP_INCOMING,
          resolvedContent: incomingText,
        },
      ],
    };
  }

  // If only parent changed (incoming is unchanged from base)
  if (incomingText === baseText && parentText !== baseText) {
    return {
      status: CONFLICT_STATUS.AUTO_RESOLVED,
      hasConflict: false,
      resolvedContent: parentText,
      hunks: [
        {
          hunkId: 'hunk_0',
          startLine: 1,
          endLine: parentText.split('\n').length,
          base: baseText,
          parent: parentText,
          incoming: incomingText,
          status: HUNK_STATUS.PARENT_ONLY,
          resolution: HUNK_RESOLUTION.KEEP_PARENT,
          resolvedContent: parentText,
        },
      ],
    };
  }

  // If both parent and incoming made the EXACT same modification
  if (parentText === incomingText) {
    return {
      status: CONFLICT_STATUS.AUTO_RESOLVED,
      hasConflict: false,
      resolvedContent: parentText,
      hunks: [
        {
          hunkId: 'hunk_0',
          startLine: 1,
          endLine: parentText.split('\n').length,
          base: baseText,
          parent: parentText,
          incoming: incomingText,
          status: HUNK_STATUS.AUTO_MERGED,
          resolution: HUNK_RESOLUTION.KEEP_PARENT,
          resolvedContent: parentText,
        },
      ],
    };
  }

  // Detailed block-level alignment using base lines
  const baseLines = baseText === '' ? [] : baseText.split('\n');
  const parentLines = parentText === '' ? [] : parentText.split('\n');
  const incomingLines = incomingText === '' ? [] : incomingText.split('\n');

  const hunks = [];
  const segments = [];
  let hunkCounter = 0;

  // Handle empty base (two creations of different content):
  if (baseLines.length === 0) {
    const hunk = {
      hunkId: `hunk_${hunkCounter++}`,
      startLine: 1,
      endLine: Math.max(parentLines.length, incomingLines.length),
      base: '',
      parent: parentText,
      incoming: incomingText,
      status: parentText === incomingText ? HUNK_STATUS.AUTO_MERGED : HUNK_STATUS.CONFLICT,
      resolution: parentText === incomingText ? HUNK_RESOLUTION.KEEP_PARENT : null,
      resolvedContent: parentText === incomingText ? parentText : null,
    };
    hunks.push(hunk);
    segments.push({ type: 'DIFF', hunk });
  } else {
    // Check if parent and incoming touch separate sections or the same section
    const parentChanged = parentText !== baseText;
    const incomingChanged = incomingText !== baseText;

    if (parentChanged && !incomingChanged) {
      const hunk = {
        hunkId: `hunk_${hunkCounter++}`,
        startLine: 1,
        endLine: parentLines.length,
        base: baseText,
        parent: parentText,
        incoming: incomingText,
        status: HUNK_STATUS.PARENT_ONLY,
        resolution: HUNK_RESOLUTION.KEEP_PARENT,
        resolvedContent: parentText,
      };
      hunks.push(hunk);
      segments.push({ type: 'DIFF', hunk });
    } else if (!parentChanged && incomingChanged) {
      const hunk = {
        hunkId: `hunk_${hunkCounter++}`,
        startLine: 1,
        endLine: incomingLines.length,
        base: baseText,
        parent: parentText,
        incoming: incomingText,
        status: HUNK_STATUS.INCOMING_ONLY,
        resolution: HUNK_RESOLUTION.KEEP_INCOMING,
        resolvedContent: incomingText,
      };
      hunks.push(hunk);
      segments.push({ type: 'DIFF', hunk });
    } else if (parentText === incomingText) {
      const hunk = {
        hunkId: `hunk_${hunkCounter++}`,
        startLine: 1,
        endLine: parentLines.length,
        base: baseText,
        parent: parentText,
        incoming: incomingText,
        status: HUNK_STATUS.AUTO_MERGED,
        resolution: HUNK_RESOLUTION.KEEP_PARENT,
        resolvedContent: parentText,
      };
      hunks.push(hunk);
      segments.push({ type: 'DIFF', hunk });
    } else {
      // Both parent and incoming changed differently.
      // Try to find common anchor lines in base that were untouched by both parent and incoming
      const isAnchor = (bLine) => parentLines.includes(bLine) && incomingLines.includes(bLine);
      const anchorIndices = [];
      for (let i = 0; i < baseLines.length; i++) {
        if (baseLines[i].trim().length > 0 && isAnchor(baseLines[i])) {
          anchorIndices.push(i);
        }
      }

      if (anchorIndices.length > 0) {
        let lastBaseIdx = 0;
        let lastParentIdx = 0;
        let lastIncomingIdx = 0;

        for (const anchorIdx of anchorIndices) {
          const anchorLine = baseLines[anchorIdx];
          const pAnchorIdx = parentLines.indexOf(anchorLine, lastParentIdx);
          const iAnchorIdx = incomingLines.indexOf(anchorLine, lastIncomingIdx);

          if (pAnchorIdx >= lastParentIdx && iAnchorIdx >= lastIncomingIdx) {
            const bChunk = baseLines.slice(lastBaseIdx, anchorIdx).join('\n');
            const pChunk = parentLines.slice(lastParentIdx, pAnchorIdx).join('\n');
            const iChunk = incomingLines.slice(lastIncomingIdx, iAnchorIdx).join('\n');

            if (bChunk || pChunk || iChunk) {
              const pSame = pChunk === bChunk;
              const iSame = iChunk === bChunk;
              const pEqualsI = pChunk === iChunk;

              let hunkStatus = HUNK_STATUS.CONFLICT;
              let hunkRes = null;
              let hunkResolved = null;

              if (pSame && iSame) {
                hunkStatus = HUNK_STATUS.UNCHANGED;
                hunkRes = HUNK_RESOLUTION.KEEP_PARENT;
                hunkResolved = bChunk;
              } else if (pSame && !iSame) {
                hunkStatus = HUNK_STATUS.INCOMING_ONLY;
                hunkRes = HUNK_RESOLUTION.KEEP_INCOMING;
                hunkResolved = iChunk;
              } else if (!pSame && iSame) {
                hunkStatus = HUNK_STATUS.PARENT_ONLY;
                hunkRes = HUNK_RESOLUTION.KEEP_PARENT;
                hunkResolved = pChunk;
              } else if (pEqualsI) {
                hunkStatus = HUNK_STATUS.AUTO_MERGED;
                hunkRes = HUNK_RESOLUTION.KEEP_PARENT;
                hunkResolved = pChunk;
              }

              const hunk = {
                hunkId: `hunk_${hunkCounter++}`,
                startLine: lastBaseIdx + 1,
                endLine: anchorIdx,
                base: bChunk,
                parent: pChunk,
                incoming: iChunk,
                status: hunkStatus,
                resolution: hunkRes,
                resolvedContent: hunkResolved,
              };
              hunks.push(hunk);
              segments.push({ type: 'DIFF', hunk });
            }

            segments.push({ type: 'ANCHOR', text: anchorLine });
            lastBaseIdx = anchorIdx + 1;
            lastParentIdx = pAnchorIdx + 1;
            lastIncomingIdx = iAnchorIdx + 1;
          }
        }

        const bRem = baseLines.slice(lastBaseIdx).join('\n');
        const pRem = parentLines.slice(lastParentIdx).join('\n');
        const iRem = incomingLines.slice(lastIncomingIdx).join('\n');

        if (bRem || pRem || iRem) {
          const pSame = pRem === bRem;
          const iSame = iRem === bRem;
          const pEqualsI = pRem === iRem;

          let hunkStatus = HUNK_STATUS.CONFLICT;
          let hunkRes = null;
          let hunkResolved = null;

          if (pSame && iSame) {
            hunkStatus = HUNK_STATUS.UNCHANGED;
            hunkRes = HUNK_RESOLUTION.KEEP_PARENT;
            hunkResolved = bRem;
          } else if (pSame && !iSame) {
            hunkStatus = HUNK_STATUS.INCOMING_ONLY;
            hunkRes = HUNK_RESOLUTION.KEEP_INCOMING;
            hunkResolved = iRem;
          } else if (!pSame && iSame) {
            hunkStatus = HUNK_STATUS.PARENT_ONLY;
            hunkRes = HUNK_RESOLUTION.KEEP_PARENT;
            hunkResolved = pRem;
          } else if (pEqualsI) {
            hunkStatus = HUNK_STATUS.AUTO_MERGED;
            hunkRes = HUNK_RESOLUTION.KEEP_PARENT;
            hunkResolved = pRem;
          }

          const hunk = {
            hunkId: `hunk_${hunkCounter++}`,
            startLine: lastBaseIdx + 1,
            endLine: baseLines.length,
            base: bRem,
            parent: pRem,
            incoming: iRem,
            status: hunkStatus,
            resolution: hunkRes,
            resolvedContent: hunkResolved,
          };
          hunks.push(hunk);
          segments.push({ type: 'DIFF', hunk });
        }
      } else if (baseLines.length === parentLines.length && baseLines.length === incomingLines.length) {
        for (let i = 0; i < baseLines.length; i++) {
          const b = baseLines[i];
          const p = parentLines[i];
          const inc = incomingLines[i];

          const pSame = p === b;
          const iSame = inc === b;
          const pEqualsI = p === inc;

          let hunkStatus = HUNK_STATUS.CONFLICT;
          let hunkRes = null;
          let hunkResolved = null;

          if (pSame && iSame) {
            hunkStatus = HUNK_STATUS.UNCHANGED;
            hunkRes = HUNK_RESOLUTION.KEEP_PARENT;
            hunkResolved = b;
          } else if (pSame && !iSame) {
            hunkStatus = HUNK_STATUS.INCOMING_ONLY;
            hunkRes = HUNK_RESOLUTION.KEEP_INCOMING;
            hunkResolved = inc;
          } else if (!pSame && iSame) {
            hunkStatus = HUNK_STATUS.PARENT_ONLY;
            hunkRes = HUNK_RESOLUTION.KEEP_PARENT;
            hunkResolved = p;
          } else if (pEqualsI) {
            hunkStatus = HUNK_STATUS.AUTO_MERGED;
            hunkRes = HUNK_RESOLUTION.KEEP_PARENT;
            hunkResolved = p;
          }

          if (hunkStatus !== HUNK_STATUS.UNCHANGED) {
            const hunk = {
              hunkId: `hunk_${hunkCounter++}`,
              startLine: i + 1,
              endLine: i + 1,
              base: b,
              parent: p,
              incoming: inc,
              status: hunkStatus,
              resolution: hunkRes,
              resolvedContent: hunkResolved,
            };
            hunks.push(hunk);
            segments.push({ type: 'DIFF', hunk });
          } else {
            segments.push({ type: 'ANCHOR', text: b });
          }
        }
      } else {
        const hunk = {
          hunkId: `hunk_${hunkCounter++}`,
          startLine: 1,
          endLine: baseLines.length,
          base: baseText,
          parent: parentText,
          incoming: incomingText,
          status: HUNK_STATUS.CONFLICT,
          resolution: null,
          resolvedContent: null,
        };
        hunks.push(hunk);
        segments.push({ type: 'DIFF', hunk });
      }
    }
  }

  // If no hunks were produced, whole file is unchanged
  if (hunks.length === 0) {
    hunks.push({
      hunkId: 'hunk_0',
      startLine: 1,
      endLine: baseLines.length,
      base: baseText,
      parent: parentText,
      incoming: incomingText,
      status: HUNK_STATUS.UNCHANGED,
      resolution: HUNK_RESOLUTION.KEEP_PARENT,
      resolvedContent: baseText,
    });
  }

  const hasConflictHunk = hunks.some((h) => h.status === HUNK_STATUS.CONFLICT && !h.resolvedContent);
  const status = hasConflictHunk ? CONFLICT_STATUS.MANUAL_REQUIRED : CONFLICT_STATUS.AUTO_RESOLVED;

  let resolvedContent = null;
  if (!hasConflictHunk) {
    resolvedContent = segments.map((s) => (s.type === 'ANCHOR' ? s.text : (s.hunk.resolvedContent || ''))).join('\n');
  }

  return {
    status,
    hasConflict: hasConflictHunk,
    resolvedContent,
    hunks,
    segments,
  };
}

class ChangeConflict {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.conflictId = options.conflictId || generateConflictId();
    this.changeSetIdA = options.changeSetIdA || null;
    this.changeSetIdB = options.changeSetIdB || null;
    this.sourceChangeSets = options.sourceChangeSets || (this.changeSetIdA && this.changeSetIdB ? [this.changeSetIdA, this.changeSetIdB] : []);
    this.filePath = options.filePath || '';
    this.baseContent = typeof options.baseContent === 'string' ? options.baseContent : '';
    this.parentContent = typeof options.parentContent === 'string' ? options.parentContent : '';
    this.incomingContent = typeof options.incomingContent === 'string' ? options.incomingContent : '';
    this.conflictType = options.conflictType || CONFLICT_TYPE.FILE_CONFLICT;
    this.status = options.status || CONFLICT_STATUS.UNRESOLVED;
    this.resolution = options.resolution || null;
    this.resolvedContent = options.resolvedContent || null;
    this.hunks = Array.isArray(options.hunks) ? options.hunks : [];
    this.segments = Array.isArray(options.segments) ? options.segments : [];
    this.astAnalysis = options.astAnalysis || null;
    this.impactAnalysis = options.impactAnalysis || null;
    this.metadata = secretFilter.sanitizeObject(options.metadata || {});
    this.createdAt = options.createdAt || Date.now();
    this.updatedAt = options.updatedAt || Date.now();
  }

  /**
   * Evaluates 3-way merge on this conflict.
   */
  evaluateMerge() {
    const mergeResult = perform3WayLineMerge(this.baseContent, this.parentContent, this.incomingContent);
    this.status = mergeResult.status;
    this.resolvedContent = mergeResult.resolvedContent;
    this.hunks = mergeResult.hunks;
    this.segments = mergeResult.segments || [];

    try {
      this.astAnalysis = astDiffEngine.compare3Way({
        baseSource: this.baseContent,
        parentSource: this.parentContent,
        incomingSource: this.incomingContent,
        filePath: this.filePath,
      });
    } catch (e) {
      this.astAnalysis = { fallback: true, mode: 'TEXT_DIFF_ONLY', error: e.message };
    }

    try {
      const { repositorySymbolIndex } = require('./RepositorySymbolIndex');
      if (repositorySymbolIndex) {
        const callers = repositorySymbolIndex.getCallers(path.basename(this.filePath));
        this.impactAnalysis = {
          callersCount: callers.length,
          callers: callers.slice(0, 10),
          riskLevel: this.astAnalysis?.riskLevel || 'LOW',
          warnings: this.astAnalysis?.overlappingFunctions?.length > 0
            ? [`Overlapping function modifications detected in ${this.astAnalysis.overlappingFunctions.join(', ')}`]
            : [],
        };
      }
    } catch (e) {
      this.impactAnalysis = { callersCount: 0, callers: [], riskLevel: 'LOW', warnings: [] };
    }

    this.updatedAt = Date.now();
    return this;
  }

  /**
   * Resolves the entire conflicted file directly (e.g. from direct Monaco merged result editing).
   * @param {'KEEP_PARENT'|'KEEP_INCOMING'|'KEEP_BOTH'|'EDIT_RESULT'} [resolution]
   * @param {string} [customContent]
   */
  resolveFile(resolution = HUNK_RESOLUTION.EDIT_RESULT, customContent = '') {
    this.resolution = resolution;
    this.resolvedContent = typeof customContent === 'string' ? customContent : '';
    this.status = CONFLICT_STATUS.RESOLVED;
    this.segments = [];

    // Mark all hunks resolved
    for (const hunk of this.hunks) {
      hunk.resolution = resolution;
      hunk.resolvedContent = typeof customContent === 'string' ? customContent : hunk.resolvedContent;
    }

    this.updatedAt = Date.now();
    return this;
  }

  /**
   * Resolves a specific hunk inside this conflict.
   * @param {string} hunkId
   * @param {'KEEP_PARENT'|'KEEP_INCOMING'|'KEEP_BOTH'|'EDIT_RESULT'} resolution
   * @param {string} [customContent]
   */
  resolveHunk(hunkId, resolution, customContent) {
    const hunk = this.hunks.find((h) => h.hunkId === hunkId);
    if (!hunk) {
      throw new Error(`[CHANGE-CONFLICT] Hunk "${hunkId}" not found in conflict ${this.conflictId}`);
    }

    if (!Object.values(HUNK_RESOLUTION).includes(resolution)) {
      throw new Error(`[CHANGE-CONFLICT] Invalid hunk resolution action: "${resolution}"`);
    }

    hunk.resolution = resolution;

    switch (resolution) {
      case HUNK_RESOLUTION.KEEP_PARENT:
        hunk.resolvedContent = hunk.parent;
        break;
      case HUNK_RESOLUTION.KEEP_INCOMING:
        hunk.resolvedContent = hunk.incoming;
        break;
      case HUNK_RESOLUTION.KEEP_BOTH:
        if (hunk.parent && hunk.incoming) {
          hunk.resolvedContent = `${hunk.parent}\n${hunk.incoming}`;
        } else {
          hunk.resolvedContent = hunk.parent || hunk.incoming || '';
        }
        break;
      case HUNK_RESOLUTION.EDIT_RESULT:
        if (typeof customContent !== 'string') {
          throw new Error('[CHANGE-CONFLICT] EDIT_RESULT requires valid customContent string');
        }
        hunk.resolvedContent = customContent;
        break;
      default:
        break;
    }

    this.updatedAt = Date.now();

    // Check if all hunks in this conflict are resolved
    const allResolved = this.hunks.every((h) => h.resolvedContent !== null && h.resolvedContent !== undefined);
    if (allResolved) {
      this.status = CONFLICT_STATUS.RESOLVED;
      this.resolution = resolution;
      if (this.hunks.length === 1 && resolution === HUNK_RESOLUTION.EDIT_RESULT) {
        this.resolvedContent = customContent;
      } else if (this.segments && this.segments.length > 0) {
        this.resolvedContent = this.segments
          .map((s) => (s.type === 'ANCHOR' ? s.text : (s.hunk.resolvedContent !== null && s.hunk.resolvedContent !== undefined ? s.hunk.resolvedContent : '')))
          .join('\n');
      } else {
        this.resolvedContent = this.hunks.map((h) => h.resolvedContent || '').join('\n');
      }
    } else {
      this.resolvedContent = null;
      this.status = CONFLICT_STATUS.MANUAL_REQUIRED;
    }

    return hunk;
  }

  /**
   * Checks if this conflict is fully resolved.
   * @returns {boolean}
   */
  isResolved() {
    if (this.status === CONFLICT_STATUS.RESOLVED || this.status === CONFLICT_STATUS.AUTO_RESOLVED) {
      return true;
    }
    return this.hunks.length > 0 && this.hunks.every((h) => h.resolvedContent !== null && h.resolvedContent !== undefined);
  }

  /**
   * Returns the final resolved string content of this file.
   * @returns {string|null}
   */
  getResolvedContent() {
    if (typeof this.resolvedContent === 'string') {
      return this.resolvedContent;
    }
    if (this.segments && this.segments.length > 0) {
      const allResolved = this.hunks.every((h) => h.resolvedContent !== null && h.resolvedContent !== undefined);
      if (allResolved) {
        return this.segments
          .map((s) => (s.type === 'ANCHOR' ? s.text : (s.hunk.resolvedContent !== null && s.hunk.resolvedContent !== undefined ? s.hunk.resolvedContent : '')))
          .join('\n');
      }
    }
    if (this.hunks.length > 0 && this.hunks.every((h) => h.resolvedContent !== null && h.resolvedContent !== undefined)) {
      return this.hunks.map((h) => h.resolvedContent || '').join('\n');
    }
    return null;
  }

  /**
   * Serializes conflict safely without leaking secrets.
   */
  toJSON() {
    return secretFilter.sanitizeObject({
      conflictId: this.conflictId,
      changeSetIdA: this.changeSetIdA,
      changeSetIdB: this.changeSetIdB,
      sourceChangeSets: this.sourceChangeSets,
      filePath: this.filePath,
      baseContent: this.baseContent,
      parentContent: this.parentContent,
      incomingContent: this.incomingContent,
      conflictType: this.conflictType,
      status: this.status,
      resolution: this.resolution,
      resolvedContent: this.resolvedContent,
      hunks: this.hunks,
      astAnalysis: this.astAnalysis,
      impactAnalysis: this.impactAnalysis,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }

  /**
   * Deserializes conflict from JSON.
   */
  static fromJSON(data = {}) {
    const conflict = new ChangeConflict(data);
    if (data.astAnalysis) conflict.astAnalysis = data.astAnalysis;
    if (data.impactAnalysis) conflict.impactAnalysis = data.impactAnalysis;
    return conflict;
  }
}

class ChangeConflictResolver {
  /**
   * @param {Object} options
   * @param {Object} [options.eventBus]
   * @param {Object} [options.harnessRuntime]
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || null;
    this.harnessRuntime = options.harnessRuntime || null;
    this.conflicts = new Map(); // conflictId -> ChangeConflict
  }

  /**
   * Helper: Emit harness event.
   */
  _emit(eventType, payload = {}) {
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      try {
        this.eventBus.emit(eventType, payload);
      } catch (e) {
        console.warn(`[CHANGE-CONFLICT-RESOLVER] Failed to emit event ${eventType}:`, e.message);
      }
    }
  }

  /**
   * Evaluates merge between two ChangeSets (or an array of ChangeSets).
   * Identifies file/hunk collisions, creates ChangeConflict objects for overlapping changes,
   * registers them in this resolver, and returns { hasConflict, conflicts }.
   * @param {ChangeSet|Array<ChangeSet>} changeSetA
   * @param {ChangeSet} [changeSetB]
   * @param {Object} [options]
   * @returns {{ hasConflict: boolean, conflicts: Array<ChangeConflict> }}
   */
  evaluateMerge(changeSetA, changeSetB, options = {}) {
    const list = Array.isArray(changeSetA) ? changeSetA : (changeSetB ? [changeSetA, changeSetB] : [changeSetA]);
    if (list.length < 2) {
      return { hasConflict: false, conflicts: [] };
    }

    const conflicts = [];
    const cs1 = list[0];
    const cs2 = list[1];

    const edits1 = cs1.files || cs1.edits || cs1.patches || [];
    const edits2 = cs2.files || cs2.edits || cs2.patches || [];

    const files1 = new Map();
    for (const e of edits1) {
      const p = e.filePath || e.file || e.relPath;
      if (p) files1.set(p, e);
    }

    for (const e2 of edits2) {
      const filePath = e2.filePath || e2.file || e2.relPath;
      const e1 = files1.get(filePath);
      if (e1) {
        // Both modify the same file!
        const baseContent = e1.original || e1.originalContent || e2.original || e2.originalContent || '';
        const parentContent = e1.replacement || e1.content || '';
        const incomingContent = e2.replacement || e2.content || '';

        const mergeResult = perform3WayLineMerge(baseContent, parentContent, incomingContent);
        if (mergeResult.hasConflict || mergeResult.status === CONFLICT_STATUS.MANUAL_REQUIRED) {
          const conflict = this.createConflict({
            changeSetIdA: cs1.changeSetId,
            changeSetIdB: cs2.changeSetId,
            sourceChangeSets: [cs1.changeSetId, cs2.changeSetId],
            filePath,
            baseContent,
            parentContent,
            incomingContent,
            conflictType: CONFLICT_TYPE.FILE_CONFLICT,
            threadId: options.threadId || cs1.threadId || cs2.threadId,
            turnId: options.turnId,
            hunks: mergeResult.hunks,
          });
          conflicts.push(conflict);
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Creates a new ChangeConflict from conflicting child ChangeSets or diverged baseline.
   * @param {Object} options
   * @returns {ChangeConflict}
   */
  createConflict(options = {}) {
    const conflict = new ChangeConflict(options);
    conflict.evaluateMerge();
    this.conflicts.set(conflict.conflictId, conflict);

    this._emit(EVENT_TYPES.CHANGE_CONFLICT_CREATED, {
      threadId: options.threadId,
      turnId: options.turnId,
      conflictId: conflict.conflictId,
      filePath: conflict.filePath,
      changeSetIds: conflict.sourceChangeSets,
      status: conflict.status,
      conflictType: conflict.conflictType,
      hunkCount: conflict.hunks.length,
    });

    if (evidenceGraphInstance && options.threadId) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: options.threadId,
          type: 'CONFLICT_DETECTED',
          statement: `Change conflict ${conflict.conflictId} detected on ${conflict.filePath} (${conflict.conflictType}) across ChangeSets: ${conflict.sourceChangeSets.join(', ')}`,
          provenanceClass: 'RULE_TRIGGERED',
          verificationLevel: 'UNVERIFIED',
          metadata: {
            conflictId: conflict.conflictId,
            filePath: conflict.filePath,
            status: conflict.status,
          },
        });
      } catch (e) {}
    }

    return conflict;
  }

  /**
   * Retrieves conflict by ID.
   * @param {string} conflictId
   * @returns {ChangeConflict|null}
   */
  getConflict(conflictId) {
    return this.conflicts.get(conflictId) || null;
  }

  /**
   * Lists all registered conflicts.
   * @returns {Array<ChangeConflict>}
   */
  listConflicts() {
    return Array.from(this.conflicts.values());
  }

  /**
   * Resolves a specific hunk in a conflict.
   * @param {string} conflictId
   * @param {string} hunkId
   * @param {'KEEP_PARENT'|'KEEP_INCOMING'|'KEEP_BOTH'|'EDIT_RESULT'} resolution
   * @param {string} [customContent]
   * @param {Object} [context]
   * @returns {Object} Hunk outcome
   */
  resolveHunk(conflictId, hunkId, resolution, customContent, context = {}) {
    const conflict = this.getConflict(conflictId);
    if (!conflict) {
      throw new Error(`[CHANGE-CONFLICT-RESOLVER] Conflict "${conflictId}" not found`);
    }

    this._emit(EVENT_TYPES.CHANGE_CONFLICT_RESOLUTION_STARTED, {
      conflictId,
      hunkId,
      threadId: context.threadId,
      turnId: context.turnId,
    });

    const resolvedHunk = conflict.resolveHunk(hunkId, resolution, customContent);

    this._emit(EVENT_TYPES.CHANGE_CONFLICT_HUNK_RESOLVED, {
      conflictId,
      hunkId,
      resolution,
      conflictStatus: conflict.status,
      threadId: context.threadId,
      turnId: context.turnId,
    });

    if (evidenceGraphInstance && context.threadId) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: context.threadId,
          type: 'USER_APPROVAL',
          statement: `Resolved conflict hunk ${hunkId} in ${conflict.filePath} using ${resolution}`,
          provenanceClass: 'USER_APPROVED',
          verificationLevel: 'USER_VERIFIED',
          metadata: {
            conflictId,
            hunkId,
            resolution,
          },
        });
      } catch (e) {}
    }

    return {
      success: true,
      conflictId,
      hunkId,
      resolution,
      conflictStatus: conflict.status,
      resolvedContent: conflict.resolvedContent,
    };
  }

  /**
   * Resolves an entire conflict file directly (e.g. from direct Monaco code editor).
   * @param {string} conflictId
   * @param {'KEEP_PARENT'|'KEEP_INCOMING'|'KEEP_BOTH'|'EDIT_RESULT'} [resolution]
   * @param {string} [customContent]
   * @param {Object} [context]
   * @returns {Object} Outcome
   */
  resolveFile(conflictId, resolution = HUNK_RESOLUTION.EDIT_RESULT, customContent = '', context = {}) {
    const conflict = this.getConflict(conflictId);
    if (!conflict) {
      throw new Error(`[CHANGE-CONFLICT-RESOLVER] Conflict "${conflictId}" not found`);
    }

    this._emit(EVENT_TYPES.CHANGE_CONFLICT_RESOLUTION_STARTED, {
      conflictId,
      threadId: context.threadId,
      turnId: context.turnId,
    });

    conflict.resolveFile(resolution, customContent);

    this._emit(EVENT_TYPES.CHANGE_CONFLICT_HUNK_RESOLVED, {
      conflictId,
      resolution,
      conflictStatus: conflict.status,
      threadId: context.threadId,
      turnId: context.turnId,
    });

    if (evidenceGraphInstance && context.threadId) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: context.threadId,
          type: 'USER_APPROVAL',
          statement: `Resolved conflict file ${conflict.filePath} using ${resolution}`,
          provenanceClass: 'USER_APPROVED',
          verificationLevel: 'USER_VERIFIED',
          metadata: {
            conflictId,
            resolution,
          },
        });
      } catch (e) {}
    }

    return {
      success: true,
      conflictId,
      resolution,
      conflictStatus: conflict.status,
      resolvedContent: conflict.resolvedContent,
    };
  }

  /**
   * Creates ONE authoritative parent ChangeSet when all conflicts are resolved.
   * Throws if any conflict remains unresolved.
   * @param {Object} options
   * @param {string} options.workspacePath
   * @param {string} options.threadId
   * @param {string} [options.turnId]
   * @param {Array<string>} [options.conflictIds]
   * @returns {ChangeSet}
   */
  createParentChangeSet(options = {}) {
    const { threadId, turnId, conflictIds } = options;
    const workspacePath = options.workspacePath || this.harnessRuntime?.workspacePath || this.harnessRuntime?.baseDir || process.cwd();

    const targetConflicts = conflictIds
      ? conflictIds.map((id) => this.getConflict(id)).filter(Boolean)
      : this.listConflicts();

    if (targetConflicts.length === 0) {
      throw new Error('[CHANGE-CONFLICT-RESOLVER] No conflicts available to generate parent ChangeSet');
    }

    // Verify all conflicts are fully resolved
    const unresolved = targetConflicts.filter(
      (c) => c.status !== CONFLICT_STATUS.RESOLVED && c.status !== CONFLICT_STATUS.AUTO_RESOLVED
    );
    if (unresolved.length > 0) {
      throw new Error(
        `[CHANGE-CONFLICT-RESOLVER] Cannot create parent ChangeSet: unresolved conflicts remain on ${unresolved
          .map((c) => c.filePath)
          .join(', ')}`
      );
    }

    // Build edits for authoritative parent ChangeSet
    const edits = targetConflicts.map((c) => {
      let currentOriginal = c.parentContent;
      if (workspacePath) {
        try {
          const absPath = path.isAbsolute(c.filePath) ? c.filePath : path.join(workspacePath, c.filePath);
          if (fs.existsSync(absPath)) {
            currentOriginal = fs.readFileSync(absPath, 'utf-8');
          }
        } catch (_) {}
      }

      return {
        filePath: c.filePath,
        original: currentOriginal,
        replacement: c.resolvedContent,
        changeType: 'MODIFY',
        metadata: {
          conflictId: c.conflictId,
          sourceChangeSets: c.sourceChangeSets,
          resolution: c.resolution,
        },
      };
    });

    const parentChangeSet = new ChangeSet({
      workspacePath,
      threadId,
      turnId,
      intent: 'CONFLICT_RESOLUTION',
      edits,
      metadata: {
        resolvedConflicts: targetConflicts.map((c) => c.conflictId),
        sourceChangeSets: Array.from(new Set(targetConflicts.flatMap((c) => c.sourceChangeSets))),
      },
      eventBus: this.eventBus,
    });

    this._emit(EVENT_TYPES.CHANGE_CONFLICT_RESOLUTION_COMPLETED, {
      threadId,
      turnId,
      parentChangeSetId: parentChangeSet.changeSetId,
      resolvedConflictCount: targetConflicts.length,
      filesAffected: parentChangeSet.files.length,
    });

    return parentChangeSet;
  }

  /**
   * Executes the full authoritative parent safety pipeline, approval, and transactional apply.
   * @param {Object} options
   * @param {string} options.workspacePath
   * @param {string} options.threadId
   * @param {string} [options.turnId]
   * @param {Array<string>} [options.conflictIds]
   * @param {Function} [options.verifierFn]
   * @param {boolean} [options.autoApprove]
   * @returns {Promise<Object>}
   */
  async applyResolvedConflicts(options = {}) {
    const parentChangeSet = this.createParentChangeSet(options);

    // 1. Re-evaluate safety in parent context
    await parentChangeSet.evaluateSafety({
      workspacePath: options.workspacePath,
    });

    // 2. Approval check
    if (parentChangeSet.status === CHANGESET_STATUS.APPROVAL_REQUIRED && !options.autoApprove) {
      return {
        success: false,
        status: CHANGESET_STATUS.APPROVAL_REQUIRED,
        changeSetId: parentChangeSet.changeSetId,
        risk: parentChangeSet.risk,
        requiresApproval: true,
        parentChangeSet,
      };
    }

    if (options.autoApprove || parentChangeSet.status === CHANGESET_STATUS.APPROVAL_REQUIRED) {
      parentChangeSet.approve({
        approvedBy: options.approvedBy || 'parent_operator',
        reason: 'Approved 3-way conflict resolution',
      });
    }

    // 3. Transactional Atomic Apply
    const applyResult = await parentChangeSet.apply({
      workspacePath: options.workspacePath,
    });

    if (!applyResult.success) {
      return {
        success: false,
        status: CHANGESET_STATUS.ROLLED_BACK,
        changeSetId: parentChangeSet.changeSetId,
        error: applyResult.error,
        rolledBack: true,
      };
    }

    // 4. Verification
    let verification = null;
    if (typeof options.verifierFn === 'function') {
      verification = await parentChangeSet.verify(options.verifierFn);
    }

    // 5. EvidenceGraph audit recording
    if (evidenceGraphInstance && options.threadId) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: options.threadId,
          type: 'TRANSACTION',
          statement: `Successfully applied resolved ChangeSet ${parentChangeSet.changeSetId} across ${parentChangeSet.files.length} conflicting files`,
          provenanceClass: 'TRANSACTION_VERIFIED',
          verificationLevel: 'TRANSACTION_VERIFIED',
          metadata: {
            changeSetId: parentChangeSet.changeSetId,
            resolvedConflicts: options.conflictIds || Array.from(this.conflicts.keys()),
            transactionId: applyResult.transactionId,
          },
        });
      } catch (e) {}
    }

    return {
      success: true,
      status: CHANGESET_STATUS.APPLIED,
      changeSetId: parentChangeSet.changeSetId,
      transactionId: applyResult.transactionId,
      appliedFiles: parentChangeSet.files.map((f) => f.filePath),
      verification,
    };
  }

  /**
   * Cancels in-progress conflict resolution, preserving original child ChangeSets and parent workspace unchanged.
   * @param {Object} [options]
   */
  cancelResolution(options = {}) {
    const { threadId, turnId, reason } = options;

    this._emit(EVENT_TYPES.CHANGE_CONFLICT_RESOLUTION_REJECTED, {
      threadId,
      turnId,
      reason: reason || 'Conflict resolution cancelled by operator',
      conflictsCount: this.conflicts.size,
    });

    return {
      success: true,
      cancelled: true,
      reason: reason || 'Conflict resolution cancelled by operator',
    };
  }

  /**
   * Clears in-memory conflict state.
   */
  clear() {
    this.conflicts.clear();
  }

  /**
   * Persistence metadata export without raw secrets.
   */
  getPersistenceMetadata() {
    return secretFilter.sanitizeObject({
      conflictCount: this.conflicts.size,
      conflicts: Array.from(this.conflicts.values()).map((c) => ({
        conflictId: c.conflictId,
        filePath: c.filePath,
        sourceChangeSets: c.sourceChangeSets,
        conflictType: c.conflictType,
        status: c.status,
        resolution: c.resolution,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  }

  /**
   * Reconstructs conflicts across restart.
   * @param {Array<Object>} list
   */
  restoreConflicts(list = []) {
    this.conflicts.clear();
    if (Array.isArray(list)) {
      for (const item of list) {
        const conf = ChangeConflict.fromJSON(item);
        this.conflicts.set(conf.conflictId, conf);
      }
    }
  }
}

module.exports = {
  ChangeConflict,
  ChangeConflictResolver,
  perform3WayLineMerge,
  computeLineDiff,
};
