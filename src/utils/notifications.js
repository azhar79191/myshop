// Optional HTTPS webhook. Only references are sent; customer details stay in the CMS.
export const notifyNewLead = async (kind, reference) => {
  if (!process.env.LEAD_NOTIFICATION_WEBHOOK) return;
  try {
    const url = new URL(process.env.LEAD_NOTIFICATION_WEBHOOK);
    if (url.protocol !== 'https:') throw new Error('Notification webhook requires HTTPS');
    const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', ...(process.env.LEAD_NOTIFICATION_SECRET ? { Authorization: `Bearer ${process.env.LEAD_NOTIFICATION_SECRET}` } : {}) }, body: JSON.stringify({ event: 'new_lead', kind, reference: String(reference) }) });
    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
  } catch (error) { console.error('Lead notification failed:', error.message); }
};
