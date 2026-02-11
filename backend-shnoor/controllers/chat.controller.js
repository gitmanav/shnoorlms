import pool from "../db/postgres.js";

// Initialize Tables
export const initChatTables = async () => {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    console.log("Checking / initializing chat schemas (safe mode)...");

    // Files table – safe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        file_id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Chats table – safe, no DROP
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        chat_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        instructor_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        participant1 UUID REFERENCES users(user_id) ON DELETE CASCADE,
        participant2 UUID REFERENCES users(user_id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_instructor_student_chat UNIQUE (instructor_id, student_id)
      );
    `);

    // Messages table – safe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        chat_id UUID NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        receiver_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        attachment_file_id INT REFERENCES files(file_id),
        attachment_type VARCHAR(50),
        attachment_name TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Chat tables checked / initialized (no drops performed)");
  } catch (err) {
    console.error("❌ Error initializing chat tables:", err.message);
  }
};

// GET /api/chats
// GET /api/chats
// controllers/chat.controller.js - getMyChats
export const getMyChats = async (req, res) => {
  try {
    const firebaseUid = req.firebase?.uid;

    if (!firebaseUid) {
      console.log('[getMyChats] No firebase UID');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log(`[getMyChats] Loading chats for Firebase UID: ${firebaseUid}`);

    // Map Firebase UID → internal user_id (UUID)
    const userLookup = await pool.query(
      'SELECT user_id FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );

    if (userLookup.rows.length === 0) {
      console.log(`[getMyChats] No user found for firebase_uid: ${firebaseUid}`);
      return res.status(404).json({ message: 'User not found' });
    }

    const userId = userLookup.rows[0].user_id;
    console.log(`[getMyChats] Mapped to internal user_id: ${userId}`);

    // Use participant1 & participant2 (columns created by your migration)
    const result = await pool.query(
      `SELECT
          c.chat_id,
          c.participant1,
          c.participant2,
          u1.full_name AS participant1_name,
          u1.role AS participant1_role,
          u2.full_name AS participant2_name,
          u2.role AS participant2_role,
          c.created_at,
          c.updated_at,
          (
              SELECT text FROM messages m
              WHERE m.chat_id = c.chat_id
              ORDER BY m.created_at DESC LIMIT 1
          ) AS last_message,
          (
              SELECT COUNT(*)::int FROM messages m
              WHERE m.chat_id = c.chat_id
              AND m.is_read = FALSE
              AND m.sender_id != $1
          ) AS unread_count
       FROM chats c
       LEFT JOIN users u1 ON c.participant1 = u1.user_id
       LEFT JOIN users u2 ON c.participant2 = u2.user_id
       WHERE $1 IN (c.participant1, c.participant2)
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    console.log(`[getMyChats] Found ${result.rows.length} chats`);

    res.json(result.rows);
  } catch (err) {
    console.error('[getMyChats] ERROR:', {
      message: err.message,
      code: err.code,
      detail: err.detail || 'no detail',
      position: err.position || 'unknown',
      stack: err.stack?.substring(0, 300) + '...'
    });

    res.status(500).json({ message: 'Failed to load chats' });
  }
};
// GET /api/chats/messages/:chatId
export const getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const result = await pool.query(`
            SELECT 
                m.*,
                u.firebase_uid as sender_uid,
                u.full_name as sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.user_id
            WHERE m.chat_id = $1
            ORDER BY m.created_at ASC
        `, [chatId]);

        const messages = result.rows.map(msg => ({
            ...msg,
            attachment_url: msg.attachment_file_id
                ? `${process.env.VITE_API_URL || 'http://localhost:5000'}/api/files/${msg.attachment_file_id}`
                : null
        }));

        res.json(messages);
    } catch (err) {
        console.error("GET /messages Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

// POST /api/chats (Start a new conversation - generic version)
export const createChat = async (req, res) => {
    console.log("🔵 createChat endpoint hit");
    console.log("🔵 User:", req.user);
    console.log("🔵 Body:", req.body);

    try {
        const { recipientId } = req.body;
        if (!recipientId) {
            return res.status(400).json({ message: "recipientId is required" });
        }

        const senderId = req.user.id;

        if (senderId === recipientId) {
            return res.status(400).json({ message: "Cannot create chat with yourself" });
        }

        // Sort to always have consistent order (avoids duplicates)
        const [p1, p2] = [senderId, recipientId].sort();

        // Check if chat already exists
        const check = await pool.query(
            `SELECT chat_id 
             FROM chats 
             WHERE participant1 = $1 AND participant2 = $2`,
            [p1, p2]
        );

        if (check.rows.length > 0) {
            console.log("✅ Chat already exists:", check.rows[0].chat_id);
            return res.json({ 
                chat_id: check.rows[0].chat_id, 
                isNew: false 
            });
        }

        // Create new chat
        const newChat = await pool.query(
            `INSERT INTO chats (participant1, participant2) 
             VALUES ($1, $2) 
             RETURNING chat_id`,
            [p1, p2]
        );

        console.log("✅ New generic chat created:", newChat.rows[0].chat_id);

        res.json({ 
            chat_id: newChat.rows[0].chat_id, 
            isNew: true 
        });

    } catch (err) {
        console.error("❌ Create Chat Error:", err.stack);
        res.status(500).json({ 
            message: "Failed to create chat", 
            error: err.message 
        });
    }
};

// PUT /api/chats/read
export const markRead = async (req, res) => {
    try {
        const { chatId } = req.body;
        const userId = req.user.id;

        await pool.query(
            "UPDATE messages SET is_read = TRUE WHERE chat_id = $1 AND sender_id != $2",
            [chatId, userId]
        );
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
};

// POST /api/files/upload
export const uploadFile = async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file uploaded");
        const { originalname, mimetype, buffer } = req.file;

        const newFile = await pool.query(
            "INSERT INTO files (filename, mime_type, data) VALUES ($1, $2, $3) RETURNING file_id",
            [originalname, mimetype, buffer]
        );

        res.json({ file_id: newFile.rows[0].file_id });
    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).send("File upload failed");
    }
};

