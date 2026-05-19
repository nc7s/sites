const nameEl = document.querySelector(".namesake");
const standoutEls = [...document.querySelectorAll(".namesake .standout")];
const otherEls = [...document.querySelectorAll(".namesake .other")];
const charEls = [
  ...document.querySelectorAll(".namesake :is(.standout, .other)"),
];
const unveilOrder = [0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11].map(
  (i) => charEls[i]
); // ↓↓↓↓
//const unveilOrder = [0, 4, 8, 9, 5, 1, 2, 6, 10, 11, 7, 3].map((i) => charEls[i]); // ↓↑↓↑

let flickering = false;
let flickerEls = [...standoutEls];

function flicker() {
  if (Math.random() > 0.3) {
    flickerEls.forEach((e) => e.classList.add("flicker"));
  } else {
    flickerEls.forEach((e) => e.classList.remove("flicker"));
  }
  if (flickering) {
    setTimeout(flicker, 300);
  }
}

function setFlicker(state) {
  flickering = state;
  if (flickering) {
    flickerEls.forEach((e) => e.classList.add("flicker"));
    flicker();
  } else {
    flickerEls.forEach((e) => e.classList.remove("flicker"));
  }
}

let clickPattern = "";

function flickerClick(e) {
  const c = e.target.innerText;
  if ("NCTS".includes(c) && !clickPattern.includes(c)) {
    clickPattern += c;
    const elIdx = flickerEls.indexOf(e.target);
    if (elIdx !== -1) {
      flickerEls.splice(elIdx, 1);
    }
    e.target.classList.remove("flicker");
  }

  if (clickPattern.length === 4) {
    if (clickPattern === "NCTS") {
      unveil();
    } else {
      resetClick();
      flickerEls.forEach((e) => e.classList.add("wrong"));
      setTimeout(
        () => flickerEls.forEach((e) => e.classList.remove("wrong")),
        500
      );
    }
  }
}

function resetClick() {
  flickerEls = [...standoutEls];
  clickPattern = "";
}

let outlineComplete = false;
let lightComplete = false;
let finalFlickerComplete = false;

function outlineOthers() {
  const outlineEls = [...unveilOrder].filter((e) => !standoutEls.includes(e));
  const iv = setInterval(() => {
    const next = outlineEls.shift();
    if (next === undefined) {
      clearInterval(iv);
      outlineComplete = true;
      return;
    }
    next.classList.add("flicker");
  }, 200);
}

function lightOthers() {
  const lightEls = [...unveilOrder];
  const iv = setInterval(() => {
    if (!outlineComplete) return;
    const next = lightEls.shift();
    if (next === undefined) {
      clearInterval(iv);
      lightComplete = true;
      return;
    }
    next.classList.remove("flicker");
    next.classList.remove("veil");
  }, 200);
}

function finalFlicker() {
  let outlined = false;
  const iv = setInterval(() => {
    if (!lightComplete) return;
    if (!outlined) {
      unveilOrder.forEach((e) => e.classList.add("flicker"));
      outlined = true;
      return;
    }
    unveilOrder.forEach((e) => e.classList.remove("flicker"));
    clearInterval(iv);
    finalFlickerComplete = true;
  }, 750);
}

function setSkip(state) {
  window.localStorage.setItem("skip-neon", state);
}

function checkSkip() {
  return window.localStorage.getItem("skip-neon") === "true";
}

function setReplay(waitFn) {
  if (waitFn !== undefined && !waitFn()) {
    return setTimeout(() => setReplay(waitFn), 100);
  }
  const elR = otherEls.find((e) => e.innerHTML.toUpperCase().includes("R"));

  function replayClick() {
    veil();
    elR.removeEventListener("click", replayClick);
    elR.classList.remove("replay");
    setSkip(false);
  }
  elR.addEventListener("click", replayClick);
  elR.setAttribute("title", "Replay");

  setTimeout(() => elR.classList.add("replay"), 1000);
}

function veil() {
  resetClick();
  finalFlickerComplete = outlineComplete = lightComplete = false;
  otherEls.forEach((e) => e.classList.add("veil"));
  standoutEls.forEach((e) => {
    e.classList.add("veil");
    e.addEventListener("click", flickerClick);
  });
  setFlicker(true);
}

function unveil() {
  standoutEls.forEach((e) => {
    e.classList.remove("veil");
    e.classList.add("flicker");
    e.removeEventListener("click", flickerClick);
  });
  setFlicker(false);
  outlineOthers();
  lightOthers();
  finalFlicker();
  setSkip(true);
  setReplay(() => finalFlickerComplete);
}

if (checkSkip()) {
  setReplay();
} else {
  veil();
}

