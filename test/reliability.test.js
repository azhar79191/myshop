import assert from 'node:assert/strict';
import test from 'node:test';
import SiteSettings from '../src/models/SiteSettings.js';
import { updateSiteSettings, checkLogoRevision } from '../src/controllers/siteSettingsController.js';
import { quoteAuditEntry } from '../src/utils/quoteAudit.js';
import { drainNotificationQueue } from '../src/utils/notifications.js';
const invoke = (fn, req) => new Promise((resolve, reject) => fn(req, { set() {}, status(code) { this.code = code; return this; }, json(body) { resolve({ code: this.code, ...body }); return this; } }, reject));

test('stale settings and logo revisions cannot overwrite a newer save', async () => {
  const originals = { findOne: SiteSettings.findOne, findOneAndUpdate: SiteSettings.findOneAndUpdate, create: SiteSettings.create };
  let revision = 0, historyWrites = 0;
  SiteSettings.findOne = () => ({ lean: async () => ({ settings: { siteName: 'Saved' }, revision }) });
  SiteSettings.findOneAndUpdate = (filter, change) => ({ lean: async () => {
    if ((filter.revision ?? 0) !== revision) return null;
    historyWrites++;
    return { settings: change.$set.settings, revision: ++revision };
  } });
  const admin = { _id: '507f1f77bcf86cd799439011', fullName: 'Staff' };
  try {
    assert.equal((await invoke(updateSiteSettings, { admin, body: { siteName: 'No revision' } })).code, 400);
    const first = await invoke(updateSiteSettings, { admin, body: { _revision: 0, siteName: 'First save' } });
    assert.equal(first.data._revision, 1);
    assert.equal((await invoke(updateSiteSettings, { admin, body: { _revision: 0, siteName: 'Stale save' } })).code, 409);
    assert.equal((await invoke(checkLogoRevision, { admin, headers: { 'if-match': '0' } })).code, 409);
    assert.equal(historyWrites, 1);
    SiteSettings.findOne = () => ({ lean: async () => ({ settings: { siteName: 'Snapshot' }, revision: 1 }) });
    SiteSettings.findOneAndUpdate = () => ({ lean: async () => null });
    assert.equal((await invoke(updateSiteSettings, { admin, body: { _revision: 1, siteName: 'Lost race' } })).code, 409);
    SiteSettings.findOne = () => ({ lean: async () => null });
    SiteSettings.create = async () => { throw Object.assign(new Error('Duplicate'), { code: 11000 }); };
    assert.equal((await invoke(updateSiteSettings, { admin, body: { _revision: 0, siteName: 'Concurrent first save' } })).code, 409);
  } finally { Object.assign(SiteSettings, originals); }
});

test('price history records exact before/after amounts and the authenticated actor even without a status change', () => {
  const previous = { status: 'Quoted', items: [{ productId: 'product', name: 'Seed', size: '1kg', quantity: 2, unitPrice: 10 }], deliveryCharge: 0, total: 20 };
  const next = { ...previous, items: [{ ...previous.items[0], unitPrice: 12.5 }], deliveryCharge: 5, total: 30 };
  const admin = { _id: 'staff-id', fullName: 'Verified Staff' };
  const audit = quoteAuditEntry(previous, next, admin, new Date('2026-11-04T10:00:00Z'));
  assert.equal(audit.type, 'pricing'); assert.equal(audit.changedBy, admin._id); assert.equal(audit.actorName, admin.fullName);
  assert.deepEqual(audit.changes.map(change => [change.field, change.before, change.after]), [['unitPrice', 10, 12.5], ['deliveryCharge', 0, 5], ['total', 20, 30]]);
  assert.equal(quoteAuditEntry(previous, previous, admin), null);
  assert.equal(quoteAuditEntry(previous, { ...previous, status: 'Closed' }, admin).type, 'status');
});

test('notification retries persist state, redact transport errors and stop after three attempts', async () => {
  let clock = new Date('2026-11-04T10:00:00Z'), requests = 0, job = { _id: 'delivery-id', kind: 'quote', reference: 'quote-id', status: 'Pending', attempts: 0, nextAttemptAt: clock };
  const Model = {
    async updateMany() {},
    findOneAndUpdate(_filter, update) { return { lean: async () => {
      if (job.status !== 'Pending' || job.attempts >= 3 || job.nextAttemptAt > clock) return null;
      Object.assign(job, update.$set); job.attempts++; return { ...job };
    } }; },
    async updateOne(filter, update) { assert.equal(filter.claimToken, job.claimToken); Object.assign(job, update.$set); },
  };
  const options = { Model, environment: { LEAD_NOTIFICATION_WEBHOOK: 'https://example.com/hook', LEAD_NOTIFICATION_SECRET: 'secret' }, now: () => clock, fetcher: async (_url, request) => { requests++; assert.equal(request.headers['X-Notification-Id'], 'delivery-id'); assert.deepEqual(JSON.parse(request.body), { event: 'new_lead', kind: 'quote', reference: 'quote-id' }); throw new Error('private-url-and-secret'); } };
  for (let attempt = 1; attempt <= 3; attempt++) {
    await drainNotificationQueue(options);
    assert.equal(job.attempts, attempt);
    assert.doesNotMatch(job.lastError, /private|secret/);
    if (attempt < 3) { assert.equal(job.status, 'Pending'); clock = new Date(job.nextAttemptAt); }
  }
  assert.equal(job.status, 'Failed'); assert.equal(requests, 3);
  await drainNotificationQueue(options); assert.equal(requests, 3);
  job = { ...job, status: 'Pending', attempts: 0, nextAttemptAt: clock };
  await drainNotificationQueue({ ...options, fetcher: async () => ({ ok: true }) });
  assert.equal(job.status, 'Delivered'); assert.ok(job.deliveredAt);
  job = { ...job, status: 'Pending', attempts: 0, nextAttemptAt: clock };
  await drainNotificationQueue({ ...options, environment: {} });
  assert.equal(job.status, 'Disabled');
});
