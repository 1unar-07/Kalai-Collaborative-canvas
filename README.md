# Kalai

A real-time collaborative drawing canvas where multiple users can draw simultaneously on the same HTML5 canvas, see each other's drawings, cursor positions, and actions instantly — powered by WebSockets.

##  Features

- **Real-time Collaboration**: Multiple users can draw simultaneously on the same canvas
- **Live Cursor Tracking**: See where other users are pointing their cursors in real-time
- **Synchronized Drawing**: All drawing actions are instantly synchronized across all connected clients
- **Drawing Tools**:
  - ✏️ Brush tool with customizable color and stroke width
  - 🧹 Eraser tool
  - 🎨 Color picker
  - 📏 Adjustable brush size (1-20px)
- **Action History**:
  - ↶ Undo (Ctrl+Z / Cmd+Z)
  - ↷ Redo (Ctrl+Shift+Z / Cmd+Shift+Z)
  - 🗑️ Clear canvas
- **User Presence**: See who's currently connected with color-coded user badges
- **Connection Status**: Visual indicator showing connection state
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Touch Support**: Full touch event support for mobile devices

##  Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone or download this repository
2. Install dependencies:

```bash
npm install
```

### Running the Application

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in the `PORT` environment variable).

### Testing Collaboration

1. Open `http://localhost:3000` in your browser
2. Open the same URL in another browser tab or window (or on another device on the same network)
3. Start drawing! You should see:
   - Your drawings appear on all connected clients
   - Other users' cursors moving in real-time
   - User badges showing who's connected
   - Connection status indicator

##  Usage

### Keyboard Shortcuts

- **B** - Switch to Brush tool
- **E** - Switch to Eraser tool
- **Ctrl/Cmd + Z** - Undo last action
- **Ctrl/Cmd + Shift + Z** - Redo last undone action
- **Ctrl/Cmd + Y** - Redo (alternative)

### Drawing

1. Select a tool (Brush or Eraser)
2. Choose a color using the color picker
3. Adjust brush size with the slider
4. Click and drag on the canvas to draw
5. Your drawings will appear instantly for all connected users

### Collaboration

- Each user gets a unique color assigned automatically
- User badges show who's currently connected
- Cursor positions are tracked and displayed for all users
- All drawing actions are synchronized in real-time

##  Architecture

### Client-Side (`/client`)

- **`index.html`** - Main HTML structure
- **`style.css`** - Styling and responsive design
- **`main.js`** - Application initialization and UI event handlers
- **`canvas.js`** - Canvas drawing logic and drawing operations
- **`websocket.js`** - WebSocket communication and real-time synchronization

### Server-Side (`/server`)

- **`server.js`** - Express server, Socket.io WebSocket handling, and drawing state management

### How It Works

1. **Connection**: When a user connects, the server assigns them a unique ID and color
2. **Initialization**: New users receive the complete drawing history to sync their canvas
3. **Drawing Events**: Each drawing action is sent to the server via WebSocket
4. **Broadcasting**: The server broadcasts drawing events to all other connected clients
5. **Cursor Tracking**: Cursor movements are throttled and broadcast to show other users' positions
6. **State Management**: The server maintains a complete history of all drawing actions for undo/redo functionality


**How to Test with Multiple Users**

Run the server with npm start.

Open one browser tab at http://localhost:3000.

Open another tab or a different browser window with the same URL.

Enter different usernames in both.

Start drawing. The drawings should appear in real-time on all connected screens.

**Known Limitations / Bugs**

Username duplication may occur if two users enter the same name at the exact same time.

Canvas can stretch slightly when resizing on some high-DPI displays.

Undo/Redo synchronization may feel delayed under slow network conditions.

The app does not persist data; drawings are lost when the server restarts.

Performance may be slow on older mobile devices.

##  Dependencies

### Production

- **express** - Web server framework
- **socket.io** - WebSocket library for real-time communication

### Development

- **nodemon** - Auto-reload server during development

##  Configuration

The server runs on port `3000` by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

##  Network Access

To access the canvas from other devices on your network:

1. Find your local IP address:
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig` or `ip addr`
2. Access from other devices: `http://YOUR_IP:3000`

##  Customization

### Changing Default Colors

Edit the `generateUserColor()` function in `server/server.js` to customize the color palette for new users.

### Canvas Size

The canvas automatically resizes to fill the available space. You can modify the CSS in `client/style.css` to set a fixed size.

##  Troubleshooting

### Canvas not drawing

- Check browser console for errors
- Verify WebSocket connection (check connection status indicator)
- Ensure JavaScript is enabled

### Drawings not syncing

- Check that the server is running
- Verify WebSocket connection status
- Check browser console for connection errors

### Cursor positions not showing

- Cursors are hidden after 2 seconds of inactivity
- Move your mouse to see cursor updates
- Check that other users are connected

### Time spent 

| Task                                    | Approximate Time |
| --------------------------------------- | ---------------- |
| Setting up Node.js + Socket.IO server   | ~2 hours         |
| Implementing real-time drawing and sync | ~3 hours         |
| Adding undo/redo and global clear       | ~2 hours         |
| UI and color/tool controls              | ~1.5 hours       |
| Testing and debugging multi-user sync   | ~1.5 hours       |
| **Total**                               | **~10 hours**    |


##  Future Enhancements

Potential features to add:

- [ ] Multiple rooms/canvases
- [ ] Drawing shapes (rectangles, circles, lines)
- [ ] Text tool
- [ ] Image upload/export
- [ ] Drawing persistence (save/load)
- [ ] User names (customizable)
- [ ] Chat functionality
- [ ] Drawing permissions/roles

---


