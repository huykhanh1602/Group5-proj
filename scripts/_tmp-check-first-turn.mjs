// TEMP script: verify structuredClone() behaviour on a Proxy (what playhtml
// hands to setData callbacks) vs the JSON fallback playhtml itself uses.

const target = {
    board: [[{ owner: "P1", type: "rock" }]],
    turn: "P1",
    seats: { P1: null, P2: null },
};
const proxy = new Proxy(target, {
    get(t, k) {
        const v = Reflect.get(t, k, t);
        return v && typeof v === "object" ? new Proxy(v, this) : v;
    },
});

try {
    structuredClone({ board: proxy.board, turn: proxy.turn });
    console.log("structuredClone on proxy: OK (no throw)");
} catch (e) {
    console.log("structuredClone on proxy THREW:", e.name, "-", e.message);
}

try {
    console.log("JSON fallback ->", JSON.stringify({ board: proxy.board, turn: proxy.turn }));
} catch (e) {
    console.log("JSON stringify THREW:", e.name, "-", e.message);
}