// GET /api/files/:id
export const serveFile = async (req, res) => {
    try {
        const { id } = req.params;
        const file = await pool.query("SELECT * FROM files WHERE file_id = $1", [id]);

        if (file.rows.length === 0) return res.status(404).send("File not found");

        const { mime_type, data, filename } = file.rows[0];
        res.setHeader('Content-Type', mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(data);
    } catch (err) {
        console.error("File Serve Error:", err);
        res.status(500).send("Error serving file");
    }
};

// GET /api/chats/available-students (For Instructors)
export const getAvailableStudents = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT 
                u.user_id,
                u.full_name,
                u.email,
                u.firebase_uid,
                CASE 
                    WHEN c.chat_id IS NOT NULL THEN c.chat_id
                    ELSE NULL
                END as existing_chat_id
            FROM users u
            LEFT JOIN chats c ON (
                (c.student_id = u.user_id AND c.instructor_id = $1)
            )
            WHERE u.role IN ('student', 'learner') 
            AND u.status = 'active'
            ORDER BY u.full_name ASC;
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error("GET /available-students Error:", err);
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

// GET /api/chats/available-instructors (For Students)
export const getAvailableInstructors = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT 
                u.user_id,
                u.full_name,
                u.email,
                u.firebase_uid,
                CASE 
                    WHEN c.chat_id IS NOT NULL THEN c.chat_id
                    ELSE NULL
                END as existing_chat_id
            FROM users u
            LEFT JOIN chats c ON (
                (c.instructor_id = u.user_id AND c.student_id = $1)
            )
            WHERE u.role IN ('instructor', 'company') 
            AND u.status = 'active'
            ORDER BY u.full_name ASC;
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error("GET /available-instructors Error:", err);
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

// GET /api/chats/available-admins (for students)
export const getAvailableAdmins = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT 
                u.user_id,
                u.full_name,
                u.email,
                u.firebase_uid,
                CASE 
                    WHEN c.chat_id IS NOT NULL THEN c.chat_id
                    ELSE NULL
                END as existing_chat_id
            FROM users u
            LEFT JOIN chats c ON (
                (c.participant1 = u.user_id AND c.participant2 = $1)
                OR (c.participant1 = $1 AND c.participant2 = u.user_id)
            )
            WHERE u.role = 'admin' 
              AND u.status = 'active'
            ORDER BY u.full_name ASC;
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error("GET /available-admins Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};