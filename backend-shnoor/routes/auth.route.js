// routes/auth.routes.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/postgres.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-long-secret-key-change-this-in-production-2025';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT user_id, full_name, email, role, password_hash, is_active FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user || !user.password_hash || !user.is_active) {
      return res.status(401).json({ message: 'Invalid credentials or account inactive' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        full_name: user.full_name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// POST /api/auth/register (optional - admin can use this to add users)
router.post('/register', async (req, res) => {
  const { email, password, full_name, role = 'student' } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ message: 'Email, password, and full name required' });
  }

  try {
    // Check if email exists
    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING user_id, email, full_name, role',
      [email, hashed, full_name, role]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

export default router;