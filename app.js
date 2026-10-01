const grid = document.querySelector("#grid");
const empty = document.querySelector("#empty");
const chips = document.querySelector("#chips");
const search = document.querySelector("#search");
const dialog = document.querySelector("#graph-dialog");
const dialogClose = document.querySelector("#dialog-close");
const reelLine = document.querySelector("#reel-line");

const state = {
  graphs: [],
  author: "All",
  query: "",
  share: "",
};

search.addEventListener("input", () => {
  state.query = search.value.trim().toLowerCase();
  renderGrid();
});

if (dialog && dialogClose) {
  dialogClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function followupsOf(graph) {
  if (!Array.isArray(graph.followups)) return [];
  return graph.followups.map((item) => String(item).trim()).filter(Boolean);
}

function titleOf(graph) {
  return graph.title || "Untitled";
}

function promptOf(graph) {
  return graph.prompt || "";
}

function minutesOf(graph) {
  const n = Number(graph.minutes);
  return Number.isFinite(n) ? n : 2;
}

function calculatorHash(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, location.origin);
    const match = parsed.pathname.match(/\/calculator\/([a-z0-9]+)\/?$/i);
    if (match) return match[1].toLowerCase();
  } catch {
    /* plain hash */
  }
  const plain = String(url).trim().match(/^[a-z0-9]+$/i);
  return plain ? plain[0].toLowerCase() : "";
}

function shareParam() {
  const raw = new URLSearchParams(location.search).get("hash");
  if (!raw || !raw.trim()) return "";
  return calculatorHash(raw) || raw.trim().toLowerCase();
}

function shareHref(graph) {
  const id = calculatorHash(graph.url);
  if (!id) return "";
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("hash", id);
  return url.toString();
}

function desmosEmbed(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const hostOk = parsed.hostname === "www.desmos.com" || parsed.hostname === "desmos.com";
    const match = parsed.pathname.match(/^\/calculator\/([a-z0-9]+)\/?$/i);
    if (parsed.protocol !== "https:" || !hostOk || !match) return null;
    return `https://www.desmos.com/calculator/${match[1]}?embed`;
  } catch {
    return null;
  }
}

function desmosOpen(url) {
  const embed = desmosEmbed(url);
  return embed ? embed.replace("?embed", "") : null;
}

function quotedPrompt(graph) {
  return `“${promptOf(graph)}”`;
}

function renderChips(graphs) {
  const authors = ["All", ...new Set(graphs.map((graph) => graph.author || "Unknown"))];
  chips.replaceChildren();
  for (const author of authors) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = author;
    button.setAttribute("aria-pressed", String(author === state.author));
    button.addEventListener("click", () => {
      state.author = author;
      renderChips(graphs);
      renderGrid();
    });
    chips.append(button);
  }
}

function metaLine(graph) {
  const tries = 1 + followupsOf(graph).length;
  const tryLabel = tries === 1 ? "1 try" : `${tries} tries`;
  return `${tryLabel} · prompt by ${graph.author || "Unknown"} · ${minutesOf(graph)} min`;
}

function followupTimeline(graph) {
  const followups = followupsOf(graph);
  if (!followups.length) return null;

  const details = document.createElement("details");
  details.className = "followups";

  const summary = document.createElement("summary");
  summary.textContent = followups.length === 1 ? "1 later prompt" : `${followups.length} later prompts`;

  const list = document.createElement("ol");
  list.className = "timeline";
  followups.forEach((text, index) => {
    const item = document.createElement("li");
    const step = document.createElement("span");
    step.className = "timeline-step";
    step.textContent = String(index + 2);
    const quote = document.createElement("p");
    quote.textContent = `“${text}”`;
    item.append(step, quote);
    list.append(item);
  });

  details.append(summary, list);
  return details;
}

function previewNode(graph) {
  const frame = document.createElement("div");
  frame.className = "preview";
  const src = desmosEmbed(graph.url);
  if (!src) {
    const note = document.createElement("div");
    note.className = "preview-empty";
    note.textContent = "Link coming";
    frame.append(note);
    return frame;
  }
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = titleOf(graph);
  iframe.loading = "lazy";
  iframe.allow = "fullscreen";
  frame.append(iframe);
  return frame;
}

function filteredGraphs() {
  if (state.share) {
    return state.graphs.filter((graph) => calculatorHash(graph.url) === state.share);
  }
  return state.graphs.filter((graph) => {
    const authorOk = state.author === "All" || graph.author === state.author;
    const haystack = [titleOf(graph), promptOf(graph), graph.author, ...followupsOf(graph)]
      .join(" ")
      .toLowerCase();
    const queryOk = !state.query || haystack.includes(state.query);
    return authorOk && queryOk;
  });
}

