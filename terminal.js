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

// Terminal configuration
let terminalActive = false;
let awaitingPassword = false;
let term = null;
let fitAddon = null;
let commandBuffer = "";
let cursorPosition = 0;
let commandHistory = [];
let historyIndex = -1;

document.addEventListener("DOMContentLoaded", () => {
  // Initialize xterm.js
  term = new Terminal({
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
  fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  const terminal = {
    elem: document.getElementById("secretTerminal"),

    print: (text) => {
      term.writeln(text);
    },

    clear: () => {
      term.clear();
      term.reset();
      term.write("\x1b[H"); // Move cursor to home position
      terminal.print("=== RESTRICTED ACCESS TERMINAL ===");
      terminal.print("Type 'help' to see available commands");
    },

    prompt: () => {
      term.write("\r\n$ ");
    },
  };

  const activateTerminal = () => {
    if (!terminalActive) {
      terminalActive = true;
      terminal.elem.classList.add("active");
      term.open(document.getElementById("terminal"));
      term.clear();
      term.focus();

      // Fit terminal to container
      setTimeout(() => {
        fitAddon.fit();
      }, 0);

      terminal.print("=== RESTRICTED ACCESS TERMINAL ===");
      terminal.print("Type 'help' to see available commands");
      terminal.prompt();

      // Handle input
      term.onData((data) => {
        if (awaitingPassword) {
          // Handle password input
          switch (data) {
            case "\r": // Enter
              term.writeln("");
              processCommand(commandBuffer);
              commandBuffer = "";
              cursorPosition = 0;
              document.title = title.text + title.prompt;
              break;
            case "\u007F": // Backspace
              if (commandBuffer.length > 0 && cursorPosition > 0) {
                const start = commandBuffer.slice(0, cursorPosition - 1);
                const end = commandBuffer.slice(cursorPosition);
                commandBuffer = start + end;
                cursorPosition--;
                term.write("\b \b");
                if (end.length > 0) {
                  term.write("*".repeat(end.length));
                  term.write(" ");
                  term.write("\b".repeat(end.length + 1));
                }
                document.title =
                  title.text + title.prompt + "*".repeat(commandBuffer.length);
              }
              break;
            case "\u001b[D": // Left arrow
              if (cursorPosition > 0) {
                cursorPosition--;
                term.write(data);
              }
              break;
            case "\u001b[C": // Right arrow
              if (cursorPosition < commandBuffer.length) {
                cursorPosition++;
                term.write(data);
              }
              break;
            default:
              if (data >= String.fromCharCode(32)) {
                const start = commandBuffer.slice(0, cursorPosition);
                const end = commandBuffer.slice(cursorPosition);
                commandBuffer = start + data + end;
                cursorPosition++;
                term.write("*");
                if (end.length > 0) {
                  term.write("*".repeat(end.length));
                  term.write("\b".repeat(end.length));
                }
                document.title =
                  title.text + title.prompt + "*".repeat(commandBuffer.length);
              }
          }
        } else {
          // Handle normal input
          switch (data) {
            case "\r": // Enter
              if (commandBuffer.trim()) {
                term.writeln("");
                processCommand(commandBuffer.trim());
                if (!awaitingPassword) {
                  commandHistory.unshift(commandBuffer);
                  historyIndex = -1;
                }
                commandBuffer = "";
                cursorPosition = 0;
                document.title = title.text + title.prompt;
              } else {
                terminal.prompt();
              }
              break;
            case "\u007F": // Backspace
              if (commandBuffer.length > 0 && cursorPosition > 0) {
                const start = commandBuffer.slice(0, cursorPosition - 1);
                const end = commandBuffer.slice(cursorPosition);
                commandBuffer = start + end;
                cursorPosition--;
                // Clear from cursor to end of line
                term.write("\b \b"); // Remove character at cursor
                if (end.length > 0) {
                  term.write(end); // Rewrite the rest of the line
                  term.write(" "); // Clear last character
                  // Move cursor back to position
                  term.write("\b".repeat(end.length + 1));
                }
                document.title = title.text + title.prompt + commandBuffer;
              }
              break;
            case "\u001b[D": // Left arrow
              if (cursorPosition > 0) {
                cursorPosition--;
                term.write(data);
              }
              break;
            case "\u001b[C": // Right arrow
              if (cursorPosition < commandBuffer.length) {
                cursorPosition++;
                term.write(data);
              }
              break;
            case "\u001b[A": // Up arrow
              if (
                !awaitingPassword &&
                historyIndex < commandHistory.length - 1
              ) {
                // Clear current line
                term.write("\r$ " + " ".repeat(commandBuffer.length) + "\r$ ");
                historyIndex++;
                commandBuffer = commandHistory[historyIndex];
                cursorPosition = commandBuffer.length;
                term.write(commandBuffer);
                document.title = title.text + title.prompt + commandBuffer;
              }
              break;
            case "\u001b[B": // Down arrow
              if (!awaitingPassword && historyIndex > -1) {
                // Clear current line
                term.write("\r$ " + " ".repeat(commandBuffer.length) + "\r$ ");
                historyIndex--;
                commandBuffer =
                  historyIndex >= 0 ? commandHistory[historyIndex] : "";
                cursorPosition = commandBuffer.length;
                term.write(commandBuffer);
                document.title = title.text + title.prompt + commandBuffer;
              }
              break;
            default:
              if (data >= String.fromCharCode(32)) {
                // Insert character at cursor position
                const start = commandBuffer.slice(0, cursorPosition);
                const end = commandBuffer.slice(cursorPosition);
                commandBuffer = start + data + end;
                cursorPosition++;
                term.write(data + end + "\b".repeat(end.length));
                document.title = title.text + title.prompt + commandBuffer;
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
    exit: () => {
      terminal.print("Closing terminal...");
      setTimeout(() => {
        terminal.clear();
        terminal.elem.classList.remove("active");
        terminalActive = false;
        awaitingPassword = false;
        document.title = blinkStates[0];
        term.dispose();
        term = null;
      }, 1000);
    },
    access: () => {
      awaitingPassword = true;
      terminal.print("Password required:");
    },
  };

  const processCommand = async (cmd) => {
    if (awaitingPassword) {
      terminal.print("Verifying access...");
      try {
        // Load and attempt to decrypt the secret commands
        const response = await fetch("/secret-commands.js.enc");
        if (!response.ok) {
          throw new Error(`Failed to load encrypted file: ${response.status}`);
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
        awaitingPassword = false;
        terminal.prompt();
      } catch (e) {
        terminal.print(`Error: ${e.message}`);
        terminal.print("Access denied.");
        terminal.print("Terminal shutting down...");
        setTimeout(() => {
          terminal.elem.classList.remove("active");
          terminalActive = false;
          awaitingPassword = false;
          document.title = blinkStates[0];
          term.dispose();
          term = null;
        }, 2000);
      }
      return;
    }

    const [command, ...args] = cmd.toLowerCase().trim().split(" ");

    if (command in commands) {
      commands[command](args);
      if (!awaitingPassword && command !== "exit") {
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
    if (!terminalActive) {
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
        title.text + title.prompt + (commandBuffer.trim() || "");
      document.title =
        document.title === baseTitle + title.cursor
          ? baseTitle
          : baseTitle + title.cursor;
    }
  }, blinkTime);

  // Direct title change check
  const checkTitleChange = () => {
    const currentTitle = document.title.toLowerCase().trim();
    if (
      !terminalActive &&
      !blinkStates.map((s) => s.toLowerCase().trim()).includes(currentTitle)
    ) {
      const command = currentTitle
        .replace(blinkStates[0].toLowerCase().trim(), "")
        .trim();
      activateTerminal();
      setTimeout(() => {
        term.write(`${command}\r\n`);
        processCommand(command);
      }, 100);
    }
  };

  // Check title changes frequently
  const titleCheckInterval = setInterval(checkTitleChange, 100);

  // Add window resize handler
  window.addEventListener("resize", () => {
    if (terminalActive) {
      fitAddon.fit();
    }
  });
});
