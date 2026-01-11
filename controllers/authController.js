import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import createError from "http-errors";
import { z } from "zod";
import { User } from "../models/User.js";

/** Get JWT secret */
const getJwtSecret = () => (process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "").trim();

const PUBLIC_ROLES = ["traveller", "guide", "instructor", "advisor"];
const normalizeSignupRole = (role) => {
  if (!role) return "traveller";
  const r = String(role).toLowerCase();
  return PUBLIC_ROLES.includes(r) ? r : "traveller";
};

const sign = (id, role) => {
  const secret = getJwtSecret();
  if (!secret) {
    throw createError(500, "JWT secret missing. Set JWT_ACCESS_SECRET in .env");
  }
  return jwt.sign({ id, role }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d", // 7 days for single token
  });
};

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  role: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signup = async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const exists = await User.findOne({ email: body.email });
    if (exists) return next(createError(409, "Email already registered"));

    const hash = await bcrypt.hash(body.password, 10);
    const user = await User.create({
      name: body.name,
      email: body.email,
      password: hash,
      role: normalizeSignupRole(body.role),
    });

    const token = sign(user._id.toString(), user.role);
    res.status(201).json({
      message: "Signup successful",
      data: { 
        token, 
        user: { 
          id: user._id, 
          name: user.name, 
          email: user.email, 
          role: user.role 
        } 
      },
    });
  } catch (err) { 
    next(err); 
  }
};

export const login = async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await User.findOne({ email: body.email }).select("+password");
    if (!user) return next(createError(401, "Invalid credentials"));

    const ok = await bcrypt.compare(body.password, user.password);
    if (!ok) return next(createError(401, "Invalid credentials"));

    const token = sign(user._id.toString(), user.role);
    res.json({
      message: "Login successful",
      data: { 
        token, 
        user: { 
          id: user._id, 
          name: user.name, 
          email: user.email, 
          role: user.role 
        } 
      },
    });
  } catch (err) { 
    next(err); 
  }
};

export const logout = async (req, res) => {
  // For single token approach, logout is just acknowledgment
  // Client handles token removal
  res.json({ message: "Logout successful" });
};

export const me = async (req, res) => {
  res.json({ data: { user: req.user } });
};