
class WebSocketManager {
  constructor(canvasManager) {
    this.canvasManager = canvasManager; // store canvasManager so we can call its methods later
    this.socket = null; // socket connection will go here after connecting
    this.userId = null; // unique id for current user assigned by server
    this.userColor = null; // color that server gives for this user
    this.users = new Map(); // map to hold all connected users
    this.remoteCursors = new Map(); // map to hold dom elements for other users cursors

    this.lastCursorSend = 0; // store last time cursor was sent to server
    this.cursorThrottle = 50; // only send cursor move every 50ms not every pixel move

    this.connect(); // call connect as soon as created
  }

  // method to connect to server
  connect() {
    this.socket = io(); // open socket.io connection
    this.setupEventListeners(); // setup all listeners for messages
  }

  // setup all socket events
  setupEventListeners() {
    // when connected to server successfully
    this.socket.on("connect", () => {
      console.log("Connected to server"); // log success
      this.updateConnectionStatus("connected"); // show status in ui
    });

    // when disconnected from server
    this.socket.on("disconnect", () => {
      console.log(" Disconnected from server"); // log error
      this.updateConnectionStatus("disconnected"); // update ui to red
    });

    // when server asks user to provide a username
    this.socket.on("request-username", () => {
      console.log(" Server requested username"); // log msg
      this.showUsernameModal(); // show popup input
    });

    // when server says username is invalid or already taken
    this.socket.on("username-error", (data) => {
      console.log(" Username error:", data.message); // print error
      this.showUsernameError(data.message); // show text in modal
    });

    // when server sends initial data after username accepted
    this.socket.on("init", (data) => {
      console.log(" Received initial data:", data); // log the info

      this.hideUsernameModal(); // close username popup
      this.userId = data.userId; // save my id
      this.userColor = data.color; // save my color

      this.canvasManager.setUserId(data.userId); // tell canvas who i am
      this.canvasManager.setUserColor(data.color); // set my color there too

      this.updateUsersList(data.users); // show list of all users in ui

      // draw whatever history exists on server
      if (data.drawingHistory) {
        this.canvasManager.redrawHistory(
          data.drawingHistory, // pass list of strokes
          data.undoneActions || [] // also undone strokes
        );
      }

      // server also can send undo redo button states
      if (data.canUndo !== undefined || data.canRedo !== undefined) {
        this.updateUndoRedoButtons(data.canUndo, data.canRedo); // update ui
      }
    });

    // when a new user joins
    this.socket.on("user-joined", (user) => {
      console.log(" User joined:", user.name); // log
      this.users.set(user.id, user); // add them to map
      this.updateUsersList(Array.from(this.users.values())); // refresh ui list
      this.showNotification(`${user.name} joined`, user.color); // small toast
    });

    // when user leaves
    this.socket.on("user-left", (data) => {
      console.log(" User left:", data.name); // log who left
      this.users.delete(data.userId); // remove them from map
      this.updateUsersList(Array.from(this.users.values())); // update ui
      this.removeCursor(data.userId); // remove their cursor from screen
      this.showNotification(`${data.name} left`, "#999"); // gray toast
    });

    // when server tells us another user drew something
    this.socket.on("draw", (data) => {
      this.canvasManager.drawRemote(data); // draw it locally
    });

    // when other user moves mouse so we see their cursor
    this.socket.on("cursor-move", (data) => {
      this.updateRemoteCursor(data.userId, data.x, data.y, data.color); // move their dot
    });

    // when someone clears whole canvas
    this.socket.on("clear-canvas", () => {
      this.canvasManager.clear(); // clear mine too
      this.showNotification("Canvas cleared", "#dc3545"); // red msg
    });

    // when someone undid an action
    this.socket.on("action-undone", (data) => {
      console.log(" Action undone:", data.actionId, "by", data.userName); // log who
      const isOurAction = data.userId === this.userId; // check if it was ours
      this.canvasManager.markActionUndone(data.actionId); // hide that stroke
      if (data.message && !isOurAction) {
        // if other user
        this.showNotification(data.message, "#007bff"); // show toast
      }
    });

    // when someone redid an action
    this.socket.on("action-redone", (data) => {
      console.log("Action redone:", data.actionId, "by", data.userName);
      const isOurAction = data.userId === this.userId; // was it us
      this.canvasManager.markActionRedone(data.actionId); // show stroke again
      if (data.message && !isOurAction) {
        this.showNotification(data.message, "#007bff");
      }
    });

    // when server updates undo redo state
    this.socket.on("undo-redo-state", (data) => {
      this.updateUndoRedoButtons(data.canUndo, data.canRedo); // refresh buttons
    });
  }

  // send draw info to server
  sendDrawing(data) {
    if (!this.socket || !this.socket.connected) return; // skip if not connected
    this.socket.emit("draw", { ...data, userId: this.userId }); // add our id and send
  }

  // send cursor position to server
  sendCursorPosition(x, y) {
    if (!this.socket || !this.socket.connected) return; // skip if offline
    const now = Date.now(); // get current time
    if (now - this.lastCursorSend < this.cursorThrottle) return; // too soon skip
    this.lastCursorSend = now; // store send time
    this.socket.emit("cursor-move", { x, y, userId: this.userId }); // send data
  }

  // ask server to clear everyone’s canvas
  clearCanvas() {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit("clear-canvas"); // emit event
  }

  // ask server to undo globally
  undo() {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit("undo"); // tell server undo
  }

  // ask server to redo globally
  redo() {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit("redo"); // tell server redo
  }

