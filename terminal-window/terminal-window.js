// Constants
const CONSTANTS = {
  TIMEOUT: {
    TRANSITION: 100 * 1.5, // Animation transition time (0.1s + delay)
    TITLE_BLINK: 530, // Title blink interval
    COMMAND_EXEC: 100, // Command execution delay
  },
  KEYS: {
    CTRL_C: "\x03",
    ENTER: "\r",
    BACKSPACE: "\u007F",
    ARROW: {
      LEFT: "\u001b[D",
      RIGHT: "\u001b[C",
      UP: "\u001b[A",
      DOWN: "\u001b[B",
    },
  },
  TERMINAL: {
    FONT_SIZE: 16,
    FONT_FAMILY: "monospace",
    SCROLLBACK: 1000,
    THEME: {
      background: "rgba(0, 0, 0, 0.9)",
      foreground: "#0f0",
      cursor: "#0f0",
    },
  },
};

// Terminal state management
class TerminalState {
  constructor() {
    this.active = false;
    this.awaitingPassword = false;
    this.term = null;
    this.fitAddon = null;
    this.commandBuffer = "";
    this.cursorPosition = 0;
    this.commandHistory = [];
    this.historyIndex = -1;
    this.intervals = [];
    this.resizeHandler = null;
  }

  cleanup() {
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    if (this.term) {
      this.term.dispose();
      this.term = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    this.active = false;
    this.awaitingPassword = false;
    this.commandBuffer = "";
    this.cursorPosition = 0;
    this.commandHistory = [];
    this.historyIndex = -1;
  }

  addInterval(interval) {
    this.intervals.push(interval);
  }
}

const title = {
  text: document.title,
  prompt: " $ ",
  cursor: "_",
};

const blinkStates = [
  title.text + title.prompt,
  title.text + title.prompt + title.cursor,
];

const blinkTime = 530;
document.title = blinkStates[0];

document.addEventListener("DOMContentLoaded", () => {
  const state = new TerminalState();
  const ui = new TerminalUI(state);

  const terminal = {
    elem: ui.elem,
    print: (text) => {
      state.term.writeln(text);
    },
    clear: () => {
      state.term.clear();
      state.term.reset();
      state.term.write("\x1b[H"); // Move cursor to home position
      terminal.print("=== RESTRICTED ACCESS TERMINAL ===");
      terminal.print("Type 'help' to see available commands");
    },
    prompt: () => {
      document.title = title.text + title.prompt;
      state.term.write("\r\n$ ");
    },
    minimize: () => ui.minimize(),
    maximize: () => ui.maximize(),
    restore: () => ui.restore(),
  };

  const closeTerminal = () => ui.close();

  const initializeTerminal = () => {
    // Initialize xterm.js
    state.term = new Terminal({
      cursorBlink: true,
      theme: CONSTANTS.TERMINAL.THEME,
      fontSize: CONSTANTS.TERMINAL.FONT_SIZE,
      fontFamily: CONSTANTS.TERMINAL.FONT_FAMILY,
      scrollback: CONSTANTS.TERMINAL.SCROLLBACK,
    });

    // Initialize and load the fit addon
    state.fitAddon = new FitAddon.FitAddon();
    state.term.loadAddon(state.fitAddon);
  };

  const activateTerminal = () => {
    if (!state.active) {
      // Reset taskbar style
      ui.taskbar.style.display = "";

      // Reinitialize terminal if needed
      if (!state.term) {
        initializeTerminal();
      }

      state.active = true;
      ui.elem.classList.add("active");

      state.term.open(ui.content);
      state.term.clear();
      state.term.focus();

      // Fit terminal to container
      ui.handleResize();

      terminal.print("=== RESTRICTED ACCESS TERMINAL ===");
      terminal.print("Type 'help' to see available commands");
      terminal.prompt();

      // Handle input
      state.term.onData((data) => {
        // Handle Ctrl+C
        if (data === CONSTANTS.KEYS.CTRL_C) {
          state.term.write("^C");
          state.commandBuffer = "";
          state.cursorPosition = 0;
          if (state.awaitingPassword) {
            state.awaitingPassword = false;
          }
          terminal.prompt();
          return;
        }

        if (state.awaitingPassword) {
          // Handle password input
          switch (data) {
            case CONSTANTS.KEYS.ENTER: // Enter
              state.term.writeln("");
              processCommand(state.commandBuffer);
              state.commandBuffer = "";
              state.cursorPosition = 0;
              break;
            case CONSTANTS.KEYS.BACKSPACE: // Backspace
              if (state.commandBuffer.length > 0 && state.cursorPosition > 0) {
                const start = state.commandBuffer.slice(
                  0,
                  state.cursorPosition - 1
                );
                const end = state.commandBuffer.slice(state.cursorPosition);
                state.commandBuffer = start + end;
                state.cursorPosition--;
                state.term.write("\b \b");
                if (end.length > 0) {
                  state.term.write("*".repeat(end.length));
                  state.term.write(" ");
                  state.term.write("\b".repeat(end.length + 1));
                }
              }
              break;
            case CONSTANTS.KEYS.ARROW.LEFT: // Left arrow
              if (state.cursorPosition > 0) {
                state.cursorPosition--;
                state.term.write(data);
              }
              break;
            case CONSTANTS.KEYS.ARROW.RIGHT: // Right arrow
              if (state.cursorPosition < state.commandBuffer.length) {
                state.cursorPosition++;
                state.term.write(data);
              }
              break;
            default:
              if (data >= String.fromCharCode(32)) {
                const start = state.commandBuffer.slice(
                  0,
                  state.cursorPosition
                );
                const end = state.commandBuffer.slice(state.cursorPosition);
                state.commandBuffer = start + data + end;
                state.cursorPosition++;
                state.term.write("*");
                if (end.length > 0) {
                  state.term.write("*".repeat(end.length));
                  state.term.write("\b".repeat(end.length));
                }
              }
          }
        } else {
          // Handle normal input
          switch (data) {
            case CONSTANTS.KEYS.ENTER: // Enter
              if (state.commandBuffer.trim()) {
                state.term.writeln("");
                processCommand(state.commandBuffer.trim());
                if (!state.awaitingPassword) {
                  state.commandHistory.unshift(state.commandBuffer);
                  state.historyIndex = -1;
                }
                state.commandBuffer = "";
                state.cursorPosition = 0;
              } else {
                terminal.prompt();
              }
              break;
            case CONSTANTS.KEYS.BACKSPACE: // Backspace
              if (state.commandBuffer.length > 0 && state.cursorPosition > 0) {
                const start = state.commandBuffer.slice(
                  0,
                  state.cursorPosition - 1
                );
                const end = state.commandBuffer.slice(state.cursorPosition);
                state.commandBuffer = start + end;
                state.cursorPosition--;
                // Clear from cursor to end of line
                state.term.write("\b \b"); // Remove character at cursor
                if (end.length > 0) {
                  state.term.write(end); // Rewrite the rest of the line
                  state.term.write(" "); // Clear last character
                  // Move cursor back to position
                  state.term.write("\b".repeat(end.length + 1));
                }
                document.title =
                  title.text + title.prompt + state.commandBuffer;
              }
              break;
            case CONSTANTS.KEYS.ARROW.LEFT: // Left arrow
              if (state.cursorPosition > 0) {
                state.cursorPosition--;
                state.term.write(data);
              }
              break;
            case CONSTANTS.KEYS.ARROW.RIGHT: // Right arrow
              if (state.cursorPosition < state.commandBuffer.length) {
                state.cursorPosition++;
                state.term.write(data);
              }
              break;
            case CONSTANTS.KEYS.ARROW.UP: // Up arrow
              if (
                !state.awaitingPassword &&
                state.historyIndex < state.commandHistory.length - 1
              ) {
                // Clear current line
                state.term.write(
                  "\r$ " + " ".repeat(state.commandBuffer.length) + "\r$ "
                );
                state.historyIndex++;
                state.commandBuffer = state.commandHistory[state.historyIndex];
                state.cursorPosition = state.commandBuffer.length;
                state.term.write(state.commandBuffer);
                document.title =
                  title.text + title.prompt + state.commandBuffer;
              }
              break;
            case CONSTANTS.KEYS.ARROW.DOWN: // Down arrow
              if (!state.awaitingPassword && state.historyIndex > -1) {
                // Clear current line
                state.term.write(
                  "\r$ " + " ".repeat(state.commandBuffer.length) + "\r$ "
                );
                state.historyIndex--;
                state.commandBuffer =
                  state.historyIndex >= 0
                    ? state.commandHistory[state.historyIndex]
                    : "";
                state.cursorPosition = state.commandBuffer.length;
                state.term.write(state.commandBuffer);
                document.title =
                  title.text + title.prompt + state.commandBuffer;
              }
              break;
            default:
              if (data >= String.fromCharCode(32)) {
                // Insert character at cursor position
                const start = state.commandBuffer.slice(
                  0,
                  state.cursorPosition
                );
                const end = state.commandBuffer.slice(state.cursorPosition);
                state.commandBuffer = start + data + end;
                state.cursorPosition++;
                state.term.write(data + end + "\b".repeat(end.length));
                document.title =
                  title.text + title.prompt + state.commandBuffer;
              }
          }
        }
      });
    }
  };

  // Make activateTerminal available globally
  window.activateTerminal = activateTerminal;

  const commands = {
    help: () => {
      terminal.print("Available commands:");
      terminal.print("  help     - Show this help message");
      terminal.print("  clear    - Clear terminal screen");
      terminal.print("  exit     - Close terminal");
      terminal.print("  access   - Request access to restricted area");
    },
    clear: () => {
      terminal.clear();
    },
    exit: closeTerminal,
    access: () => {
      state.awaitingPassword = true;
      terminal.print("Password required:");
    },
  };

  const processCommand = async (cmd) => {
    if (state.awaitingPassword) {
      terminal.print("Verifying access...");
      try {
        // Load and attempt to decrypt the secret commands
        const response = await fetch("/terminal-window/secret-commands.js.enc");
        if (!response.ok) {
          throw new Error(
            `Network error: Failed to load encrypted file (${response.status})`
          );
        }
        const encryptedData = await response.arrayBuffer();

        // Extract components (32B salt + 16B IV + encrypted + 16B tag)
        const salt = new Uint8Array(encryptedData.slice(0, 32));
        const iv = new Uint8Array(encryptedData.slice(32, 48));
        const authTag = new Uint8Array(encryptedData.slice(-16));
        const encrypted = new Uint8Array(encryptedData.slice(48, -16));

        terminal.print(
          `Loaded ${encryptedData.byteLength} bytes of encrypted data`
        );

        // Import password for key derivation
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          encoder.encode(cmd),
          { name: "PBKDF2" },
          false,
          ["deriveBits", "deriveKey"]
        );

        // Derive key using SHA-512 and 1 million iterations
        const key = await crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: salt,
            iterations: 1000000,
            hash: "SHA-512",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          true,
          ["decrypt"]
        );

        // Decrypt the commands
        const decrypted = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv, tagLength: 128 },
          key,
          new Uint8Array([...encrypted, ...authTag])
        );

        const decodedText = new TextDecoder().decode(decrypted);

        // If we get here, decryption was successful
        terminal.print("Access granted...");

        // Execute the decrypted code in a secure context
        const secureExec = new Function("terminal", "commands", decodedText);
        secureExec(terminal, commands);

        terminal.print("Type 'help' to see available commands");
        state.awaitingPassword = false;
        terminal.prompt();
      } catch (e) {
        let errorMessage = "Access denied: ";
        if (e.message.includes("Network error")) {
          errorMessage += "Could not load secret commands";
        } else if (e.name === "OperationError") {
          errorMessage += "Invalid password";
        } else {
          errorMessage += "Unknown error occurred";
        }
        terminal.print(errorMessage);
        state.awaitingPassword = false;
        terminal.prompt();
      }
      return;
    }

    const [command, ...args] = cmd.trim().split(" ");
    const commandLower = command.toLowerCase();

    if (commandLower in commands) {
      document.title = title.text + title.prompt + commandLower;
      commands[commandLower](args);
      if (!state.awaitingPassword && commandLower !== "exit") {
        terminal.prompt();
      }
    } else {
      terminal.print(`Command not found: ${command}`);
      terminal.print("Type 'help' for available commands");
      terminal.prompt();
    }
  };

  // Title blink effect
  const blinkInterval = setInterval(() => {
    if (!state.active) {
      const currentTitle = document.title.toLowerCase().trim();
      if (
        blinkStates.map((s) => s.toLowerCase().trim()).includes(currentTitle)
      ) {
        document.title = currentTitle.endsWith(title.prompt.trim())
          ? blinkStates[1]
          : blinkStates[0];
      }
    } else if (!state.awaitingPassword) {
      const baseTitle =
        title.text + title.prompt + (state.commandBuffer.trim() || "");
      document.title =
        document.title === baseTitle + title.cursor
          ? baseTitle
          : baseTitle + title.cursor;
    }
  }, CONSTANTS.TIMEOUT.TITLE_BLINK);
  state.addInterval(blinkInterval);

  // Direct title change check
  const checkTitleChange = () => {
    const currentTitle = document.title.toLowerCase().trim();
    if (
      !state.active &&
      !blinkStates.map((s) => s.toLowerCase().trim()).includes(currentTitle)
    ) {
      const command = currentTitle
        .replace(blinkStates[0].toLowerCase().trim(), "")
        .trim();
      activateTerminal();
      setTimeout(() => {
        state.term.write(`${command}\r\n`);
        processCommand(command);
      }, 100);
    }
  };

  const titleCheckInterval = setInterval(
    checkTitleChange,
    CONSTANTS.TIMEOUT.COMMAND_EXEC
  );
  state.addInterval(titleCheckInterval);
});

