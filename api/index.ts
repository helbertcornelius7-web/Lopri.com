export default async function handler(req: any, res: any) {
  try {
    const mod = await import('../server.js');
    return mod.default(req, res);
  } catch (e: any) {
    res.status(500).send(String(e?.stack || e));
  }
}

