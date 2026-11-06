import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import https from 'node:https';

const blocked = new BlockList();
for (const [ip, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
])
  blocked.addSubnet(ip, prefix, 'ipv4');
const global6 = new BlockList();
global6.addSubnet('2000::', 3, 'ipv6');
for (const [ip, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
])
  blocked.addSubnet(ip, prefix, 'ipv6');
export const isPublicAddress = (address) =>
  isIP(address) === 4
    ? !blocked.check(address, 'ipv4')
    : isIP(address) === 6 && global6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
export function approvedWebhookUrl(value, env = process.env) {
  const url = new URL(value);
  const allowed = (env.CONFIG_ALLOWED_WEBHOOK_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  // Existing hosting configuration is also a trusted destination, never an admin-supplied override.
  try {
    allowed.push(new URL(env.LEAD_NOTIFICATION_WEBHOOK).hostname.toLowerCase());
  } catch {
    /* optional */
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== '443') ||
    isIP(url.hostname.replace(/^\[|\]$/g, '')) ||
    !allowed.includes(url.hostname.toLowerCase())
  )
    throw new Error('Use an HTTPS webhook on a hosting-approved hostname');
  return url;
}
export async function webhookAddress(url, resolver = lookup) {
  let timer;
  const addresses = await Promise.race([
    resolver(url.hostname, { all: true, verbatim: true }),
    new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Webhook DNS lookup timed out')), 3000);
      timer.unref();
    }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some((row) => !isPublicAddress(row.address)))
    throw new Error('Webhook destination is not public');
  return addresses[0];
}
// Resolve once, validate every result, and pin that IP for the TLS connection.
// No redirects, proxy environment handling, or provider response bodies.
export async function safeWebhookFetch(
  value,
  options = {},
  { env = process.env, resolver = lookup, request = https.request } = {},
) {
  const url = approvedWebhookUrl(String(value), env);
  const resolved = await webhookAddress(url, resolver);
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'POST',
        headers: options.headers,
        signal: options.signal,
        agent: false,
        lookup: (_host, lookupOptions, done) =>
          lookupOptions?.all
            ? done(null, [resolved])
            : done(null, resolved.address, resolved.family),
      },
      (res) => {
        const status = res.statusCode;
        res.destroy();
        resolve({ status, ok: status >= 200 && status < 300 });
      },
    );
    req.on('error', () => reject(new Error('Webhook delivery failed')));
    req.end(options.body || '');
  });
}
