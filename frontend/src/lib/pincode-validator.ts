/**
 * Indian PIN code validator — two-layer approach:
 *
 * Layer 1 (instant, no API): Checks first 2 digits against state.
 *   → Gives immediate feedback as user types.
 *
 * Layer 2 (async, India Post API): Validates full 6-digit PIN
 *   against both the selected state AND city/district.
 *   → Called only when all 6 digits are entered.
 */

// ─────────────────────────────────────────────────────────────
// Layer 1 — prefix based (instant, runs on every keystroke)
// ─────────────────────────────────────────────────────────────

const PIN_PREFIX_STATE_MAP: Record<string, string[]> = {
  '11': ['Delhi'],
  '12': ['Haryana'],
  '13': ['Haryana'],
  '14': ['Punjab'],
  '15': ['Punjab'],
  '16': ['Punjab', 'Chandigarh'],
  '17': ['Himachal Pradesh'],
  '18': ['Jammu & Kashmir'],
  '19': ['Jammu & Kashmir', 'Ladakh'],
  '20': ['Uttar Pradesh'],
  '21': ['Uttar Pradesh'],
  '22': ['Uttar Pradesh'],
  '23': ['Uttar Pradesh'],
  '24': ['Uttar Pradesh', 'Uttarakhand'],
  '25': ['Uttar Pradesh', 'Uttarakhand'],
  '26': ['Uttar Pradesh', 'Uttarakhand'],
  '27': ['Uttar Pradesh'],
  '28': ['Uttar Pradesh'],
  '30': ['Rajasthan'],
  '31': ['Rajasthan'],
  '32': ['Rajasthan'],
  '33': ['Rajasthan'],
  '34': ['Rajasthan'],
  '36': ['Gujarat'],
  '37': ['Gujarat'],
  '38': ['Gujarat'],
  '39': ['Gujarat', 'Dadra & Nagar Haveli and Daman & Diu'],
  '40': ['Maharashtra', 'Goa'],
  '41': ['Maharashtra', 'Goa'],
  '42': ['Maharashtra'],
  '43': ['Maharashtra'],
  '44': ['Maharashtra'],
  '45': ['Madhya Pradesh'],
  '46': ['Madhya Pradesh'],
  '47': ['Madhya Pradesh'],
  '48': ['Madhya Pradesh'],
  '49': ['Madhya Pradesh', 'Chhattisgarh'],
  '50': ['Telangana', 'Andhra Pradesh'],
  '51': ['Telangana', 'Andhra Pradesh'],
  '52': ['Telangana', 'Andhra Pradesh'],
  '53': ['Andhra Pradesh'],
  '56': ['Karnataka'],
  '57': ['Karnataka'],
  '58': ['Karnataka'],
  '59': ['Karnataka'],
  '60': ['Tamil Nadu', 'Puducherry'],
  '61': ['Tamil Nadu'],
  '62': ['Tamil Nadu'],
  '63': ['Tamil Nadu'],
  '64': ['Tamil Nadu'],
  '65': ['Tamil Nadu', 'Puducherry'],
  '67': ['Kerala', 'Puducherry'],
  '68': ['Kerala', 'Lakshadweep'],
  '69': ['Kerala'],
  '70': ['West Bengal'],
  '71': ['West Bengal'],
  '72': ['West Bengal'],
  '73': ['West Bengal', 'Sikkim'],
  '74': ['West Bengal', 'Andaman & Nicobar Islands'],
  '75': ['Odisha'],
  '76': ['Odisha'],
  '77': ['Odisha'],
  '78': ['Assam'],
  '79': ['Arunachal Pradesh', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland', 'Tripura', 'Sikkim'],
  '80': ['Bihar'],
  '81': ['Bihar', 'Jharkhand'],
  '82': ['Jharkhand'],
  '83': ['Jharkhand'],
  '84': ['Bihar'],
  '85': ['Bihar'],
};

export interface PincodeValidation {
  valid: boolean;
  error?: string;
}

/** Instant prefix check — no API call. */
export function validatePincodeForState(pincode: string, state: string): PincodeValidation {
  if (!state || !pincode || pincode.length < 2) return { valid: true };
  if (!/^\d+$/.test(pincode)) return { valid: false, error: 'PIN code must contain only digits.' };

  const prefix = pincode.slice(0, 2);
  const validStates = PIN_PREFIX_STATE_MAP[prefix];

  if (!validStates) {
    return { valid: false, error: `"${prefix}XXXX" is not a recognized Indian PIN code range.` };
  }

  if (!validStates.includes(state)) {
    return {
      valid: false,
      error: `PIN codes starting with ${prefix} belong to ${validStates.join(' / ')}, not ${state}. Please enter a valid ${state} PIN code.`,
    };
  }

  return { valid: true };
}


// ─────────────────────────────────────────────────────────────
// Layer 2 — India Post API (async, called on complete 6-digit PIN)
// ─────────────────────────────────────────────────────────────

export interface DeepPincodeResult {
  valid: boolean;
  stateMatch: boolean;
  cityMatch: boolean;
  returnedState?: string;
  returnedDistrict?: string;
  officeNames?: string[];
  error?: string;
}

/**
 * Calls api.postalpincode.in and checks whether the PIN code's
 * registered state and district match the user-selected state and city.
 */
export async function validatePincodeDeep(
  pincode: string,
  state: string,
  city: string
): Promise<DeepPincodeResult> {
  if (!/^\d{6}$/.test(pincode)) {
    return { valid: false, stateMatch: false, cityMatch: false, error: 'PIN code must be exactly 6 digits.' };
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!res.ok) throw new Error('Lookup failed');
    const data = await res.json();

    if (!data?.[0] || data[0].Status !== 'Success') {
      return {
        valid: false,
        stateMatch: false,
        cityMatch: false,
        error: 'This PIN code was not found in the India Post database. Please double-check it.',
      };
    }

    const offices: any[] = data[0].PostOffice || [];
    const returnedState: string = offices[0]?.State || '';
    const returnedDistrict: string = offices[0]?.District || '';
    const officeNames: string[] = offices.map((o: any) => o.Name as string);

    // ── State match (case-insensitive, normalised) ──────────────
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    const stateMatch = state
      ? normalise(returnedState).includes(normalise(state)) ||
        normalise(state).includes(normalise(returnedState))
      : true;

    // ── City match ───────────────────────────────────────────────
    // Check against district name and all post office names.
    // Fuzzy: either the city contains the result OR the result contains the city.
    let cityMatch = true;
    if (city.trim()) {
      const normCity = normalise(city);
      const allNames = [returnedDistrict, ...officeNames].map(normalise);
      cityMatch = allNames.some(n => n.includes(normCity) || normCity.includes(n));
    }

    const valid = stateMatch && cityMatch;

    let error: string | undefined;
    if (!stateMatch) {
      error = `This PIN code belongs to ${returnedState}, not ${state}. Please enter a valid ${state} PIN code.`;
    } else if (!cityMatch) {
      error = `This PIN code belongs to ${returnedDistrict} district (${returnedState}), not "${city}". Please enter the correct PIN code for your city.`;
    }

    return { valid, stateMatch, cityMatch, returnedState, returnedDistrict, officeNames, error };
  } catch {
    // Network error — don't block the user, just skip deep validation
    return { valid: true, stateMatch: true, cityMatch: true };
  }
}
