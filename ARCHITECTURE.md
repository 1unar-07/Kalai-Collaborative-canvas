# Architecture – Kalai Collaborative Canvas

This document explains how the Kalai collaborative drawing app works internally — including data flow, WebSocket communication, undo/redo logic, performance choices, and conflict resolution.

---
## 1. Technologies Used

### **Node.js**
Used to run the server-side JavaScript code.  
It handles HTTP requests, WebSocket connections, and manages all real-time interactions.

### **Express.js**
A lightweight Node.js framework used to serve static files (HTML, CSS, JS) and handle HTTP routes.

### **Socket.IO**
A WebSocket library that enables **real-time, bidirectional communication** between the server and clients.  
All drawing updates, cursor positions, and user actions use this for synchronization.

### **HTML5 Canvas**
The main drawing surface used by the client.  
Each user draws directly on the canvas using brush or eraser tools.

### **JavaScript (Client-Side)**
Controls the drawing logic, user interface, tool management, and communication with the server via WebSockets.

### **Files Overview**

| File | Description |
|------|--------------|
| `server/server.js` | The main backend file using **Node.js + Express + Socket.IO** to manage users, drawing actions, and synchronization. |
| `client/index.html` | The main frontend file defining the app layout (toolbar, canvas, etc.). |
| `client/style.css` | Handles the visual appearance of the app (toolbar, canvas layout, etc.). |
| `client/canvas.js` | Contains all logic for drawing on the canvas, handling tools, and local undo/redo. |
| `client/main.js` | Initializes the app, manages user input, buttons, and keyboard shortcuts. |
| `client/websocket.js` | Manages all WebSocket communication between the client and server. |

---


## 2. Data Flow Diagram

This shows how drawing data moves between users, the client, and the server.

User A (Browser) ──► Server (Node.js + Socket.IO) ──► User B (Browser)
│ │ │
│ emits 'draw' event │ │
│─────────────────────────►│ │
│ │ broadcasts 'draw' event │
│ ├────────────────────────────►│
│ │ │
│ ▼ │
│ All users update their canvas in real time │


**Flow Summary:**
1. A user draws a line on the canvas.
2. The client sends a `draw` event to the server using WebSocket.
3. The server saves the action and broadcasts it to all connected users.
4. Every user’s canvas updates immediately.
5. Undo, redo, and clear actions follow the same broadcast mechanism.

---

## 3. WebSocket Protocol

The app uses **Socket.IO** for real-time communication.  
Each message is an event with a small JSON payload.

| Event | Direction | Description | Example |
|-------|------------|-------------|----------|
| `request-username` | Server → Client | Ask for username | — |
| `submit-username` | Client → Server | Send chosen username | `{ "username": "Alice" }` |
| `init` | Server → Client | Send drawing history and user list | `{ "drawingHistory": [...], "users": [...] }` |
| `draw` | Client ↔ Server | Drawing action | `{ "x0": 10, "y0": 20, "x1": 30, "y1": 40, "color": "#000", "tool": "brush" }` |
| `cursor-move` | Client ↔ Server | Cursor position | `{ "x": 150, "y": 200 }` |
| `undo` / `redo` | Client → Server | Undo/redo requests | `{ "userId": "user_123" }` |
| `action-undone` / `action-redone` | Server → All | Notify all users | `{ "actionId": "...", "userId": "..." }` |
| `clear-canvas` | Client ↔ Server | Clear all drawings | — |
| `user-joined` / `user-left` | Server → All | User connection updates | `{ "name": "Bob", "color": "#FF6B6B" }` |

---

## 4. Undo/Redo Strategy

Each user can only undo or redo their own drawings.  
The server ensures all clients stay synchronized.

drawingHistory = [ all drawing actions ]
userUndoStacks = Map<userId, { actions: [], undone: [] }>
undoneActions = Map<actionId, userId>


### Process

- When a user draws → action is added to `drawingHistory` and their undo stack.  
- When they **undo** → last action moves to the `undone` list, and the server broadcasts an `action-undone` event so all clients hide that stroke.  
- When they **redo** → the action is restored and broadcast again to everyone.

Undo/Redo only affects that user’s actions, not others’.

---

## 5. Performance Decisions

To keep drawing smooth and responsive, several optimizations were used:

- **Local rendering first** — drawings appear instantly before server confirmation.  
- **Small event payloads** — only send line segments, not full image data.  
- **In-memory storage** — all drawings are stored in memory for speed (no database).  
- **Device pixel ratio scaling** — ensures crisp rendering on high-DPI displays.  
- **RequestAnimationFrame** — used for FPS tracking without blocking the main thread.  
- **Efficient event handling** — only active users trigger draw or cursor updates.

---

## 6. Conflict Resolution

Simultaneous drawings from multiple users are handled gracefully:

- Each drawing event is independent — new strokes simply layer over each other.  
- The canvas state is **eventually consistent** across all clients.  
- **Undo/redo** is scoped to each user’s actions.  
- If two users draw in the same place, both lines appear (no overwriting).  
- The server applies actions in the order they arrive to maintain fairness.

---

## Summary

- The **server** keeps the single source of truth (drawing history + user states).  
- **Clients** render locally but stay synchronized through WebSockets.  
- **Undo/redo** and **clear** actions are globally broadcast.  
- The app prioritizes **speed**, **simplicity**, and **low latency** for real-time collaboration.