class TerminalUI {
  constructor(state) {
    this.state = state;
    this.elem = document.getElementById("terminal-window");
    this.taskbar = document.getElementById("terminal-taskbar");
    this.titleBar = this.elem.querySelector(".window-title");
    this.controls = this.titleBar.querySelector(".window-controls");
    this.content = document.getElementById("terminal-content");

    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;

    // Bind methods
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleDrag = this.handleDrag.bind(this);
    this.handleDragEnd = this.handleDragEnd.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Window controls
    this.controls
      .querySelector(".close")
      .addEventListener("click", () => this.close());
    this.controls
      .querySelector(".minimize")
      .addEventListener("click", () => this.minimize());
    this.controls
      .querySelector(".maximize")
      .addEventListener("click", () => this.toggleMaximize());

    // Dragging
    this.titleBar.addEventListener("mousedown", this.handleDragStart);
    document.addEventListener("mousemove", this.handleDrag);
    document.addEventListener("mouseup", this.handleDragEnd);

    // Resize
    window.addEventListener("resize", this.handleResize);

    // Taskbar
    this.taskbar.addEventListener("click", () => {
      this.restore();
      this.taskbar.classList.remove("active");
    });
  }

  handleDragStart(e) {
    if (this.elem.classList.contains("maximized")) return;

    if (e.target === this.titleBar || e.target.parentNode === this.titleBar) {
      const rect = this.elem.getBoundingClientRect();

      this.elem.style.transform = "none";
      this.elem.style.left = `${rect.left}px`;
      this.elem.style.top = `${rect.top}px`;

      this.offsetX = e.clientX - rect.left;
      this.offsetY = e.clientY - rect.top;

      this.isDragging = true;
      this.elem.classList.add("dragging");
    }
  }

