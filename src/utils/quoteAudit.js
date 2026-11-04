export function quoteAuditEntry(previous, next, admin, now = new Date()) {
  const changes = [];
  previous.items.forEach((item, index) => {
    const before = item.unitPrice ?? null, after = next.items[index].unitPrice ?? null;
    if (before !== after) changes.push({ field: 'unitPrice', productId: item.productId, productName: item.name, pack: item.size, before, after });
  });
  for (const field of ['deliveryCharge', 'total']) if ((previous[field] ?? null) !== (next[field] ?? null)) changes.push({ field, before: previous[field] ?? null, after: next[field] ?? null });
  if (!changes.length && previous.status === next.status) return null;
  return { type: changes.length ? 'pricing' : 'status', status: next.status, at: now, changedBy: admin._id, actorName: admin.fullName || admin.username || 'Admin', changes };
}
