const grid = document.querySelector("#grid");
const empty = document.querySelector("#empty");
const chips = document.querySelector("#chips");
const search = document.querySelector("#search");
const dialog = document.querySelector("#graph-dialog");
const dialogClose = document.querySelector("#dialog-close");
const reelLine = document.querySelector("#reel-line");
const reelScroll = document.querySelector("#reel-scroll");
const reelScrollTrack = document.querySelector("#reel-scroll-track");
const reelScrollThumb = document.querySelector("#reel-scroll-thumb");

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

function averageMinutesLabel(graphs) {
  if (!graphs.length) return "2 minutes";
  const avg = graphs.reduce((sum, graph) => sum + minutesOf(graph), 0) / graphs.length;
  const rounded = Math.round(avg * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} minutes`;
}

function updateAverageMinutes(graphs) {
  const mark = document.querySelector("#avg-minutes");
  if (mark) mark.textContent = averageMinutesLabel(graphs);
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

function userParam() {
  const raw = new URLSearchParams(location.search).get("user");
  if (!raw || !raw.trim()) return "";
  return raw.trim();
}

function resolveAuthor(graphs, name) {
  const needle = String(name || "")
    .trim()
    .toLowerCase();
  if (!needle) return "All";
  const authors = [...new Set(graphs.map((graph) => graph.author || "Unknown"))];
  return authors.find((author) => author.toLowerCase() === needle) || name.trim();
}

function setUserQuery(author) {
  const url = new URL(location.href);
  if (!author || author === "All") url.searchParams.delete("user");
  else url.searchParams.set("user", author);
  history.replaceState(null, "", url.pathname + url.search + url.hash);
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
      setUserQuery(author);
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
    const authorOk =
      state.author === "All" ||
      (graph.author || "Unknown").toLowerCase() === state.author.toLowerCase();
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
    const openUrl = desmosOpen(graph.url);
    if (openUrl) {
      const open = document.createElement("a");
      open.className = "ghost";
      open.href = openUrl;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.textContent = "Open graph";
      actions.append(open);
    } else {
      const open = document.createElement("button");
      open.type = "button";
      open.className = "ghost";
      open.textContent = "Details";
      open.addEventListener("click", () => openGraph(graph));
      actions.append(open);
    }
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

function jumpToGraph(graph) {
  if (!graph?.id) return;
  let changed = false;
  if (state.author !== "All") {
    state.author = "All";
    setUserQuery("All");
    changed = true;
  }
  if (state.query) {
    state.query = "";
    if (search) search.value = "";
    changed = true;
  }
  if (changed) {
    renderChips(state.graphs);
    renderGrid();
  }
  const card = document.getElementById(graph.id);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("is-flash");
  window.setTimeout(() => card.classList.remove("is-flash"), 1200);
}

function showReelLine(text) {
  reelLine.textContent = text;
  reelLine.style.fontSize =
    text.length > 120 ? "0.62em" : text.length > 70 ? "0.72em" : text.length > 42 ? "0.84em" : "1em";
}

function startReel(graphs) {
  if (!reelLine) return;
  const entries = graphs.filter((graph) => promptOf(graph));
  const prompts = entries.map((graph) => promptOf(graph));
  if (!prompts.length) {
    reelLine.textContent = "";
    reelLine.removeAttribute("role");
    reelLine.removeAttribute("tabindex");
    if (reelScroll) reelScroll.hidden = true;
    return;
  }

  let index = 0;
  let animating = false;
  let scrubbing = false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const maxIndex = prompts.length - 1;
  const reelWindow = document.querySelector("#reel-window");

  reelLine.setAttribute("role", "link");
  reelLine.tabIndex = 0;
  reelLine.title = "Go to graph";
  reelLine.classList.add("is-clickable");

  const syncScroll = () => {
    if (!reelScroll || !reelScrollTrack || !reelScrollThumb || maxIndex < 1) return;
    const track = reelScrollTrack.clientHeight;
    const thumb = Math.max(18, track / prompts.length);
    const travel = Math.max(0, track - thumb);
    const top = (index / maxIndex) * travel;
    reelScrollThumb.style.height = `${thumb}px`;
    reelScrollThumb.style.top = `${top}px`;
    reelScroll.setAttribute("aria-valuenow", String(index));
    reelScroll.setAttribute("aria-valuemax", String(maxIndex));
  };

  const clearAnim = () => {
    reelLine.classList.remove("is-out-forward", "is-in-forward", "is-out-back", "is-in-back");
  };

  const showAt = (nextIndex, { animate = false, direction = 0 } = {}) => {
    const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
    if (clamped === index && reelLine.textContent) {
      syncScroll();
      return;
    }
    if (animate && !reduced && animating) return;

    const goingBack = direction < 0 || (direction === 0 && clamped < index);
    index = clamped;
    syncScroll();

    if (!animate || reduced) {
      clearAnim();
      showReelLine(prompts[index]);
      return;
    }

    animating = true;
    const target = index;
    const outClass = goingBack ? "is-out-back" : "is-out-forward";
    const inClass = goingBack ? "is-in-back" : "is-in-forward";
    const outName = goingBack ? "reel-out-back" : "reel-out-forward";
    clearAnim();
    reelLine.classList.add(outClass);
    reelLine.addEventListener("animationend", function done(event) {
      if (event.animationName !== outName) return;
      reelLine.removeEventListener("animationend", done);
      showReelLine(prompts[target]);
      clearAnim();
      reelLine.classList.add(inClass);
      animating = false;
    });
  };

  const indexFromClientY = (clientY) => {
    const rect = reelScrollTrack.getBoundingClientRect();
    const thumb = Math.max(18, rect.height / prompts.length);
    const travel = Math.max(1, rect.height - thumb);
    const y = clientY - rect.top - thumb / 2;
    const ratio = Math.max(0, Math.min(1, y / travel));
    return Math.round(ratio * maxIndex);
  };

  const goToCurrent = () => jumpToGraph(entries[index]);

  reelLine.addEventListener("click", goToCurrent);
  reelLine.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    goToCurrent();
  });

  showReelLine(prompts[0]);
  if (reelScroll) {
    if (maxIndex < 1) {
      reelScroll.hidden = true;
    } else {
      reelScroll.hidden = false;
      syncScroll();
      window.addEventListener("resize", syncScroll);

      const onPointerMove = (event) => {
        if (!scrubbing) return;
        showAt(indexFromClientY(event.clientY), { animate: false });
      };
      const onPointerUp = () => {
        if (!scrubbing) return;
        scrubbing = false;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      reelScrollThumb.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        scrubbing = true;
        reelScrollThumb.setPointerCapture?.(event.pointerId);
        showAt(indexFromClientY(event.clientY), { animate: false });
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
      });

      reelScrollTrack.addEventListener("pointerdown", (event) => {
        if (event.target === reelScrollThumb) return;
        const next = indexFromClientY(event.clientY);
        showAt(next, {
          animate: true,
          direction: next < index ? -1 : 1,
        });
      });
    }
  }

  if (reelWindow && maxIndex >= 1) {
    reelWindow.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const delta = event.deltaY === 0 ? event.deltaX : event.deltaY;
        if (!delta) return;
        const step = delta > 0 ? 1 : -1;
        showAt(index + step, { animate: !reduced, direction: step });
      },
      { passive: false }
    );
  }

  if (prompts.length < 2) return;

  window.setInterval(() => {
    if (scrubbing || animating) return;
    showAt((index + 1) % prompts.length, { animate: !reduced, direction: 1 });
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
  const requestedUser = userParam();
  if (requestedUser) state.author = resolveAuthor(state.graphs, requestedUser);
  if (state.share) {
    document.body.classList.add("is-share");
    const brand = document.querySelector(".brand");
    if (brand) brand.href = location.pathname;
    const shared = state.graphs.find((graph) => calculatorHash(graph.url) === state.share);
    if (shared) document.title = `${titleOf(shared)} · DesLearn`;
  }
  renderChips(state.graphs);
  renderGrid();
  updateAverageMinutes(state.graphs);
  if (!state.share) startReel(state.graphs);

  const id = location.hash.replace("#", "");
  const selected = state.graphs.find((graph) => graph.id === id);
  if (selected) openGraph(selected);
}

main().catch((error) => {
  empty.hidden = false;
  empty.textContent = error.message;
});
