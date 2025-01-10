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
    this.passwordTimer = null;
    this.PASSWORD_TIMEOUT = 30000; // 30 seconds
    this.resizeHandler = null;
  }

  startPasswordTimeout(onTimeout) {
    this.clearPasswordTimeout();
    this.passwordTimer = setTimeout(() => {
      if (this.awaitingPassword) {
        onTimeout();
      }
    }, this.PASSWORD_TIMEOUT);
  }

  clearPasswordTimeout() {
    if (this.passwordTimer) {
      clearTimeout(this.passwordTimer);
      this.passwordTimer = null;
    }
  }

  cleanup() {
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    this.clearPasswordTimeout();
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

  // Create taskbar element
  const taskbar = document.createElement("div");
  taskbar.className = "terminal-taskbar";
  taskbar.innerHTML = `<span class="terminal-icon">&gt;</span>Terminal`;
  document.body.appendChild(taskbar);

  taskbar.addEventListener("click", () => {
    terminal.restore();
    taskbar.classList.remove("active");
  });

  const closeTerminal = () => {
    // Remove all terminal classes
    terminal.elem.classList.remove("active", "minimized", "maximized");
    // Reset title
    document.title = blinkStates[0];
    // Clear the terminal container before cleanup
    terminal.elem.innerHTML = "";
    // Clean up state
    state.cleanup();
    // Remove taskbar
    taskbar.classList.remove("active");
    taskbar.style.display = "none";
  };

  const initializeTerminal = () => {
    // Initialize xterm.js
    state.term = new Terminal({
      cursorBlink: true,
      theme: {
        background: "rgba(0, 0, 0, 0.9)",
        foreground: "#0f0",
        cursor: "#0f0",
      },
      fontSize: 16,
      fontFamily: "monospace",
      scrollback: 1000,
    });

    // Initialize and load the fit addon
    state.fitAddon = new FitAddon.FitAddon();
    state.term.loadAddon(state.fitAddon);
  };

  // Initialize terminal first time
  initializeTerminal();

  const terminal = {
    elem: document.getElementById("secretTerminal"),

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
      state.term.write("\r\n$ ");
    },

    minimize: () => {
      terminal.elem.classList.add("minimized");
      taskbar.classList.add("active");
    },

    maximize: () => {
      terminal.elem.classList.remove("minimized");
      terminal.elem.classList.add("maximized");
      taskbar.classList.remove("active");
      state.fitAddon.fit();
    },

    restore: () => {
      terminal.elem.classList.remove("minimized");
      state.fitAddon.fit();
    },
  };

  const activateTerminal = () => {
    if (!state.active) {
      // Clean up any existing elements first
      terminal.elem.innerHTML = "";

      // Reset taskbar style
      taskbar.style.display = "";

      // Reinitialize terminal if needed
      if (!state.term) {
        initializeTerminal();
      }

      state.active = true;
      terminal.elem.classList.add("active");

      // Add title bar
      const titleBar = document.createElement("div");
      titleBar.className = "terminal-title";
      titleBar.innerHTML = `<span class="terminal-icon">&gt;</span>Terminal`;
      terminal.elem.appendChild(titleBar);

      // Add dragging functionality
      let isDragging = false;
      let offsetX;
      let offsetY;

      const dragStart = (e) => {
        if (terminal.elem.classList.contains("maximized")) return;

        if (e.target === titleBar || e.target.parentNode === titleBar) {
          const rect = terminal.elem.getBoundingClientRect();

          // Reset transform and set initial position
          terminal.elem.style.transform = "none";
          terminal.elem.style.left = `${rect.left}px`;
          terminal.elem.style.top = `${rect.top}px`;

          // Calculate offset from the cursor to the window corner
          offsetX = e.clientX - rect.left;
          offsetY = e.clientY - rect.top;

          isDragging = true;
          terminal.elem.classList.add("dragging");
        }
      };

      const dragEnd = () => {
        isDragging = false;
        terminal.elem.classList.remove("dragging");
      };

      const drag = (e) => {
        if (isDragging) {
          e.preventDefault();
          terminal.elem.style.left = `${e.clientX - offsetX}px`;
          terminal.elem.style.top = `${e.clientY - offsetY}px`;
        }
      };

      titleBar.addEventListener("mousedown", dragStart);
      document.addEventListener("mousemove", drag);
      document.addEventListener("mouseup", dragEnd);

      // Add terminal container
      const terminalContainer = document.createElement("div");
      terminalContainer.id = "terminal";
      terminal.elem.appendChild(terminalContainer);

      // Add window control buttons
      const controls = document.createElement("div");
      controls.className = "window-controls";
      controls.innerHTML = `
        <button class="window-button minimize" title="Minimize"></button>
        <button class="window-button maximize" title="Maximize"></button>
        <button class="window-button close" title="Close"></button>
      `;
      titleBar.appendChild(controls);

      // Add click handlers for window controls
      controls.querySelector(".close").addEventListener("click", closeTerminal);

      controls.querySelector(".minimize").addEventListener("click", () => {
        terminal.minimize();
      });

      controls.querySelector(".maximize").addEventListener("click", () => {
        if (terminal.elem.classList.contains("maximized")) {
          terminal.elem.classList.remove("maximized");
        } else {
          terminal.elem.classList.add("maximized");
        }
        state.fitAddon.fit();
      });

      state.term.open(document.getElementById("terminal"));
      state.term.clear();
      state.term.focus();

      // Fit terminal to container
      setTimeout(() => {
        state.fitAddon.fit();
      }, 0);

      terminal.print("=== RESTRICTED ACCESS TERMINAL ===");
      terminal.print("Type 'help' to see available commands");
      terminal.prompt();

      // Handle input
      state.term.onData((data) => {
        // Handle Ctrl+C
        if (data === "\x03") {
          state.term.write("^C");
          state.commandBuffer = "";
          state.cursorPosition = 0;
          if (state.awaitingPassword) {
            state.awaitingPassword = false;
            state.clearPasswordTimeout();
          }
          terminal.prompt();
          return;
        }

        if (state.awaitingPassword) {
          // Handle password input
          switch (data) {
            case "\r": // Enter
              state.term.writeln("");
              processCommand(state.commandBuffer);
              state.commandBuffer = "";
              state.cursorPosition = 0;
              document.title = title.text + title.prompt;
              break;
            case "\u007F": // Backspace
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
                document.title =
                  title.text +
                  title.prompt +
                  "*".repeat(state.commandBuffer.length);
              }
              break;
            case "\u001b[D": // Left arrow
              if (state.cursorPosition > 0) {
                state.cursorPosition--;
                state.term.write(data);
              }
              break;
            case "\u001b[C": // Right arrow
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
                document.title =
                  title.text +
                  title.prompt +
                  "*".repeat(state.commandBuffer.length);
              }
          }
        } else {
          // Handle normal input
          switch (data) {
            case "\r": // Enter
              if (state.commandBuffer.trim()) {
                state.term.writeln("");
                processCommand(state.commandBuffer.trim());
                if (!state.awaitingPassword) {
                  state.commandHistory.unshift(state.commandBuffer);
                  state.historyIndex = -1;
                }
                state.commandBuffer = "";
                state.cursorPosition = 0;
                document.title = title.text + title.prompt;
              } else {
                terminal.prompt();
              }
              break;
            case "\u007F": // Backspace
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
            case "\u001b[D": // Left arrow
              if (state.cursorPosition > 0) {
                state.cursorPosition--;
                state.term.write(data);
              }
              break;
            case "\u001b[C": // Right arrow
              if (state.cursorPosition < state.commandBuffer.length) {
                state.cursorPosition++;
                state.term.write(data);
              }
              break;
            case "\u001b[A": // Up arrow
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
            case "\u001b[B": // Down arrow
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
      state.startPasswordTimeout(() => {
        terminal.print("Password timeout. Session terminated.");
        closeTerminal();
      });
    },
  };

  const processCommand = async (cmd) => {
    if (state.awaitingPassword) {
      terminal.print("Verifying access...");
      try {
        // Load and attempt to decrypt the secret commands
        const response = await fetch("/secret-commands.js.enc");
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
        state.clearPasswordTimeout();
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
        state.clearPasswordTimeout();
        terminal.prompt();
      }
      return;
    }

    const [command, ...args] = cmd.trim().split(" ");
    const commandLower = command.toLowerCase();

    if (commandLower in commands) {
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
    } else {
      const baseTitle =
        title.text + title.prompt + (state.commandBuffer.trim() || "");
      document.title =
        document.title === baseTitle + title.cursor
          ? baseTitle
          : baseTitle + title.cursor;
    }
  }, blinkTime);
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

  const titleCheckInterval = setInterval(checkTitleChange, 100);
  state.addInterval(titleCheckInterval);

  // Add window resize handler
  const handleResize = () => {
    if (state.active) {
      state.fitAddon.fit();
    }
  };
  state.resizeHandler = handleResize;
  window.addEventListener("resize", handleResize);
});
