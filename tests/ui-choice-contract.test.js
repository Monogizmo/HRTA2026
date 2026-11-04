// Online UI regression contracts for target-bearing Tarot actions and Chariot follow-up.
const fs = require("fs"), assert = require("assert"), path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(require("path").join(__dirname, "../online/online-game.js"), "utf8");
const css = fs.readFileSync(require("path").join(__dirname, "../online/online.css"), "utf8");

assert.match(src, /\[0, 4, 18\]\.indexOf\(sel\.n\) >= 0/, "Fool, Emperor and Moon must use the target-choice branch");
assert.match(src, /data-act="ntarget" data-card-id="' \+ sel\.id/, "target buttons must carry the selected card ID");
assert.match(src, /if \(a === "ntarget"\) \{ playSel\(\{ target: \+v \}, cardId\); return true; \}/, "target submission must pass the explicit card ID");
assert.match(src, /data-act="ninterrupt" data-card-id="' \+ sel\.id/, "Empress interrupt button must carry its selected card ID");
assert.match(src, /interruptId = cardId == null \? M\.sel : Number\(cardId\)/, "Empress interrupt must resolve the exact selected card");
assert.match(src, /data-act="nopt" data-card-id="' \+ sel\.id/, "ordinary play options must carry the selected card ID");
assert.match(src, /if \(a === "nopt"\)[\s\S]*?chosenId = cardId == null \? M\.sel : Number\(cardId\)/, "ordinary play submission must resolve the exact selected card");
assert.match(src, /if \(chariotPending && ownTurn && !out && pub\.pending\.p === me\)/, "Chariot skip must remain rendered throughout the pending choice");
assert.match(src, /data-act="nskip"' \+ \(skipDisabled \? ' disabled' : ''\)/, "Chariot skip must be disabled during busy states rather than hidden");
assert.match(src, /targetAllowed\.length === 1 && alive\.length === 2/, "two-player target selection must be explicit and automatic");
assert.match(css, /\.nnChariotChoice/, "Chariot follow-up needs a distinct visible action area");
assert.match(css, /\.nnChoiceTitle/, "target / follow-up prompt labels must be styled");
console.log("ALL PASSED — online UI choice contracts (target card IDs, two-player auto-target, Chariot skip)");

// v35 responsive layout and Moon duration UI contracts.
{
  const css = fs.readFileSync(path.join(root, "online/online.css"), "utf8");
  const ui = fs.readFileSync(path.join(root, "online/online.js"), "utf8");
  const game = fs.readFileSync(path.join(root, "online/online-game.js"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  assert.ok(css.includes("overflow-y:auto") && css.includes("touch-action:pan-y"), "outer online dialog must own vertical scrolling");
  assert.match(css, /@media \(orientation:landscape\) and \(max-height:650px\)[\s\S]*?#onl\{[^}]*overflow-y:auto/, "short landscape screens must not disable online dialog scrolling");
  assert.ok(css.includes("max-height:none;overflow:visible"), "avatar grid must not trap outer scrolling");
  assert.ok(css.includes(".onlActionBar{position:sticky"), "create/join action must remain reachable while scrolling");
  assert.ok(css.includes("min-width:760px") || css.includes("(min-width:760px)"), "desktop responsive breakpoint missing");
  assert.ok(ui.includes("onlCreateGrid") && ui.includes("onlActionBar"), "create/join forms must use responsive layout");
  assert.ok(game.includes("pub.revealTurnsLeft") && game.includes("moonTag"), "Moon remaining turns must be visible in the online table");
  const offline = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(offline.includes("จนกว่าเขาจะลงไพ่ครบ 2 ตาของตัวเอง"), "offline rules must describe the two-full-turn Moon duration");
  assert.match(css, /@media \(min-width:760px\) and \(min-height:700px\)[\s\S]*?calc\(\(100dvh - 130px\)\*3\/5\.2\)/, "desktop/tablet game table must fit both viewport width and height");
  assert.strictEqual(manifest.orientation, "any", "PWA must not be locked to portrait orientation");
  console.log("ok  v35 UI contract: single page scroller, sticky action, responsive desktop layout, Moon countdown, rotatable PWA");
}
