import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
export const leadFields = async (body) => {
  const result = {};
  for (const key of ['status', 'internalNotes', 'followUpAt', 'assignedTo'])
    if (body[key] !== undefined) result[key] = body[key];
  if (result.assignedTo === '') result.assignedTo = null;
  if (result.followUpAt === '') result.followUpAt = null;
  if (result.followUpAt && !Number.isFinite(new Date(result.followUpAt).getTime()))
    throw Object.assign(new Error('Invalid follow-up date'), { statusCode: 400 });
  if (result.assignedTo && !mongoose.isValidObjectId(result.assignedTo))
    throw Object.assign(new Error('Choose a valid staff member'), { statusCode: 400 });
  if (result.assignedTo && !(await Admin.exists({ _id: result.assignedTo })))
    throw Object.assign(new Error('Choose an active staff member'), { statusCode: 400 });
  return result;
};
export const leadFilter = (query, terminal) => {
  const filter = {};
  if (typeof query.status === 'string' && query.status) filter.status = query.status;
  if (query.overdue === 'true')
    Object.assign(filter, {
      followUpAt: { $lt: new Date() },
      ...(filter.status
        ? { $and: [{ status: { $nin: terminal } }] }
        : { status: { $nin: terminal } }),
    });
  return filter;
};
