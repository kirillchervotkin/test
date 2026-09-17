export const PROVIDERS = ['polar'] as const;
export type ProviderType = (typeof PROVIDERS)[number];
