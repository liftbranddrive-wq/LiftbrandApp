const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://liftbrand-s--sops-default-rtdb.firebaseio.com'
    });
  } catch (e) {
    console.error('Firebase Admin init failed:', e.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { targetEmails, title, body, data = {}, sendToAll = false } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const db = admin.database();
    const snapshot = await db.ref('team').once('value');
    const teamData = snapshot.val() || {};
    const allMembers = Object.values(teamData);

    let targets = [];
    if (sendToAll) {
      targets = allMembers;
    } else if (targetEmails && targetEmails.length > 0) {
      targets = allMembers.filter(m => targetEmails.includes(m.email));
    }

    const allTokens = [];
    targets.forEach(member => {
      if (member.fcmTokens) {
        Object.values(member.fcmTokens).forEach(token => {
          if (token && typeof token === 'string') allTokens.push(token);
        });
      }
    });

    if (allTokens.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No registered devices found.' });
    }

    const messaging = admin.messaging();
    const results = await Promise.allSettled(
      allTokens.map(token =>
        messaging.send({
          token,
          notification: { title, body: body || '' },
          data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          webpush: {
            notification: {
              title,
              body: body || '',
              icon: 'https://assets.cdn.filesafe.space/kStDsoJsyMuEVTowimeB/media/695e8653f4549a075dee967f.png',
              badge: 'https://assets.cdn.filesafe.space/kStDsoJsyMuEVTowimeB/media/695e8653f4549a075dee967f.png',
              vibrate: [200, 100, 200],
              requireInteraction: false
            },
            fcmOptions: { link: '/' }
          }
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    const staleTokens = [];
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const errCode = result.reason?.errorInfo?.code || '';
        if (errCode.includes('registration-token-not-registered') || errCode.includes('invalid-argument')) {
          staleTokens.push(allTokens[idx]);
        }
      }
    });

    if (staleTokens.length > 0) {
      const cleanupTasks = allMembers.map(member => {
        if (!member.fcmTokens) return null;
        const tokens = member.fcmTokens;
        let changed = false;
        Object.entries(tokens).forEach(([key, val]) => {
          if (staleTokens.includes(val)) { delete tokens[key]; changed = true; }
        });
        if (changed) return db.ref(`team/${member.id}/fcmTokens`).set(tokens);
        return null;
      }).filter(Boolean);
      await Promise.allSettled(cleanupTasks);
    }

    return res.status(200).json({ sent, failed, stale: staleTokens.length });

  } catch (error) {
    console.error('[notify] Error:', error);
    return res.status(500).json({ error: error.message });
  }
};