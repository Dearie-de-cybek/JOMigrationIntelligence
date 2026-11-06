export interface AppConfig {
  nodeEnv: string;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  cookieSecret: string;
  seed: {
    superAdminEmail: string;
    superAdminPassword: string;
  };
}

export default (): { app: AppConfig } => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-change-me-access-secret',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-only-change-me-refresh-secret',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    },
    cookieSecret: process.env.COOKIE_SECRET ?? 'dev-only-change-me-cookie-secret',
    seed: {
      superAdminEmail: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@joeducationconsultant.com.ng',
      superAdminPassword: process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!',
    },
  },
});
