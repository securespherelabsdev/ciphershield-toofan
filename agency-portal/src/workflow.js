'use strict';

/*
 * Case workflow state machine for CipherShield agency portal.
 *
 * All status labels, colors, valid transitions, and action definitions
 * live here. Nothing else in the codebase hard-codes status strings.
 */

export const STATUS = {
  QUARANTINE:  'QUARANTINE',
  REVIEW:      'REVIEW',
  DISPATCH:    'DISPATCH',
  ESCALATED:   'ESCALATED',
  ACTIONED:    'ACTIONED',
  NO_FINDING:  'NO_FINDING',
};

// Human-readable labels for each status
export const STATUS_LABEL = {
  QUARANTINE: 'Quarantined',
  REVIEW:     'Pending Review',
  DISPATCH:   'Dispatched to Field',
  ESCALATED:  'Escalated',
  ACTIONED:   'Action Taken',
  NO_FINDING: 'No Finding',
};

// Short label for badges / chips
export const STATUS_SHORT = {
  QUARANTINE: 'Quarantine',
  REVIEW:     'Review',
  DISPATCH:   'Dispatched',
  ESCALATED:  'Escalated',
  ACTIONED:   'Actioned',
  NO_FINDING: 'No Finding',
};

// Tailwind color classes per status (light theme)
export const STATUS_COLORS = {
  QUARANTINE: {
    bg:     'bg-red-50',
    border: 'border-red-200',
    text:   'text-red-700',
    dot:    'bg-red-500',
  },
  REVIEW: {
    bg:     'bg-amber-50',
    border: 'border-amber-200',
    text:   'text-amber-700',
    dot:    'bg-amber-500',
  },
  DISPATCH: {
    bg:     'bg-blue-50',
    border: 'border-blue-200',
    text:   'text-blue-700',
    dot:    'bg-blue-600',
  },
  ESCALATED: {
    bg:     'bg-purple-50',
    border: 'border-purple-200',
    text:   'text-purple-700',
    dot:    'bg-purple-500',
  },
  ACTIONED: {
    bg:     'bg-green-50',
    border: 'border-green-200',
    text:   'text-green-700',
    dot:    'bg-green-500',
  },
  NO_FINDING: {
    bg:     'bg-slate-100',
    border: 'border-slate-200',
    text:   'text-slate-600',
    dot:    'bg-slate-400',
  },
};

// Valid next states from each current state.
// Terminal states (ACTIONED, NO_FINDING) have no transitions.
export const TRANSITIONS = {
  QUARANTINE: ['REVIEW'],
  REVIEW:     ['DISPATCH', 'QUARANTINE'],
  DISPATCH:   ['ACTIONED', 'NO_FINDING', 'ESCALATED'],
  ESCALATED:  ['ACTIONED', 'NO_FINDING', 'DISPATCH'],
  ACTIONED:   [],
  NO_FINDING: [],
};

// Per-action metadata: label, description, confirmation copy, style, requiresNote
export const ACTIONS = {
  REVIEW: {
    label:       'Promote to Review',
    description: 'Move this lead from quarantine into the active review queue.',
    confirmTitle:'Promote to Review?',
    confirmBody: 'This lead will appear in the active queue for dispatch consideration.',
    style:       'primary',
    requiresNote: false,
  },
  DISPATCH: {
    label:       'Dispatch to Field',
    description: 'Send this lead to field officers for investigation.',
    confirmTitle:'Dispatch to Field?',
    confirmBody: 'An automated intelligence summary will be generated. Field officers will receive this lead.',
    style:       'primary',
    requiresNote: false,
  },
  ESCALATED: {
    label:       'Escalate',
    description: 'Flag for senior officer or specialist unit attention.',
    confirmTitle:'Escalate this case?',
    confirmBody: 'This lead will be flagged for senior review. Add a note explaining why escalation is needed.',
    style:       'warning',
    requiresNote: true,
  },
  ACTIONED: {
    label:       'Mark Action Taken',
    description: 'Record that field action has been completed on this lead.',
    confirmTitle:'Mark as Actioned?',
    confirmBody: 'This closes the lead. Add a brief note about what action was taken. This cannot be undone.',
    style:       'success',
    requiresNote: true,
  },
  NO_FINDING: {
    label:       'No Finding',
    description: 'Investigation complete — no evidence found to support the report.',
    confirmTitle:'Record No Finding?',
    confirmBody: 'This closes the lead as unsubstantiated. Add a note if relevant. This cannot be undone.',
    style:       'neutral',
    requiresNote: false,
  },
  QUARANTINE: {
    label:       'Send to Quarantine',
    description: 'Remove from active queue — low credibility or duplicate.',
    confirmTitle:'Send to Quarantine?',
    confirmBody: 'This lead will be removed from the active queue. It can be promoted again if needed.',
    style:       'danger',
    requiresNote: false,
  },
};

// Score band → status (mirrors backend fpScoring.js thresholds)
export function scoreBand(score) {
  if (score <= 39) return STATUS.QUARANTINE;
  if (score <= 69) return STATUS.REVIEW;
  return STATUS.DISPATCH;
}

export function isTerminal(status) {
  return TRANSITIONS[status]?.length === 0;
}

export function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
