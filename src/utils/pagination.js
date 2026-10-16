const MAX_LIMIT = 50;

const positiveInteger = (value, fallback) => {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getPagination = (pageValue, limitValue, defaultLimit = 20) => {
  const limit = Math.min(positiveInteger(limitValue, defaultLimit), MAX_LIMIT);
  const maxPage = Math.floor(Number.MAX_SAFE_INTEGER / limit) + 1;
  const page = Math.min(positiveInteger(pageValue, 1), maxPage);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};
