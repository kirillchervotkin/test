export class OAuthToken {
  id: string;
  serviceName: string;
  userId: string;
  encryptedAccessToken: string;
  externalUserId?: string | null;
  ivAccess: string;
  authTagAccess: string;
  encryptedRefreshToken?: string | null;
  ivRefresh?: string | null;
  authTagRefresh?: string | null;
  expiresAt: Date;
  scope?: string | null;
  createdAt: Date;
  updatedAt: Date;
  isRevoked: boolean;
}
