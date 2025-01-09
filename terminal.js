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

document.addEventListener("DOMContentLoaded", () => {
  // Command history
  let commandHistory = [];
  let historyIndex = -1;

  const terminal = {
    elem: document.getElementById("secretTerminal"),
    input: document.getElementById("terminalInput"),
    output: document.getElementById("terminalOutput"),

    print: (text) => {
      terminal.output.innerHTML =
        `<div>${text}</div>` + terminal.output.innerHTML;
      terminal.scrollToBottom();
    },

    clear: () => {
      terminal.output.innerHTML = "";
    },

    scrollToBottom: () => {
      terminal.output.scrollTop = terminal.output.scrollHeight;
    },
  };

  const activateTerminal = () => {
    terminalActive = true;
    terminal.elem.classList.add("active");
    terminal.clear();
    terminal.print("=== RESTRICTED ACCESS TERMINAL ===");
    terminal.print("Type 'help' to see available commands");
    terminal.input.focus();
    terminal.scrollToBottom();
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
        terminal.input.classList.remove("password");
        document.title = blinkStates[0];
      }, 1000);
    },
    access: () => {
      awaitingPassword = true;
      terminal.print("Password required:");
    },
  };

  const processCommand = async (cmd) => {
    if (awaitingPassword) {
      terminal.input.classList.add("password");
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
        terminal.input.classList.remove("password");
      } catch (e) {
        terminal.print(`Error: ${e.message}`);
        terminal.print("Access denied.");
        terminal.print("Terminal shutting down...");
        setTimeout(() => {
          terminal.elem.classList.remove("active");
          terminalActive = false;
          awaitingPassword = false;
          terminal.input.classList.remove("password");
          document.title = blinkStates[0];
        }, 2000);
      }
      return;
    }

    const [command, ...args] = cmd.toLowerCase().trim().split(" ");

    if (command in commands) {
      commands[command](args);
    } else {
      terminal.print(`Command not found: ${command}`);
      terminal.print("Type 'help' for available commands");
    }
  };

  // Handle command history navigation
  terminal.input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        terminal.input.value = commandHistory[historyIndex];
        // Move cursor to end of input
        setTimeout(() => {
          terminal.input.selectionStart = terminal.input.selectionEnd =
            terminal.input.value.length;
        }, 0);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > -1) {
        historyIndex--;
        terminal.input.value =
          historyIndex >= 0 ? commandHistory[historyIndex] : "";
        // Move cursor to end of input
        setTimeout(() => {
          terminal.input.selectionStart = terminal.input.selectionEnd =
            terminal.input.value.length;
        }, 0);
      }
    }
  });

  terminal.input.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
      const cmd = terminal.input.value.trim();
      if (cmd) {
        // Only add non-empty commands to history
        if (!awaitingPassword) {
          commandHistory.unshift(cmd); // Add to start of array
          historyIndex = -1; // Reset history index
          terminal.print(`\n$ ${cmd}`);
        } else {
          terminal.print(`${"*".repeat(cmd.length)}`);
        }
      }
      await processCommand(cmd);
      terminal.input.value = "";
      document.title = title.text + title.prompt;
    }
  });

  // Update title while typing and scroll to bottom
  terminal.input.addEventListener("input", (e) => {
    if (terminalActive) {
      const currentInput = terminal.input.value.trim();
      document.title = title.text + title.prompt + currentInput;
      terminal.scrollToBottom();
    }
  });

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
      // When terminal is active, blink cursor at the end of current input
      const baseTitle =
        title.text + title.prompt + (terminal.input.value.trim() || "");
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
        terminal.print(`> ${command}`);
        processCommand(command);
        terminal.input.value = "";
      }, 100);
    }
  };

  // Check title changes frequently
  const titleCheckInterval = setInterval(checkTitleChange, 100);
});
