# Shnoor LMS - Full Stack Setup Guide

This repository contains the source code for the **Shnoor Learning Management System (LMS)**. It is a full-stack application built with an Express.js backend and a React/Vite frontend.

## 📂 Project Structure

- **`backend-shnoor/`**: The backend server (Node.js/Express) handling APIs, Database connection, and Authentication verification.
- **`frontend-shnoor/`**: The frontend application (React + Vite) for Students, Instructors, and Admin portals.

---

## ✅ Prerequisites

Before you begin, ensure you have the following installed:

1.  **Node.js** (v18 or higher recommended) - [Download Here](https://nodejs.org/)
2.  **PostgreSQL** (Active database server) - [Download Here](https://www.postgresql.org/)
3.  **Git** - [Download Here](https://git-scm.com/)

You will also need:
- A **Firebase Project** for Authentication.
- A **PostgreSQL Database** created for this application (e.g., `shnoor_lms`).

---

## 🚀 Setting Up the Backend

1.  **Navigate to the backend directory:**
    ```bash
    cd backend-shnoor
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the `backend-shnoor` directory. Add the following keys (replace with your actual database details):

    ```env
    # Server Configuration
    PORT=5000

    # Database Configuration (PostgreSQL)
    DB_HOST=localhost
    DB_USER=postgres
    DB_PASSWORD=your_password
    DB_NAME=shnoor_lms
    DB_PORT=5432

    # Frontend URL (for CORS and file serving)
    VITE_API_URL=http://localhost:5000

    # Firebase Admin SDK (See Step 4)
    # If using environment variables for Firebase credentials, add them here.
    # Otherwise, you will need the service-key.json file.
    ```

4.  **Firebase Admin SDK Setup:**
    - Go to your Firebase Console -> Project Settings -> Service Accounts.
    - Click **"Generate new private key"**.
    - Rename the downloaded file to `service-key.json`.
    - Place this file inside the `backend-shnoor/` directory.

5.  **Run the Server:**
    ```bash
    npm run dev
    ```
    You should see: `✅ Server running on port 5000` and `✅ Database connected`.

---

## 🎨 Setting Up the Frontend

1.  **Navigate to the frontend directory:**
    ```bash
    cd ../frontend-shnoor
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the `frontend-shnoor` directory. You can find these values in your **Firebase Console -> Project Settings**.

    ```env
    VITE_API_URL=http://localhost:5000

    # Firebase Client Config
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET_ID=your_bucket.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    ```

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The application will typically start at `http://localhost:5173`.

---

## 💬 Real-Time Chat Setup

The LMS includes a **WhatsApp-like real-time chat system** with Socket.IO for instant messaging between students and instructors.

### Features
- ✅ Real-time messaging with Socket.IO
- ✅ Unread message badges and notifications
- ✅ Browser notifications (when tab is inactive)
- ✅ File attachments (images, documents)
- ✅ Message persistence in PostgreSQL
- ✅ Global notification system

### Database Schema

The chat system automatically initializes the required tables when the backend starts. The schema includes:

**`chats` Table:**
- `chat_id` (UUID, Primary Key)
- `instructor_id` (UUID, Foreign Key -> users)
- `student_id` (UUID, Foreign Key -> users)
- `created_at`, `updated_at` (Timestamps)

**`messages` Table:**
- `message_id` (UUID, Primary Key)
- `chat_id` (UUID, Foreign Key -> chats)
- `sender_id` (UUID, Foreign Key -> users)
- `receiver_id` (UUID, Foreign Key -> users)
- `text` (TEXT)
- `attachment_file_id` (INT, Foreign Key -> files, Optional)
- `attachment_type`, `attachment_name` (VARCHAR, Optional)
- `is_read` (BOOLEAN, Default: false)
- `created_at` (Timestamp)

**`files` Table:**
- `file_id` (SERIAL, Primary Key)
- `filename`, `mime_type` (TEXT)
- `data` (BYTEA - Binary data)
- `created_at` (Timestamp)

> **Note:** These tables are created automatically via `initChatTables()` in `backend-shnoor/controllers/chat.controller.js` when the server starts.

### Backend Configuration

The chat backend is already integrated into `backend-shnoor/app.js`:

1. **Socket.IO Server** runs on the same port as Express (5000)
2. **Chat Routes** are mounted at `/api/chats`
3. **File Upload** endpoint at `/api/chats/upload` (max 50MB)
4. **File Serving** endpoint at `/api/files/:id`

**Key Socket.IO Events:**
- `join_user` - User joins their personal notification room
- `join_chat` - User joins a specific chat room
- `send_message` - Send a message (emits `receive_message` and `new_notification`)
- `receive_message` - Incoming message for active chat
- `new_notification` - Global notification for new messages

### Frontend Setup

The chat UI is located in:
- **Student Chat:** `/student/chat` -> `frontend-shnoor/src/pages/student/StudentChat.jsx`
- **Instructor Chat:** `/instructor/chat` -> `frontend-shnoor/src/pages/instructor/InstructorChat.jsx`

**Socket Context:** `frontend-shnoor/src/context/SocketContext.jsx` manages:
- Socket.IO connection to backend
- Unread message counts
- Browser notification permissions
- Real-time notification handling

### Testing the Chat

1. **Start Both Servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend-shnoor
   npm run dev

   # Terminal 2 - Frontend
   cd frontend-shnoor
   npm run dev
   ```

2. **Open Two Browser Windows/Tabs:**
   - Window 1: Log in as **Instructor** -> Navigate to `/instructor/chat`
   - Window 2: Log in as **Student** -> Navigate to `/student/chat`

3. **Test Features:**
   - ✅ Send text messages between instructor and student
   - ✅ Upload and send files (images, PDFs, etc.)
   - ✅ Check unread badges appear on chat list
   - ✅ Test browser notifications (allow permissions when prompted)
   - ✅ Switch tabs to verify global notifications work
   - ✅ Open chat to mark messages as read

### Browser Notifications

On first use, the browser will request notification permissions. Click **"Allow"** to enable:
- Desktop notifications when tab is inactive/minimized
- Sound alerts for new messages (except active chat)
- Auto-dismiss after 5 seconds

### Troubleshooting Chat

**Messages not sending:**
- Check browser console for errors
- Verify Socket.IO connection: Look for `Socket Connected: <id>` in backend logs
- Ensure both users are logged in and have valid database user records

**Duplicate messages:**
- This should be fixed. If you see duplicates, check that `socket.broadcast.to()` is used (not `io.to()`)

**No notifications:**
- Check browser console for notification permission status
- Verify `new_notification` events in console logs
- Ensure sender and receiver are different users

**File upload fails:**
- Check file size (max 50MB)
- Verify `multer` is installed: `npm list multer` in backend-shnoor
- Check backend logs for upload errors

**Port conflicts (EADDRINUSE):**
- Kill existing Node processes:
  ```bash
  # Windows
  netstat -ano | findstr :5000
  taskkill /F /PID <process_id>
  
  # macOS/Linux
  lsof -ti:5000 | xargs kill -9
  ```

---

## 🛠️ Folder Structure Overview

```
final_lms/
├── backend-shnoor/       # Backend Logic
│   ├── app.js            # Entry Point + Socket.IO Setup
│   ├── config/           # Database & Firebase Config
│   ├── controllers/      # Route Logic (Admin, Student, Instructor, Chat)
│   │   └── chat.controller.js  # Chat API & Table Initialization
│   ├── routes/           # API Endpoint Definitions
│   ├── middlewares/      # Auth & User Attachment
│   ├── services/         # Business Logic
│   └── service-key.json  # (DO NOT COMMIT THIS)
│
├── frontend-shnoor/      # Frontend Client
│   ├── src/
│   │   ├── api/          # Axios Helper
│   │   ├── auth/         # Firebase Auth Context
│   │   ├── components/   # Reusable UI Components
│   │   │   └── chat/     # ChatList, ChatWindow
│   │   ├── context/      # SocketContext for real-time features
│   │   ├── pages/        # App Pages (Admin, Student, Instructor)
│   │   │   ├── student/StudentChat.jsx
│   │   │   └── instructor/InstructorChat.jsx
│   │   ├── styles/       # CSS including Chat.css
│   │   └── App.jsx       # Main Router
│   ├── public/           # Static Assets
│   └── vite.config.js    # Vite Configuration
│
├── .gitignore            # Git Ignore Rules
└── README.md             # This Documentation
```

## ⚠️ Common Issues

- **Database Connection Failed:** Check your `DB_PASSWORD` and ensure PostgreSQL service is running.
- **CORS Error:** Ensure the Backend is running on port 5000 and the `VITE_API_URL` in frontend `.env` matches.
- **Firebase Auth Error:** Ensure `service-key.json` is present in backend and client keys are correct in frontend `.env`.
- **Chat Tables Not Created:** Check backend console for `✅ Chat tables initialized successfully (UUIDs)` message.
- **Socket Connection Failed:** Ensure backend is running on port 5000 and Socket.IO is properly initialized.

---

## 🔐 Security Notes

- Never commit `service-key.json` or `.env` files
- Chat messages and files are stored in PostgreSQL
- User authentication is verified via Firebase Admin SDK
- File uploads are limited to 50MB per file
- All chat routes require authentication (`firebaseAuth` + `attachUser` middlewares)

---

**Happy Coding! 🚀**
