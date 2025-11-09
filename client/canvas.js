class CanvasManager {
  constructor(canvasElement) {
    // store canvas elem
    this.canvas = canvasElement;
    // get 2d context
    this.ctx = canvasElement.getContext("2d");
    // track if drawing
    this.isDrawing = false;
    // default tool brush
    this.currentTool = "brush";
    // default color black
    this.currentColor = "#000000";
    // default stroke width 3
    this.currentStrokeWidth = 3;
    // last x point
    this.lastX = 0;
    // last y point
    this.lastY = 0;
    // user id null start
    this.userId = null;
    // user color null start
    this.userColor = null;
    // all draw history
    this.fullHistory = [];
    // user own draw history
    this.localHistory = [];
    // undone stack
    this.undone = [];
    // global undone
    this.globalUndoneActions = new Set();
    // fps count
    this.frameCount = 0;
    // last frame time
    this.lastFrameTime = performance.now();
    // call init
    this.initCanvas();
    // call setup events
    this.setupEventListeners();
  }

  // init canvas
  initCanvas() {
    // resize first
    this.resizeCanvas(true);
    // round line
    this.ctx.lineCap = "round";
    // join round
    this.ctx.lineJoin = "round";
    // resize window fix
    window.addEventListener("resize", () => this.resizeCanvas());
    // start fps
    requestAnimationFrame(() => this.trackFPS());
  }

  // resize logic
  resizeCanvas(initial = false) {
    // temp store old img
    let imageData = null;
    // if not first time save old data
    if (!initial) {
      imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    }
    // get canvas size rect
    const rect = this.canvas.getBoundingClientRect();
    // get pixel ratio
    const dpr = window.devicePixelRatio || 1;
    // set width px
    this.canvas.width = rect.width * dpr;
    // set height px
    this.canvas.height = rect.height * dpr;
    // fix scale
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // round line again
    this.ctx.lineCap = "round";
    // join round again
    this.ctx.lineJoin = "round";
    // if image before redraw it
    if (imageData) {
      // make temp canvas
      const tmp = document.createElement("canvas");
      // width same
      tmp.width = imageData.width;
      // height same
      tmp.height = imageData.height;
      // put image back
      tmp.getContext("2d").putImageData(imageData, 0, 0);
      // draw back to new canvas
      this.ctx.drawImage(tmp, 0, 0, rect.width, rect.height);
    }
  }

  // setup all events
  setupEventListeners() {
    // mouse down start draw
    this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    // mouse move draw
    this.canvas.addEventListener("mousemove", (e) => this.draw(e));
    // mouse up stop draw
    window.addEventListener("mouseup", () => this.stopDrawing());
    // mouse out stop draw
    this.canvas.addEventListener("mouseout", () => this.stopDrawing());
    // touch start mobile
    this.canvas.addEventListener("touchstart", (e) => {
      // block scroll
      e.preventDefault();
      // get touch pos
      const touch = e.touches[0];
      // if got start draw
      if (touch) this.startDrawing(touch);
    });
    // touch move draw
    this.canvas.addEventListener("touchmove", (e) => {
      // block scroll
      e.preventDefault();
      // get touch
      const touch = e.touches[0];
      // if got draw
      if (touch) this.draw(touch);
    });
    // touch end stop
    this.canvas.addEventListener("touchend", (e) => {
      // block scroll
      e.preventDefault();
      // stop draw
      this.stopDrawing();
    });
    // touch cancel stop
    this.canvas.addEventListener("touchcancel", (e) => {
      // block scroll
      e.preventDefault();
      // stop draw
      this.stopDrawing();
    });
    // send cursor pos
    this.canvas.addEventListener("mousemove", (e) => {
      // if wsManager exist
      if (window.wsManager) {
        // get rect
        const rect = this.canvas.getBoundingClientRect();
        // calc x pos
        const x = e.clientX - rect.left;
        // calc y pos
        const y = e.clientY - rect.top;
        // send pos to server
        window.wsManager.sendCursorPosition(x, y);
      }
    });
    // stop gesture zoom
    this.canvas.addEventListener("gesturestart", (e) => e.preventDefault(), {
      passive: false,
    });
  }

  // get mouse pos on canvas
  getPosition(e) {
    // get rect
    const rect = this.canvas.getBoundingClientRect();
    // return pos obj
    return {
      x: (e.clientX || e.pageX) - rect.left,
      y: (e.clientY || e.pageY) - rect.top,
    };
  }

  // start draw
  startDrawing(e) {
    // set drawing true
    this.isDrawing = true;
    // get pos
    const pos = this.getPosition(e);
    // set last x
    this.lastX = pos.x;
    // set last y
    this.lastY = pos.y;
  }

  // draw when move
  draw(e) {
    // if not drawing stop
    if (!this.isDrawing) return;
    // get pos
    const pos = this.getPosition(e);
    // make action id
    const actionId = Date.now() + Math.random();
    // draw line
    this.drawLine(
      this.lastX,
      this.lastY,
      pos.x,
      pos.y,
      this.currentColor,
      this.currentStrokeWidth,
      this.currentTool,
      true,
      actionId
    );
    // send to server if socket
    if (window.wsManager) {
      window.wsManager.sendDrawing({
        x0: this.lastX,
        y0: this.lastY,
        x1: pos.x,
        y1: pos.y,
        color: this.currentColor,
        strokeWidth: this.currentStrokeWidth,
        tool: this.currentTool,
        actionId: actionId,
      });
    }
    // update last x
    this.lastX = pos.x;
    // update last y
    this.lastY = pos.y;
  }

  // stop draw
  stopDrawing() {
    // set drawing false
    this.isDrawing = false;
  }

  // draw one stroke
  drawLine(
    x0,
    y0,
    x1,
    y1,
    color,
    strokeWidth,
    tool = "brush",
    save = false,
    actionId = null
  ) {
    // start path
    this.ctx.beginPath();
    // move to start
    this.ctx.moveTo(x0, y0);
    // line to end
    this.ctx.lineTo(x1, y1);
    // if eraser use erase mode
    if (tool === "eraser") {
      // erase pixels
      this.ctx.globalCompositeOperation = "destination-out";
      // double width
      this.ctx.lineWidth = strokeWidth * 2;
      // color black transparent
      this.ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      // normal draw
      this.ctx.globalCompositeOperation = "source-over";
      // set line width
      this.ctx.lineWidth = strokeWidth;
      // set color
      this.ctx.strokeStyle = color;
    }
    // draw stroke
    this.ctx.stroke();
    // end path
    this.ctx.closePath();
    // reset mode
    this.ctx.globalCompositeOperation = "source-over";
    // save action if needed
    if (save) {
      // make action obj
      const action = {
        type: "draw",
        x0,
        y0,
        x1,
        y1,
        color,
        strokeWidth,
        tool,
        userId: this.userId,
        actionId: actionId || Date.now() + Math.random(),
      };
      // push full history
      this.fullHistory.push(action);
      // push local if user exist
      if (this.userId) {
        this.localHistory.push(action);
        // clear redo
        this.undone = [];
      }
    }
  }

  // draw remote data
  drawRemote(data) {
    // draw from socket
    this.drawLine(
      data.x0,
      data.y0,
      data.x1,
      data.y1,
      data.color,
      data.strokeWidth,
      data.tool,
      false
    );
    // make action obj
    const action = {
      type: "draw",
      x0: data.x0,
      y0: data.y0,
      x1: data.x1,
      y1: data.y1,
      color: data.color,
      strokeWidth: data.strokeWidth,
      tool: data.tool,
      userId: data.userId,
      actionId: data.actionId || Date.now() + Math.random(),
    };
    // push to history
    this.fullHistory.push(action);
  }

  // undo last
  undo() {
    // if no local skip
    if (this.localHistory.length === 0) return null;
    // get last
    const lastAction = this.localHistory.pop();
    // get id
    const actionId = lastAction.actionId;
    // if no id skip
    if (!actionId) return null;
    // add to undone global
    this.globalUndoneActions.add(actionId);
    // push to undone stack
    this.undone.push(lastAction);
    // redraw all
    this.redrawHistory();
    // return id
    return actionId;
  }

  // redo last undone
  redo() {
    // if no undone skip
    if (this.undone.length === 0) return null;
    // get last undone
    const redoAction = this.undone.pop();
    // get id
    const redoActionId = redoAction.actionId;
    // if no id skip
    if (!redoActionId) return null;
    // remove from global undone
    this.globalUndoneActions.delete(redoActionId);
    // push back to local
    this.localHistory.push(redoAction);
    // redraw all
    this.redrawHistory();
    // return id
    return redoActionId;
  }

  // clear canvas
  clear() {
    // get rect
    const rect = this.canvas.getBoundingClientRect();
    // wipe all
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    // empty lists
    this.fullHistory = [];
    this.localHistory = [];
    this.undone = [];
    this.globalUndoneActions.clear();
  }

  // rebuild draw
  redrawHistory(externalHistory = null, externalUndoneActions = null) {
    // get rect
    const rect = this.canvas.getBoundingClientRect();
    // clear screen
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    // if got history use it
    if (externalHistory) {
      this.fullHistory = externalHistory.map((a) => ({
        ...a,
        userId: a.userId || null,
      }));
      this.localHistory = this.fullHistory.filter(
        (a) => a.userId === this.userId
      );
    }
    // if got undone update it
    if (externalUndoneActions) {
      this.globalUndoneActions = new Set(externalUndoneActions);
    }
    // draw all not undone
    this.fullHistory.forEach((a) => {
      if (this.globalUndoneActions.has(a.actionId)) return;
      this.drawLine(
        a.x0,
        a.y0,
        a.x1,
        a.y1,
        a.color,
        a.strokeWidth,
        a.tool,
        false
      );
    });
  }

  // mark undone
  markActionUndone(actionId) {
    if (!this.globalUndoneActions.has(actionId)) {
      this.globalUndoneActions.add(actionId);
      this.redrawHistory();
    }
  }

  // mark redone
  markActionRedone(actionId) {
    if (this.globalUndoneActions.has(actionId)) {
      this.globalUndoneActions.delete(actionId);
      this.redrawHistory();
    }
  }

  // set tool brush eraser
  setTool(tool) {
    this.currentTool = tool;
    this.canvas.style.cursor = tool === "eraser" ? "grab" : "crosshair";
  }

  // set color
  setColor(color) {
    this.currentColor = color;
    this.currentTool = "brush";
  }

  // set stroke width
  setStrokeWidth(width) {
    this.currentStrokeWidth = width;
  }

  // set id user
  setUserId(id) {
    this.userId = id;
  }

  // set user color
  setUserColor(color) {
    this.userColor = color;
    this.currentColor = color;
  }

  // fps show
  trackFPS() {
    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      const fpsDisplay = document.getElementById("fps-display");
      if (fpsDisplay) fpsDisplay.textContent = `FPS: ${this.frameCount}`;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
    requestAnimationFrame(() => this.trackFPS());
  }
}

// export global
window.CanvasManager = CanvasManager;
