#!/usr/bin/env node
"use strict";

/**
 * network-focus-skill CLI.
 *
 *   npx network-focus-skill install      Install the skill into ~/.claude (additive)
 *   npx network-focus-skill uninstall    Remove everything the installer created
 *
 * The installer is intentionally boring and safe: it creates ~/.claude only if it
 * doesn't exist, copies just this skill's files (skill folder, slash command, and
 * its two sub-agents — verify-brief, write-brief), and never touches any other
 * Claude Code config. Re-running updates the skill in place. Uninstall removes only
 * the files this tool created, leaving the rest of ~/.claude alone.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const ok = (m) => console.log(`${GREEN}✓${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}!${RESET} ${m}`);

const PKG_ROOT = path.resolve(__dirname, "..");
const SKILL_SRC = path.join(PKG_ROOT, "skill", "network-focus");
const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SKILL_DEST = path.join(CLAUDE_DIR, "skills", "network-focus");
const CMD_SRC = path.join(SKILL_SRC, "commands", "network-brief.md");
const CMD_DEST = path.join(CLAUDE_DIR, "commands", "network-brief.md");
const SETTINGS_DEST = path.join(CLAUDE_DIR, "network-focus.settings.json");
const SETTINGS_EXAMPLE = path.join(SKILL_SRC, "reference", "settings.example.json");
const AGENTS_SRC = path.join(SKILL_SRC, "agents");
// The skill's sub-agents are copied to the global agents dir (not just nested
// under the skill folder) so Claude Code's Agent tool can discover them by name.
const AGENT_NAMES = ["verify-brief.md", "write-brief.md"];
const AGENTS_DEST_DIR = path.join(CLAUDE_DIR, "agents");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function install() {
  console.log("\nInstalling the Network Focus skill…\n");

  ok(`Node ${process.version} found`);

  // Create global Claude dirs if missing; never clobber existing config.
  fs.mkdirSync(path.join(CLAUDE_DIR, "skills"), { recursive: true });
  fs.mkdirSync(path.join(CLAUDE_DIR, "commands"), { recursive: true });
  fs.mkdirSync(AGENTS_DEST_DIR, { recursive: true });
  ok("~/.claude is ready (existing config left untouched)");

  // Copy just this skill's folder.
  fs.rmSync(SKILL_DEST, { recursive: true, force: true });
  copyDir(SKILL_SRC, SKILL_DEST);
  ok(`Skill installed to ${SKILL_DEST}`);

  // Copy the slash command.
  fs.copyFileSync(CMD_SRC, CMD_DEST);
  ok("Command /network-brief installed");

  // Copy the two sub-agents (Verify, Write) to the global agents dir so the Agent
  // tool can find them by name. Only touch files with these exact names.
  for (const agentFile of AGENT_NAMES) {
    fs.copyFileSync(
      path.join(AGENTS_SRC, agentFile),
      path.join(AGENTS_DEST_DIR, agentFile),
    );
  }
  ok("Sub-agents installed: verify-brief, write-brief");

  // Create settings only if absent, so we never overwrite a configured override.
  // The file ships with no active keys — the loader auto-discovers the roster by
  // default, so most operators never need to open this file at all.
  if (!fs.existsSync(SETTINGS_DEST)) {
    fs.copyFileSync(SETTINGS_EXAMPLE, SETTINGS_DEST);
    ok(`Created settings file: ${SETTINGS_DEST} (no changes needed by default)`);
  } else {
    ok(`Settings file already exists: ${SETTINGS_DEST} (left as-is)`);
  }

  const ROSTER_FOLDER = path.join(os.homedir(), "Documents", "reports");
  console.log("\n-------------------------------------------------------------");
  console.log("Installed. One more step:\n");
  console.log("  Save your roster spreadsheet (.csv or .xlsx) into this folder");
  console.log("  (create it if it doesn't exist yet):");
  console.log(`    ${ROSTER_FOLDER}\n`);
  console.log("  No path to type or paste — the skill finds it there automatically.");
  console.log("  (Keeping the file somewhere else? Set 'rosterPath' in the settings");
  console.log(`  file above instead: ${SETTINGS_DEST})`);
  console.log("\nThen, in Claude Code, run:  /network-brief");
  console.log("-------------------------------------------------------------\n");
}

function uninstall() {
  const keepSettings = process.argv.includes("--keep-settings");
  console.log("\nUninstalling the Network Focus skill…\n");

  let removedAny = false;
  const removeDir = (p, label) => {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      ok(`Removed ${label}`);
      removedAny = true;
    }
  };
  const removeFile = (p, label) => {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { force: true });
      ok(`Removed ${label}`);
      removedAny = true;
    }
  };

  removeDir(SKILL_DEST, `skill folder (${SKILL_DEST})`);
  removeFile(CMD_DEST, "command /network-brief");

  // Only remove the two specific agent files this skill installed — never touch
  // other custom agents the operator may have in ~/.claude/agents.
  for (const agentFile of AGENT_NAMES) {
    removeFile(path.join(AGENTS_DEST_DIR, agentFile), `sub-agent (${agentFile})`);
  }

  if (keepSettings) {
    if (fs.existsSync(SETTINGS_DEST)) {
      warn(`Kept settings file: ${SETTINGS_DEST} (--keep-settings)`);
    }
  } else {
    removeFile(SETTINGS_DEST, `settings file (${SETTINGS_DEST})`);
  }

  // Clean up now-empty skills/commands/agents dirs we may have created, but never
  // remove ~/.claude itself or any dir that still holds other config.
  for (const dir of [
    path.join(CLAUDE_DIR, "skills"),
    path.join(CLAUDE_DIR, "commands"),
    AGENTS_DEST_DIR,
  ]) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  }

  console.log("");
  if (removedAny) {
    ok("Done. The rest of your Claude Code config was left untouched.");
    if (!keepSettings) {
      console.log("  (Your roster spreadsheet was NOT touched — only the skill's " +
        "settings file was removed.)");
    }
  } else {
    warn("Nothing to remove — the skill doesn't appear to be installed.");
  }
  console.log("");
}

function usage() {
  console.log("\nnetwork-focus-skill — weekly Network Focus brief for Claude Code\n");
  console.log("Usage:");
  console.log("  npx network-focus-skill install                 Install into ~/.claude");
  console.log("  npx network-focus-skill uninstall               Remove all skill files");
  console.log("  npx network-focus-skill uninstall --keep-settings   Remove skill but keep your roster path\n");
}

const cmd = process.argv[2];
if (cmd === "install") {
  try {
    install();
  } catch (e) {
    warn(`Install failed: ${e.message}`);
    process.exit(1);
  }
} else if (cmd === "uninstall") {
  try {
    uninstall();
  } catch (e) {
    warn(`Uninstall failed: ${e.message}`);
    process.exit(1);
  }
} else {
  usage();
  if (cmd && cmd !== "help" && cmd !== "--help" && cmd !== "-h") process.exit(1);
}