function renderGrid() {
  const graphs = filteredGraphs();
  grid.replaceChildren();
  empty.hidden = graphs.length > 0;
  empty.textContent = state.share ? "No graph for that link." : "No graphs match that filter.";
  graphs.forEach((graph) => {
    const index = state.graphs.indexOf(graph);
    const card = document.createElement("article");
    card.className = "card";
    card.id = graph.id;

    const body = document.createElement("div");
    body.className = "card-body";

    const top = document.createElement("div");
    top.className = "card-top";

    const indexLabel = document.createElement("p");
    indexLabel.className = "index";
    indexLabel.textContent = String(index + 1).padStart(2, "0");

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = titleOf(graph);

    const promptWrap = document.createElement("div");
    promptWrap.className = "prompt-wrap";
    const promptTag = document.createElement("span");
    promptTag.className = "prompt-tag";
    promptTag.textContent = "prompt";
    const prompt = document.createElement("p");
    prompt.className = "prompt";
    prompt.textContent = quotedPrompt(graph);
    promptWrap.append(promptTag, prompt);

    const meta = document.createElement("p");
    meta.className = "meta";
    const tries = 1 + followupsOf(graph).length;
    const tryLabel = tries === 1 ? "1 try" : `${tries} tries`;
    const name = document.createElement("span");
    name.className = "name-hit";
    name.textContent = graph.author || "Unknown";
    meta.append(
      document.createTextNode(`${tryLabel} · prompt by `),
      name,
      document.createTextNode(` · ${minutesOf(graph)} min`)
    );

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const shareUrl = shareHref(graph);
    if (shareUrl) {
      const share = document.createElement("button");
      share.type = "button";
      share.className = "ghost";
      share.textContent = "Share";
      share.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(shareUrl);
          share.textContent = "Copied";
        } catch {
          share.textContent = shareUrl;
        }
        window.setTimeout(() => {
          share.textContent = "Share";
        }, 1600);
      });
      actions.append(share);
    }
    const open = document.createElement("button");
    open.type = "button";
    open.className = "ghost";
    open.textContent = desmosEmbed(graph.url) ? "Open graph" : "Details";
    open.addEventListener("click", () => openGraph(graph));
    actions.append(open);
    top.append(indexLabel, actions);

    body.append(top, title);
    if (promptOf(graph)) body.append(promptWrap);
    const later = followupTimeline(graph);
    if (later) body.append(later);
    body.append(meta);
    card.append(previewNode(graph), body);
    grid.append(card);
  });
}

function showReelLine(text) {
  reelLine.textContent = text;
  const len = text.length;
  reelLine.style.fontSize =
    len > 120 ? "0.62em" : len > 70 ? "0.72em" : len > 42 ? "0.84em" : "1em";
}

function startReel(graphs) {
  if (!reelLine) return;
  const prompts = graphs.map((graph) => promptOf(graph)).filter(Boolean);
  if (!prompts.length) {
    reelLine.textContent = "";
    return;
  }
  let index = 0;
  showReelLine(prompts[0]);
  if (prompts.length < 2) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.setInterval(() => {
    if (reduced) {
      index = (index + 1) % prompts.length;
      showReelLine(prompts[index]);
      return;
    }
    if (reelLine.classList.contains("is-out")) return;
    reelLine.classList.remove("is-in");
    reelLine.classList.add("is-out");
    reelLine.addEventListener("animationend", function done(event) {
      if (event.animationName !== "reel-out") return;
      reelLine.removeEventListener("animationend", done);
      index = (index + 1) % prompts.length;
      showReelLine(prompts[index]);
      reelLine.classList.remove("is-out");
      reelLine.classList.add("is-in");
    });
  }, 2400);
}

function openGraph(graph) {
  if (!dialog) return;
  const kicker = document.querySelector("#dialog-kicker");
  const dialogTitle = document.querySelector("#dialog-title");
  const dialogPrompt = document.querySelector("#dialog-prompt");
  const dialogSummary = document.querySelector("#dialog-summary");
  const dialogMeta = document.querySelector("#dialog-meta");
  if (kicker) kicker.textContent = metaLine(graph);
  if (dialogTitle) dialogTitle.textContent = titleOf(graph);
  if (dialogPrompt) dialogPrompt.textContent = promptOf(graph) ? quotedPrompt(graph) : "";
  if (dialogSummary) dialogSummary.textContent = "";
  if (dialogMeta) dialogMeta.textContent = "";

  const attemptsMount = document.querySelector("#dialog-attempts");
  if (attemptsMount) {
    attemptsMount.replaceChildren();
    const later = followupTimeline(graph);
    if (later) attemptsMount.append(later);
  }

  const frame = document.querySelector("#dialog-frame");
  frame.replaceChildren();
  const src = desmosEmbed(graph.url);
  if (src) {
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = titleOf(graph);
    iframe.allow = "fullscreen";
    frame.append(iframe);
  } else {
    const pending = document.createElement("p");
    pending.className = "pending";
    pending.textContent = "The Desmos link for this graph is on its way.";
    frame.append(pending);
  }

  const actions = document.querySelector("#dialog-actions");
  actions.replaceChildren();
  const openUrl = desmosOpen(graph.url);
  if (openUrl) {
    const link = document.createElement("a");
    link.className = "text-link";
    link.href = openUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open in Desmos";
    actions.append(link);
  }

  if (location.hash !== `#${graph.id}`) {
    history.replaceState(null, "", `#${graph.id}`);
  }
  if (!dialog.open) dialog.showModal();
}

async function main() {
  const response = await fetch("./data/graphs.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Could not load data/graphs.json");
  const data = await response.json();
  state.graphs = Array.isArray(data.graphs) ? data.graphs : [];
  state.share = shareParam();
  if (state.share) {
    document.body.classList.add("is-share");
    const brand = document.querySelector(".brand");
    if (brand) brand.href = location.pathname;
    const shared = state.graphs.find((graph) => calculatorHash(graph.url) === state.share);
    if (shared) document.title = `${titleOf(shared)} · DesLearn`;
  }
  renderChips(state.graphs);
  renderGrid();
  if (!state.share) startReel(state.graphs);

  const id = location.hash.replace("#", "");
  const selected = state.graphs.find((graph) => graph.id === id);
  if (selected) openGraph(selected);
}

main().catch((error) => {
  empty.hidden = false;
  empty.textContent = error.message;
});
