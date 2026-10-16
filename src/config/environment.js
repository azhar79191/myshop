import 'dotenv/config';

const REQUIRED_ENVIRONMENT_VARIABLES = ['MONGODB_URI', 'JWT_SECRET'];

export const validateEnvironment = (environment = process.env) => {
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter(
    (key) => !environment[key]?.trim()
  );

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const port = Number(environment.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return {
    mongoUri: environment.MONGODB_URI.trim(),
    jwtSecret: environment.JWT_SECRET,
    port,
  };
};
