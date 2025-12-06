// Demographics options - matching web app
export const AGE_OPTIONS = [
  { value: '18-24', label: '18 - 24' },
  { value: '25-34', label: '25 - 34' },
  { value: '35-44', label: '35 - 44' },
  { value: '45-54', label: '45 - 54' },
  { value: '55-64', label: '55 - 64' },
  { value: '65+', label: '65+' },
] as const;

export const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export const ETHNICITY_OPTIONS = [
  { value: 'black', label: 'Black / African descent' },
  { value: 'white', label: 'White / Caucasian' },
  { value: 'latinx', label: 'Latino / Hispanic' },
  { value: 'middle-eastern', label: 'Middle Eastern / North African' },
  { value: 'south-asian', label: 'South Asian' },
  { value: 'east-asian', label: 'East Asian' },
  { value: 'southeast-asian', label: 'Southeast Asian' },
  { value: 'indigenous', label: 'Indigenous / Native' },
  { value: 'pacific-islander', label: 'Pacific Islander' },
  { value: 'mixed', label: 'Mixed / Multiracial' },
  { value: 'other', label: 'Other' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;