  handleDrag(e) {
    if (this.isDragging) {
      e.preventDefault();
      this.elem.style.left = `${e.clientX - this.offsetX}px`;
      this.elem.style.top = `${e.clientY - this.offsetY}px`;
    }
  }

  handleDragEnd() {
    this.isDragging = false;
    this.elem.classList.remove("dragging");
  }

  handleResize() {
    if (this.state.active) {
      setTimeout(() => {
        this.state.fitAddon.fit();
      }, CONSTANTS.TIMEOUT.TRANSITION);
    }
  }

  close() {
    this.elem.classList.remove("active", "minimized", "maximized");
    document.title = blinkStates[0];
    this.state.cleanup();
    this.taskbar.classList.remove("active");
    this.taskbar.style.display = "none";
  }

  minimize() {
    this.elem.classList.add("minimized");
    this.taskbar.classList.add("active");
  }

  maximize() {
    this.elem.classList.remove("minimized");
    this.elem.classList.add("maximized");
    this.taskbar.classList.remove("active");
    this.handleResize();
  }

  restore() {
    this.elem.classList.remove("minimized");
    this.handleResize();
  }

  toggleMaximize() {
    if (this.elem.classList.contains("maximized")) {
      this.elem.classList.remove("maximized");
      this.elem.style.transform = "translate(-50%, -50%)";
      this.elem.style.left = "50%";
      this.elem.style.top = "50%";
    } else {
      this.elem.classList.add("maximized");
      this.elem.style.transform = "none";
      this.elem.style.left = "0";
      this.elem.style.top = "0";
    }
    this.handleResize();
  }
}
