// TEMP script: confirm playhtml user objects expose `pid`.
import fs from "node:fs";

const res = await fetch("https://unpkg.com/playhtml@2.14.1/dist/index-DlJfxvdB.js");
const text = await res.text();

let out = "";
function dumpCtx(needle, before, after, max = 4) {
    let idx = text.indexOf(needle);
    let n = 0;
    while (idx !== -1 && n < max) {
        out += `\n===== ${needle} #${n} @${idx} =====\n`;
        out += text.slice(Math.max(0, idx - before), idx + after) + "\n";
        idx = text.indexOf(needle, idx + 1);
        n++;
    }
}

dumpCtx("pid:", 400, 400, 3);
dumpCtx("get pid", 0, 400, 2);
dumpCtx("function Jl(", 0, 2500, 1);

fs.writeFileSync(".tmp-playhtml-dump.txt", out, "utf8");
console.log("written", out.length);
