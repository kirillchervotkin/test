export interface JwtConfig {
  accessSecret: string;
  accessExpiration: string;
  refreshSecret: string;
  refreshExpiration: string;
}
