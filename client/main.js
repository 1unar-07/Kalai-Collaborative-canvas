
document.addEventListener("DOMContentLoaded", () => {
  // wait till page fully loaded
  console.log("starting canvas collab app..."); // just log something cool in console

  // ======= initialize canvas n managers =======
  const canvas = document.getElementById("canvas"); // grab canvas from html
  const canvasManager = new CanvasManager(canvas); // create new manager to handle drawing

  // websocket manager if exists
  let wsManager = null; // keep in var
  if (typeof WebSocketManager !== "undefined") {
    // check if websocket script loaded
    wsManager = new WebSocketManager(canvasManager); // create websocket manager
    window.wsManager = wsManager; // store global so other code can use
  } else {
    console.warn(" no WebSocketManager, local mode only bro"); // warn user if offline mode
  }

  //tool buttons 
  const brushBtn = document.getElementById("brush-btn"); // brush button
  const eraserBtn = document.getElementById("eraser-btn"); // eraser button

  // switch tools logic
  const activateTool = (tool) => {
    canvasManager.setTool(tool); // set in canvas manager
    if (tool === "brush") {
      // if brush selected
      brushBtn.classList.add("active"); // highlight brush
      eraserBtn.classList.remove("active"); // unhighlight eraser
    } else {
      // else eraser tool
      eraserBtn.classList.add("active"); // highlight eraser
      brushBtn.classList.remove("active"); // unhighlight brush
    }
  };

  // listen for click on brush or eraser buttons
  brushBtn.addEventListener("click", () => activateTool("brush")); // brush click
  eraserBtn.addEventListener("click", () => activateTool("eraser")); // eraser click

  // color picker 
  const colorPicker = document.getElementById("color-picker"); // color input
  colorPicker.addEventListener("input", (e) => {
    // on color change
    canvasManager.setColor(e.target.value); // set new color in canvas
    activateTool("brush"); // always go back to brush after picking color
  });

  // ======= stroke width =======
  const strokeWidth = document.getElementById("stroke-width"); // range slider
  const widthDisplay = document.getElementById("width-display"); // span to show px

  strokeWidth.addEventListener("input", (e) => {
    // on slider change
    const width = parseInt(e.target.value); // get number value
    canvasManager.setStrokeWidth(width); // set it in manager
    widthDisplay.textContent = width + "px"; // show width text beside slider
  });

  // ======= action buttons =======
  const undoBtn = document.getElementById("undo-btn"); // undo button
  const redoBtn = document.getElementById("redo-btn"); // redo button
  const clearBtn = document.getElementById("clear-btn"); // clear button

  // update undo redo buttons state
  const updateActionButtons = () => {
    // if websocket not active just use local states
    if (!wsManager || !wsManager.socket?.connected) {
      undoBtn.disabled = canvasManager.localHistory.length === 0; // disable if no history
      redoBtn.disabled = canvasManager.undone.length === 0; // disable if nothing to redo
      undoBtn.classList.toggle("disabled", undoBtn.disabled); // toggle gray style
      redoBtn.classList.toggle("disabled", redoBtn.disabled); // toggle gray style
    }
    // if socket active websocket.js will manage states instead
  };

  // undo logic
  const performUndo = () => {
    const actionId = canvasManager.undo(); // do local undo for instant feedback
    if (actionId) {
      // if something undone
      updateActionButtons(); // update button states
      if (wsManager && wsManager.socket?.connected) {
        // if connected to server
        wsManager.undo(); // tell server to sync undo with all
      }
    }
  };

  // redo logic
  const performRedo = () => {
    const actionId = canvasManager.redo(); // do local redo right away
    if (actionId) {
      // if valid
      updateActionButtons(); // update ui
      if (wsManager && wsManager.socket?.connected) {
        // if online
        wsManager.redo(); // tell others too
      }
    }
  };

  // clear logic
  const performClear = () => {
    if (confirm("clear canvas for everyone?")) {
      // ask before wiping
      canvasManager.clear(); // clear locally now
      updateActionButtons(); // refresh buttons
      if (wsManager && wsManager.socket?.connected) {
        // if online
        wsManager.clearCanvas(); // broadcast clear
      }
    }
  };

  // attach buttons to handlers
  undoBtn.addEventListener("click", performUndo);
  redoBtn.addEventListener("click", performRedo);
  clearBtn.addEventListener("click", performClear);

  // ======= performance metrics =======
  const fpsDisplay = document.getElementById("fps-display"); // text element to show fps
  const latencyDisplay = document.getElementById("latency-display"); // text element for ping

  // fps setup
  let frameCount = 0; // count frames
  let lastTime = performance.now(); // store last time checked

  function updateFPS() {
    const now = performance.now(); // get current time
    frameCount++; // add one frame
    if (now - lastTime >= 1000) {
      // if one second passed
      fpsDisplay.textContent = `FPS: ${frameCount}`; // show fps count
      frameCount = 0; // reset frame counter
      lastTime = now; // reset timer
    }
    requestAnimationFrame(updateFPS); // loop again next frame
  }
  updateFPS(); // start fps loop

  // latency check if socket exists
  if (window.wsManager?.socket) {
    // check if connected
    setInterval(() => {
      // repeat every few sec
      const start = Date.now(); // note start time
      window.wsManager.socket.emit("ping-check", () => {
        // send ping to server
        const latency = Date.now() - start; // calc diff
        latencyDisplay.textContent = `Latency: ${latency} ms`; // show latency in ui
      });
    }, 2000); // run every 2s
  }

  // keyboard shortcuts 
  document.addEventListener("keydown", (e) => {
    // detect key press
    const ctrl = e.ctrlKey || e.metaKey; // detect ctrl or cmd key

    // ctrl + z -> undo
    if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      performUndo();
    }

    // ctrl + shift + z or ctrl + y -> redo
    if (
      (ctrl && e.key.toLowerCase() === "z" && e.shiftKey) ||
      (ctrl && e.key.toLowerCase() === "y")
    ) {
      e.preventDefault();
      performRedo();
    }

    // b -> brush, e -> eraser
    if (e.key.toLowerCase() === "b") activateTool("brush");
    if (e.key.toLowerCase() === "e") activateTool("eraser");
  });

  // warn if user tries to close tab with unsaved stuff
  window.addEventListener("beforeunload", (e) => {
    if (canvasManager.localHistory.length > 0) {
      // if drawn something
      e.preventDefault();
      e.returnValue = ""; // triggers confirm dialog
    }
  });

  // update button states regularly
  setInterval(updateActionButtons, 300); // every 300ms

  // done logs
  console.log("app ready draw away");
  console.log("open 2 tabs to test collab mode");
  console.log("ctrl+z undo | ctrl+shift+z redo | b brush | e eraser");
});
