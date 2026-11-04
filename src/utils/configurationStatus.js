export function configurationStatus(environment = process.env) {
  const has = (...keys) =>
    keys.every((key) => typeof environment[key] === 'string' && environment[key].trim());
  return {
    cloudUploads: Boolean(
      has('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'),
    ),
    durableLocalMedia:
      environment.MEDIA_STORAGE === 'local' && environment.MEDIA_DURABLE_DISK === 'true',
    passwordRecovery: Boolean(has('RESEND_API_KEY', 'RECOVERY_FROM_EMAIL', 'RECOVERY_SITE_URL')),
    leadNotifications: Boolean(has('LEAD_NOTIFICATION_WEBHOOK')),
    database: Boolean(has('MONGODB_URI')),
    frontendOrigin: Boolean(has('FRONTEND_URL')),
  };
}
