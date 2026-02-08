/**
 * Phase 3B: Occasion normalization and rules for outfit scoring.
 * Deterministic, no external calls.
 */

const OCCASION_RULES = {
  college: {
    label: 'college',
    formalityRange: [0, 5],
    styleBias: ['casual', 'comfortable'],
    requiredCategories: ['top', 'bottom'],
  },
  casual: {
    label: 'casual',
    formalityRange: [0, 5],
    styleBias: ['casual', 'relaxed'],
    requiredCategories: ['top', 'bottom'],
  },
  formal: {
    label: 'formal',
    formalityRange: [7, 10],
    styleBias: ['formal', 'polished'],
    requiredCategories: ['top', 'bottom', 'shoes'],
  },
  work: {
    label: 'work',
    formalityRange: [5, 8],
    styleBias: ['professional', 'smart'],
    requiredCategories: ['top', 'bottom', 'shoes'],
  },
  party: {
    label: 'party',
    formalityRange: [4, 9],
    styleBias: ['festive', 'stylish'],
    requiredCategories: ['top', 'bottom', 'shoes'],
  },
  gym: {
    label: 'gym',
    formalityRange: [0, 3],
    styleBias: ['athletic', 'comfortable'],
    requiredCategories: ['top', 'bottom'],
  },
  date: {
    label: 'date',
    formalityRange: [4, 8],
    styleBias: ['smart-casual', 'polished'],
    requiredCategories: ['top', 'bottom', 'shoes'],
  },
  traditional: {
    label: 'traditional',
    formalityRange: [6, 10],
    styleBias: ['traditional', 'formal'],
    requiredCategories: ['top', 'bottom', 'shoes'],
  },
};

// Loose input mappings: lowercase key -> normalized occasion
const NORMALIZE_MAP = {
  college: 'college',
  campus: 'college',
  uni: 'college',
  university: 'college',

  casual: 'casual',
  casual_outing: 'casual',
  everyday: 'casual',
  hangout: 'casual',
  brunch: 'casual',

  formal: 'formal',
  wedding: 'formal',
  gala: 'formal',
  interview: 'formal',

  work: 'work',
  office: 'work',
  business: 'work',
  professional: 'work',

  party: 'party',
  partying: 'party',
  nightout: 'party',

  gym: 'gym',
  workout: 'gym',
  exercise: 'gym',
  athletic: 'gym',

  date: 'date',
  datenight: 'date',

  traditional: 'traditional',
  ethnic: 'traditional',
};

/**
 * Normalize loose occasion input to a canonical occasion string.
 * Unknown inputs default to "casual".
 * @param {string|undefined} input
 * @returns {string}
 */
function normalizeOccasion(input) {
  if (input == null || typeof input !== 'string') {
    return 'casual';
  }
  const trimmed = input.trim();
  if (!trimmed) return 'casual';

  const lower = trimmed.toLowerCase().replace(/[\s_-]+/g, '_');
  const direct = NORMALIZE_MAP[lower];
  if (direct) return direct;

  // Try substring match for compound inputs (e.g. "smart-casual" -> casual)
  for (const [key, norm] of Object.entries(NORMALIZE_MAP)) {
    if (lower.includes(key) || key.includes(lower.replace(/_/g, ''))) {
      return norm;
    }
  }
  return 'casual';
}

/**
 * Get occasion rule for scoring. Always returns a valid rule.
 * @param {string} occasion - Normalized occasion (use normalizeOccasion first)
 * @returns {{ label: string, formalityRange: [number, number], styleBias: string[], requiredCategories: string[] }}
 */
function getOccasionRule(occasion) {
  const norm = occasion ? occasion.toLowerCase().trim() : 'casual';
  return OCCASION_RULES[norm] || OCCASION_RULES.casual;
}

module.exports = {
  normalizeOccasion,
  getOccasionRule,
};
