// Server-Sent Events
// clients: userId -> { res: Set, companyId }

const clients = new Map(); // userId -> { resSet: Set, companyId }

export const addClient = (userId, companyId, res) => {
  if (!clients.has(userId)) {
    clients.set(userId, { resSet: new Set(), companyId: companyId || null });
  }
  clients.get(userId).resSet.add(res);
};

export const removeClient = (userId, res) => {
  if (clients.has(userId)) {
    clients.get(userId).resSet.delete(res);
    if (clients.get(userId).resSet.size === 0) clients.delete(userId);
  }
};

export const sendToUser = (userId, event, data) => {
  if (!clients.has(userId)) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients.get(userId).resSet) {
    try { res.write(msg); } catch {}
  }
};

export const sendToCompany = (companyId, event, data, excludeUserId = null) => {
  if (!companyId) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [userId, { resSet, companyId: cid }] of clients.entries()) {
    if (String(cid) !== String(companyId)) continue;
    if (excludeUserId && String(userId) === String(excludeUserId)) continue;
    for (const res of resSet) {
      try { res.write(msg); } catch {}
    }
  }
};

export const broadcast = (event, data) => {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const { resSet } of clients.values()) {
    for (const res of resSet) {
      try { res.write(msg); } catch {}
    }
  }
};
