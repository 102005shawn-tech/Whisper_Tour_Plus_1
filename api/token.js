export default async function handler(req, res) {

  // ===== CORS =====
  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  // 處理 OPTIONS 預檢請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {

    const { room, identity, isGuide } = req.query;

    if (!room || !identity) {
      return res.status(400).json({
        error: 'Missing room or identity'
      });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({
        error: 'Missing LiveKit ENV'
      });
    }

    const { AccessToken } =
      await import('livekit-server-sdk');

    const at = new AccessToken(
      apiKey,
      apiSecret,
      {
        identity: identity,
        ttl: '24h'
      }
    );

    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: isGuide === 'true',
      canSubscribe: true
    });

    const token = await at.toJwt();

    return res.status(200).json({
      token
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}