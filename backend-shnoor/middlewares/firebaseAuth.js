import admin from "../services/firebaseAdmin.js";
const firebaseAuth = async (req, res, next) => {
  console.log(' ');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║ [FIREBASE AUTH] Request received            ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('Path:', req.originalUrl);
  console.log('Auth header:', req.headers.authorization || 'MISSING');

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log('→ REJECT: No Bearer token');
    return res.status(401).json({ message: "Authorization token missing or invalid" });
  }

  const token = authHeader.split(" ")[1];
  console.log('→ Token (first 20 chars):', token.substring(0, 20) + '...');

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.firebase = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email,
    };
    console.log('→ AUTH SUCCESS → UID:', decodedToken.uid);
    next();
  } catch (error) {
    console.error('→ AUTH FAILED');
    console.error('  • Code:', error.code);
    console.error('  • Message:', error.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default firebaseAuth;
