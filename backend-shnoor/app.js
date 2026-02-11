// app.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

// Database
import pool from "./db/postgres.js";
import { initChatTables, serveFile } from "./controllers/chat.controller.js";

// Routes (ES module imports)
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import coursesRoutes from "./routes/courses.routes.js";
import moduleRoutes from "./routes/module.routes.js";
import assignmentsRoutes from "./routes/assignments.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import studentCoursesRoutes from "./routes/studentCourses.routes.js";
import examRoutes from "./routes/exam.routes.js";
import studentExamRoutes from "./routes/studentExam.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import { router as groupRoutes } from "./routes/group.routes.js";

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// CORS allowed origins
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register all routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api", moduleRoutes);
app.use("/api/assignments", assignmentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentCoursesRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/student/exams", studentExamRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/groups", groupRoutes);

// File serving route
app.get("/api/files/:id", serveFile);

// Root route (for testing)
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).json({ message: "Internal server error" });
});
app.use((req, res, next) => {
  console.log(' ');
  console.log('GLOBAL REQUEST INCOMING:', {
    method: req.method,
    path: req.originalUrl,
    hasAuthHeader: !!req.headers.authorization
  });
  next();
});
// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const userSockets = new Map(); // Map<userId, socketId>

io.on("connection", (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  socket.on("join_user", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room user_${userId}`);
  });

  socket.on("join_chat", (chatId) => {
    socket.join(`chat_${chatId}`);
    console.log(`Socket ${socket.id} joined chat_${chatId}`);
  });

  socket.on("send_message", async (data) => {
  console.log("📨 send_message event received:", data);

  const {
    chatId,
    groupId,
    text,
    senderId,
    senderUid,
    senderName,
    recipientId,
    attachment_file_id,
    attachment_type,
    attachment_name,
  } = data;

  try {
    let savedMsg;

    if (groupId) {
      // ── GROUP MESSAGE ────────────────────────────────────────────────
      console.log(`[Socket] Processing GROUP message → groupId: ${groupId}`);

      if (!groupId) throw new Error("groupId is required for group messages");

      const result = await pool.query(
        `INSERT INTO group_messages 
         (group_id, sender_id, text, 
          attachment_file_id, attachment_type, attachment_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
         RETURNING *`,
        [
          groupId,
          senderId,
          text || null,
          attachment_file_id || null,
          attachment_type || null,
          attachment_name || null,
        ]
      );

      savedMsg = result.rows[0];

      // Broadcast to the entire group room
      io.to(`group_${groupId}`).emit("group_message", {
        ...savedMsg,
        sender_name: senderName,
        sender_uid: senderUid,
      });

      // Optional: update group last activity
      await pool.query(
        "UPDATE groups SET updated_at = NOW() WHERE group_id = $1",
        [groupId]
      );

      console.log(`✅ Group message saved in group_${groupId}`);
    } else {
      // ── 1-ON-1 MESSAGE ────────────────────────────────────────────────
      console.log(`[Socket] Processing 1-on-1 message → chatId: ${chatId}`);

      if (!chatId || !recipientId) {
        throw new Error("chatId and recipientId required for 1-on-1 message");
      }

      const result = await pool.query(
        `INSERT INTO messages 
         (chat_id, sender_id, receiver_id, text, 
          attachment_file_id, attachment_type, attachment_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
         RETURNING *`,
        [
          chatId,
          senderId,
          recipientId,
          text || null,
          attachment_file_id || null,
          attachment_type || null,
          attachment_name || null,
        ]
      );

      savedMsg = result.rows[0];

      // Broadcast to chat room (exclude sender)
      socket.broadcast.to(`chat_${chatId}`).emit("receive_message", {
        ...savedMsg,
        sender_name: senderName,
      });

      // Notification to recipient
      io.to(`user_${recipientId}`).emit("new_notification", {
        chat_id: chatId,
        sender_id: senderId,
        sender_name: senderName,
        text: text || "Sent a message",
        created_at: savedMsg.created_at,
      });

      await pool.query(
        "UPDATE chats SET updated_at = NOW() WHERE chat_id = $1",
        [chatId]
      );

      console.log(`✅ 1-on-1 message saved in chat_${chatId}`);
    }

    console.log("✅ Message handling complete");
  } catch (err) {
    console.error("❌ Socket Message Error:", err.message);
    console.error("Full error:", err);
    socket.emit("message_error", { error: err.message });
  }
});
  // ────────────────────────────────────────────────────────────────
  // ADD THIS → GROUP MESSAGE HANDLER
  // ────────────────────────────────────────────────────────────────
  socket.on('send_group_message', async (payload) => {
    console.log('[SOCKET] Received send_group_message from', socket.id);
    console.log('[SOCKET] Payload:', payload);

    const {
      groupId,
      text,
      senderId,
      senderName,
      attachment_file_id,
      attachment_type,
      attachment_name,
    } = payload;

    try {
      // 1. Validate required fields
      if (!groupId || !senderId) {
        throw new Error("groupId and senderId are required for group messages");
      }

      // 2. Optional: Check if sender is member of the group
      const membership = await pool.query(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, senderId]
      );

      if (membership.rows.length === 0) {
        // You can also check if sender is admin of the group
        const groupCheck = await pool.query(
          'SELECT admin_id FROM groups WHERE group_id = $1',
          [groupId]
        );
        if (groupCheck.rows[0]?.admin_id !== senderId) {
          throw new Error("Not a member of this group");
        }
      }

      // 3. Save message to database
      const result = await pool.query(
        `INSERT INTO group_messages 
         (group_id, sender_id, text, 
          attachment_file_id, attachment_type, attachment_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
         RETURNING *`,
        [
          groupId,
          senderId,
          text || null,
          attachment_file_id || null,
          attachment_type || null,
          attachment_name || null,
        ]
      );

      const savedMsg = result.rows[0];

      // 4. Enrich with sender name for display
      const broadcastMsg = {
        ...savedMsg,
        sender_name: senderName || 'Unknown',
      };

      // 5. Broadcast to ALL clients in the group room
      io.to(`group_${groupId}`).emit("group_message", broadcastMsg);

      console.log(`[SOCKET] Group message broadcasted to group_${groupId}`);

      // Optional: update group last activity
      await pool.query(
        "UPDATE groups SET updated_at = NOW() WHERE group_id = $1",
        [groupId]
      );
    } catch (err) {
      console.error("[SOCKET] Group message error:", err.message);
      socket.emit("message_error", { error: err.message });
    }
  });
  socket.on("disconnect", () => {
    console.log("Socket Disconnected");
  });
});

// Start server after DB connection
pool
  .query("SELECT NOW()")
  .then(async () => {
    console.log("✅ Database connected successfully");
    // After (only run once, or never in production)
if (process.env.NODE_ENV === 'development') {
  console.log("Development mode: running chat table init...");
  await initChatTables(); // or comment this line completely
} else {
  console.log("Production mode: skipping destructive initChatTables");
}

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    console.error("Please check your database credentials in .env");
    process.exit(1);
  });

// Handle unhandled rejections & exceptions
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});