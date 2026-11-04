import { createHash } from 'node:crypto';
export const quoteStatuses = ['New', 'Quoted', 'Confirmed', 'Closed'];
const fail = (message) => {
  throw Object.assign(new Error(message), { statusCode: 400 });
};
const text = (value, label, max, required = false) => {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    fail(`Invalid ${label}`);
  return value.trim();
};
export function quoteSubmission(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Invalid quote request');
  const name = text(body.name, 'name', 100, true);
  if (name.length < 2) fail('Name must be at least 2 characters');
  const phone = text(body.phone, 'phone', 20, true).replace(/[\s()-]/g, '');
  if (!/^(?:\+92|0)?[0-9]{10,11}$/.test(phone)) fail('Provide a valid Pakistani phone number');
  if (
    typeof body.requestId !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId)
  )
    fail('Invalid request identifier');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30)
    fail('Provide 1–30 quote items');
  const seen = new Set();
  const items = body.items.map((item) => {
    if (!item || typeof item.productId !== 'string' || !/^[a-f0-9]{24}$/i.test(item.productId))
      fail('Invalid quote product');
    const productId = item.productId.toLowerCase();
    const size = text(item.size, 'pack size', 100, true);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999)
      fail('Quantity must be an integer from 1 to 999');
    const key = `${productId}:${size}`;
    if (seen.has(key)) fail('Duplicate quote pack');
    seen.add(key);
    return { productId, size, quantity: item.quantity };
  });
  const fulfillment = body.fulfillment || 'undecided';
  if (!['collection', 'delivery', 'undecided'].includes(fulfillment))
    fail('Invalid collection or delivery preference');
  const location = text(body.location, 'location', 200);
  if (fulfillment === 'delivery' && !location) fail('Provide your village or delivery location');
  return { requestId: body.requestId, name, phone, items, fulfillment, location };
}
export const submissionHash = (payload) =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');
export function snapshotQuoteItems(items, products) {
  return items.map((item) => {
    const product = products.find((row) => String(row._id) === item.productId);
    const pack = product?.sizes?.find((row) => row.size === item.size);
    if (!pack || (pack.stockStatus || product.stockStatus) === 'Out of Stock')
      fail('A selected pack is unavailable. Review your basket and try again.');
    return {
      productId: product._id,
      name: product.name,
      size: pack.size,
      quantity: item.quantity,
      unitPrice: null,
    };
  });
}
export function quotePricing(quote, patch) {
  const status = patch.status ?? quote.status;
  if (!quoteStatuses.includes(status)) fail('Invalid quote status');
  const money = (value) =>
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 10000000 &&
      Math.abs(value * 100 - Math.round(value * 100)) < 0.00001);
  const prices = patch.unitPrices ?? quote.items.map((item) => item.unitPrice ?? null);
  if (!Array.isArray(prices) || prices.length !== quote.items.length || !prices.every(money))
    fail('Provide a valid price for each pack, with at most two decimal places');
  const deliveryCharge =
    patch.deliveryCharge === undefined ? (quote.deliveryCharge ?? null) : patch.deliveryCharge;
  if (!money(deliveryCharge)) fail('Invalid delivery or collection charge');
  if (
    ['Quoted', 'Confirmed'].includes(status) &&
    (prices.some((price) => price === null) || deliveryCharge === null)
  )
    fail('Set every pack price and the delivery or collection charge before quoting or confirming');
  const priced = prices.every((price) => price !== null) && deliveryCharge !== null;
  const cents = priced
    ? prices.reduce(
        (sum, price, index) => sum + Math.round(price * 100) * quote.items[index].quantity,
        Math.round(deliveryCharge * 100),
      )
    : null;
  if (cents !== null && (!Number.isSafeInteger(cents) || cents > 100000000000))
    fail('Quote total exceeds the supported amount');
  return {
    status,
    items: quote.items.map((item, index) => ({ ...item, unitPrice: prices[index] })),
    deliveryCharge,
    total: cents === null ? null : cents / 100,
  };
}
