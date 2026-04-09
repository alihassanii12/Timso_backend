// Server-Sent Events — works on Vercel serverless
// Each client connects and gets pushed events

const clients = new Map(); // userId -> Set of response objects

export const addClient = (userId, res) => {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
};

export const removeClient = (userId, res) => {
  if (clients.has(userId)) {
    clients.get(userId).delete(res);
    if (clients.get(userId).size === 0) clients.delete(userId);
  }
};

export const sendToUser = (userId, event, data) => {
  if (!clients.has(userId)) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients.get(userId)) {
    try { res.write(msg); } catch {}
  }
};

export const sendToCompany = (companyId, event, data, excludeUserId = null) => {
  for (const [userId, resSet] of clients.entries()) {
    if (excludeUserId && String(userId) === String(excludeUserId)) continue;
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of resSet) {
      try { res.write(msg); } catch {}
    }
  }
};

export const broadcast = (event, data) => {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const resSet of clients.values()) {
    for (const res of resSet) {
      try { res.write(msg); } catch {}
    }
  }
};
