// Online UI regression contracts for target-bearing Tarot actions and Chariot follow-up.
const fs = require("fs"), assert = require("assert");
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
