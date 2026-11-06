import mongoose from 'mongoose';
import NotificationDelivery from './NotificationDelivery.js';
const schema = NotificationDelivery.schema.clone();
schema.clearIndexes();
schema.remove('kind');
schema.add({
  kind: {
    type: String,
    enum: ['stock', 'followup-contact', 'followup-service', 'followup-quote'],
    required: true,
  },
});
schema.add({ eventKey: { type: String, required: true } });
schema.index({ eventKey: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
export default mongoose.model('AutomationDelivery', schema);
