export const CLIENT_TYPES = ['web'] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];
