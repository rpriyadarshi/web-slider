import readline from "node:readline";

const createInterface = readline.createInterface;

/** A closed PTY raises EIO on read. That must not crash a share that already has its paths. */
readline.createInterface = function createInterfaceIgnoringClosedTTY(...args) {
  const rl = createInterface.apply(this, args);
  rl.on("error", (error) => {
    if (error && error.code === "EIO") return;
    throw error;
  });
  return rl;
};

process.stdin.on("error", (error) => {
  if (error && error.code === "EIO") return;
  throw error;
});
