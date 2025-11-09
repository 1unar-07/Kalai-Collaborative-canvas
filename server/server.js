// bring express
const express = require("express");
// bring http
const http = require("http");
// bring socket io
const socketIO = require("socket.io");
// bring path for file path stuff
const path = require("path");

// ======== setup server stuff ========
// make app
const app = express();
// make http server for socket
const server = http.createServer(app);
// make io from socket io
const io = socketIO(server);
// port number default 3000
const PORT = process.env.PORT || 3000;
// serve static client files
app.use(express.static(path.join(__dirname, "../client")));

// ======== data storage ========
// store all connected users
const users = new Map();
// store all usernames for dup check
const usernames = new Set();
// store all draw actions
let drawingHistory = [];
// store undo redo stacks for every user
const userUndoStacks = new Map();
// store undone actions global
const undoneActions = new Map();

// ======== helper small functions ========
// random color pick for user
function generateUserColor() {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// make random user id
function generateUserId() {
  return "user_" + Math.random().toString(36).substr(2, 9);
}

// ======== socket connect stuff ========
io.on("connection", (socket) => {
  // log user joined
  console.log("new user connect", socket.id);
  // temp user obj
  const user = {
    id: generateUserId(),
    socketId: socket.id,
    name: null,
    color: generateUserColor(),
    cursorPosition: { x: 0, y: 0 },
  };
  // store user
  users.set(socket.id, user);
  // ask for username
  socket.emit("request-username");

  // ======== handle username submit ========
  socket.on("submit-username", (data) => {
    // get username clean
    const requestedUsername = (data.username || "").trim();
    // if empty send error
    if (!requestedUsername || requestedUsername.length === 0) {
      socket.emit("username-error", { message: "username empty" });
      return;
    }
    // if too long send error
    if (requestedUsername.length > 20) {
      socket.emit("username-error", { message: "too long max 20" });
      return;
    }
    // if already used send error
    if (usernames.has(requestedUsername.toLowerCase())) {
      socket.emit("username-error", { message: "username taken" });
      return;
    }
    // ok username good
    user.name = requestedUsername;
    // add to set
    usernames.add(requestedUsername.toLowerCase());
    // make undo stack if not exist
    if (!userUndoStacks.has(user.id)) {
      userUndoStacks.set(user.id, { actions: [], undone: [] });
    }
    // get user stack
    const userStack = userUndoStacks.get(user.id);
    // send init data to user
    socket.emit("init", {
      userId: user.id,
      color: user.color,
      username: user.name,
      drawingHistory: drawingHistory,
      undoneActions: Array.from(undoneActions.keys()),
      users: Array.from(users.values())
        .filter((u) => u.name !== null)
        .map((u) => ({
          id: u.id,
          name: u.name,
          color: u.color,
        })),
      canUndo: userStack.actions.length > 0,
      canRedo: userStack.undone.length > 0,
    });
    // tell others new user joined
    socket.broadcast.emit("user-joined", {
      id: user.id,
      name: user.name,
      color: user.color,
    });
    // log joined
    console.log("user joined", user.name);
  });

  // ======== draw event ========
  socket.on("draw", (data) => {
    // make draw object
    const drawingAction = {
      ...data,
      timestamp: Date.now(),
      actionId: generateUserId(),
      type: "draw",
    };
    // push to history
    drawingHistory.push(drawingAction);
    // get user id
    const userId = data.userId || drawingAction.userId;
    // if user not exist add stack
    if (!userUndoStacks.has(userId)) {
      userUndoStacks.set(userId, { actions: [], undone: [] });
    }
    // get user stack
    const userStack = userUndoStacks.get(userId);
    // clear redo stack
    userStack.undone = [];
    // push action to actions
    userStack.actions.push(drawingAction.actionId);
    // remove undone if same
    if (undoneActions.has(drawingAction.actionId)) {
      undoneActions.delete(drawingAction.actionId);
    }
    // send draw to others
    socket.broadcast.emit("draw", drawingAction);
    // update undo redo for user
    socket.emit("undo-redo-state", {
      canUndo: userStack.actions.length > 0,
      canRedo: false,
    });
  });

  // ======== cursor move event ========
  socket.on("cursor-move", (data) => {
    // get current user
    const currentUser = users.get(socket.id);
    // if exist update pos
    if (currentUser) {
      currentUser.cursorPosition = { x: data.x, y: data.y };
      // send to others
      socket.broadcast.emit("cursor-move", {
        userId: currentUser.id,
        x: data.x,
        y: data.y,
        color: currentUser.color,
      });
    }
  });

  // ======== clear canvas ========
  socket.on("clear-canvas", () => {
    // clear all drawings
    drawingHistory = [];
    // clear undo stacks
    userUndoStacks.clear();
    // clear undone actions
    undoneActions.clear();
    // tell all to clear
    io.emit("clear-canvas");
    // send all undo redo false
    io.emit("undo-redo-state", {
      canUndo: false,
      canRedo: false,
    });
  });

  // ======== undo event ========
  socket.on("undo", () => {
    // get user
    const currentUser = users.get(socket.id);
    if (!currentUser) return;
    const userId = currentUser.id;
    // if stack not exist make one
    if (!userUndoStacks.has(userId)) {
      userUndoStacks.set(userId, { actions: [], undone: [] });
    }
    // get stack
    const userStack = userUndoStacks.get(userId);
    // if no actions skip
    if (userStack.actions.length === 0) {
      socket.emit("undo-redo-state", {
        canUndo: false,
        canRedo: userStack.undone.length > 0,
      });
      return;
    }
    // get last action id
    const lastActionId = userStack.actions.pop();
    // push to undone stack
    userStack.undone.push(lastActionId);
    // add to global undone
    undoneActions.set(lastActionId, userId);
    // find in draw history
    const lastAction = drawingHistory.find((a) => a.actionId === lastActionId);
    // tell all action undone
    io.emit("action-undone", {
      actionId: lastActionId,
      userId: userId,
      userName: currentUser.name,
      message: currentUser.name + " undo",
    });
    // update undo redo buttons
    socket.emit("undo-redo-state", {
      canUndo: userStack.actions.length > 0,
      canRedo: userStack.undone.length > 0,
    });
  });

  // ======== ping check ========
  socket.on("ping-check", (callback) => {
    if (callback) callback();
  });

  // ======== redo event ========
  socket.on("redo", () => {
    // get user
    const currentUser = users.get(socket.id);
    if (!currentUser) return;
    const userId = currentUser.id;
    // make stack if not exist
    if (!userUndoStacks.has(userId)) {
      userUndoStacks.set(userId, { actions: [], undone: [] });
    }
    // get stack
    const userStack = userUndoStacks.get(userId);
    // if nothing undone skip
    if (userStack.undone.length === 0) {
      socket.emit("undo-redo-state", {
        canUndo: userStack.actions.length > 0,
        canRedo: false,
      });
      return;
    }
    // get last undone id
    const redoActionId = userStack.undone.pop();
    // push to actions
    userStack.actions.push(redoActionId);
    // remove from global undone
    undoneActions.delete(redoActionId);
    // find action
    const redoAction = drawingHistory.find((a) => a.actionId === redoActionId);
    // tell all action redone
    io.emit("action-redone", {
      actionId: redoActionId,
      userId: userId,
      userName: currentUser.name,
      message: currentUser.name + " redo",
    });
    // update buttons
    socket.emit("undo-redo-state", {
      canUndo: userStack.actions.length > 0,
      canRedo: userStack.undone.length > 0,
    });
  });

  // ======== handle disconnect ========
  socket.on("disconnect", () => {
    // log disconnected
    console.log("user left", socket.id);
    // get user
    const disconnectedUser = users.get(socket.id);
    // remove name from set
    if (disconnectedUser && disconnectedUser.name) {
      usernames.delete(disconnectedUser.name.toLowerCase());
    }
    // remove from users map
    users.delete(socket.id);
    // tell others user left
    if (disconnectedUser && disconnectedUser.name) {
      socket.broadcast.emit("user-left", {
        userId: disconnectedUser.id,
        name: disconnectedUser.name,
      });
    }
  });
});

// ======== start server ========
server.listen(PORT, () => {
  console.log(`
  collab canvas server running
  open http://localhost:${PORT}
  test multi tab
  `);
});