  // update status dot on top right
  updateConnectionStatus(status) {
    const statusElement = document.getElementById("connection-status"); // main div
    const statusText = document.getElementById("status-text"); // text inside
    statusElement.className = "status " + status; // add css class
    if (status === "connected")
      statusText.textContent = "Connected"; // show green text
    else if (status === "disconnected")
      statusText.textContent = "Disconnected"; // red
    else statusText.textContent = "Connecting..."; // default text
  }

  // update user list ui
  updateUsersList(users) {
    const usersList = document.getElementById("users-list"); // div
    usersList.innerHTML = ""; // clear current

    if (this.userId) {
      // add ourself first
      const badge = this.createUserBadge("You", this.userColor);
      badge.title = "You";
      usersList.appendChild(badge);
    }

    users.forEach((user) => {
      // add others
      if (user.id !== this.userId) {
        const badge = this.createUserBadge(user.name, user.color);
        badge.title = user.name;
        usersList.appendChild(badge);
      }
    });
  }

  // make little colored circle for user
  createUserBadge(name, color) {
    const badge = document.createElement("div"); // make div
    badge.className = "user-badge"; // add class
    badge.style.backgroundColor = color; // set color

    // figure out what to show inside (letter or number)
    const initial =
      name === "You"
        ? "Y"
        : name.match(/\d+/)
        ? name.match(/\d+/)[0]
        : name.charAt(0).toUpperCase();

    badge.textContent = initial; // set text
    return badge; // give back
  }

  // update cursor of other users
  updateRemoteCursor(userId, x, y, color) {
    const container = document.getElementById("cursors-container"); // parent div
    const user = this.users.get(userId); // get user data
    const userName = user?.name || `User-${userId.slice(-4)}`; // fallback name

    let cursor = this.remoteCursors.get(userId); // see if cursor already exists
    if (!cursor) {
      // if not, make new one
      cursor = document.createElement("div"); // make div
      cursor.className = "cursor-dot"; // add class
      cursor.style.backgroundColor = color; // set color

      const label = document.createElement("span"); // make label span
      label.className = "cursor-label"; // add class
      label.textContent = userName; // show name
      cursor.appendChild(label); // add label inside dot

      container.appendChild(cursor); // put in container
      this.remoteCursors.set(userId, cursor); // store in map
    }

    cursor.style.left = x + "px"; // set x
    cursor.style.top = y + "px"; // set y
    cursor.style.display = "block"; // show

    clearTimeout(cursor.hideTimer); // stop old timer
    cursor.hideTimer = setTimeout(() => {
      cursor.style.display = "none"; // hide if no move
    }, 2000);
  }

  // remove cursor when user leaves
  removeCursor(userId) {
    const cursor = this.remoteCursors.get(userId); // find their cursor
    if (cursor) {
      // if exists
      cursor.remove(); // delete from dom
      this.remoteCursors.delete(userId); // remove from map
    }
  }

  // update undo redo buttons based on what server says
  updateUndoRedoButtons(canUndo, canRedo) {
    const undoBtn = document.getElementById("undo-btn"); // get button
    const redoBtn = document.getElementById("redo-btn"); // get button

    if (undoBtn) {
      // if exists
      if (canUndo) {
        // enable
        undoBtn.disabled = false;
        undoBtn.classList.remove("disabled");
      } else {
        // disable
        undoBtn.disabled = true;
        undoBtn.classList.add("disabled");
      }
    }

    if (redoBtn) {
      if (canRedo) {
        // enable redo
        redoBtn.disabled = false;
        redoBtn.classList.remove("disabled");
      } else {
        // disable
        redoBtn.disabled = true;
        redoBtn.classList.add("disabled");
      }
    }
  }

  // simple notification just console log for now
  showNotification(message, color) {
    console.log(`${message}`); // later can make ui toast
  }

  // show modal asking for username
  showUsernameModal() {
    const modal = document.getElementById("username-modal"); // popup div
    const input = document.getElementById("username-input"); // text field
    const errorMessage = document.getElementById("username-error-message"); // error text
    const form = document.getElementById("username-form"); // form

    if (modal) {
      modal.classList.remove("hidden"); // show popup
      errorMessage.style.display = "none"; // hide error
      errorMessage.textContent = ""; // reset text
      input.value = ""; // clear old text

      setTimeout(() => input.focus(), 100); // focus after small delay

      if (form) {
        const handleSubmit = (e) => {
          e.preventDefault(); // stop reload
          const username = input.value.trim(); // get text
          if (username) this.submitUsername(username); // send to server
        };
        form.removeEventListener("submit", handleSubmit); // clean old
        form.addEventListener("submit", handleSubmit); // add new
      }
    }
  }

  // hide modal
  hideUsernameModal() {
    const modal = document.getElementById("username-modal"); // find it
    if (modal) modal.classList.add("hidden"); // hide it
  }

  // show error msg for invalid name
  showUsernameError(message) {
    const errorMessage = document.getElementById("username-error-message"); // msg element
    const input = document.getElementById("username-input"); // input field
    if (errorMessage) {
      errorMessage.textContent = message; // put text
      errorMessage.style.display = "block"; // show it
    }
    if (input) {
      input.focus(); // focus field
      input.select(); // select text for retyping
    }
  }

  // send name to server
  submitUsername(username) {
    if (!this.socket || !this.socket.connected) return; // skip if offline
    this.socket.emit("submit-username", { username: username }); // send
  }
}

// expose globally so other files can use
window.WebSocketManager = WebSocketManager;
