#!/usr/bin/env node
import readline from "node:readline";
import { Writable } from "node:stream";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";

const mutedOutput = new Writable({
  write(chunk, encoding, callback) {
    if (!this.muted) {
      stdout.write(chunk, encoding);
    }
    callback();
  },
});
mutedOutput.muted = false;

const rl = readline.createInterface({
  input: stdin,
  output: mutedOutput,
  terminal: true,
});

stdout.write("Password: ");
mutedOutput.muted = true;

rl.question("", async (password) => {
  mutedOutput.muted = false;
  stdout.write("\n");
  rl.close();

  if (password.length < 12) {
    console.error("Use at least 12 characters.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  console.log(hash);
});
