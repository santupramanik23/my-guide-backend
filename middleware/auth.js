
// middleware/auth.js
import jwt from "jsonwebtoken";

const DEV = process.env.NODE_ENV !== 'production';

export function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const [scheme, headerToken] = auth.split(" ");
    const cookieToken = req.cookies?.accessToken;

    const token =
      (scheme === "Bearer" && headerToken) ? headerToken
      : (typeof cookieToken === "string" ? cookieToken : null);

    if (!token) {
      if (DEV) console.log("❌ No token provided");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    if (DEV) {
      console.log("✅ Token decoded - User:", decoded.id, "Role:", decoded.role);
    }

    req.user = decoded;
    return next();
  } catch (err) {
    if (DEV) console.log("❌ Token verification failed:", err.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (DEV) {
      console.log("🔐 Role check - Required:", roles, "User:", req.user?.role);
    }

    if (!req.user || !roles.includes(req.user.role)) {
      if (DEV) console.log("❌ FORBIDDEN: User role doesn't match");
      return res.status(403).json({ message: "Forbidden" });
    }

    if (DEV) console.log("✅ Role check passed");
    next();
  };
}