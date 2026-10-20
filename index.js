let historyMap = new Map();
let disableNextState = false;
let currentClues = [];
// jservice.io is offline. The replacement API is the Worker in this repo.
// Same-origin /api is used on the Worker and in local dev; GitHub Pages calls the Worker directly.
const HOSTED_API_ORIGIN = "https://jeopardy-in-a-flash.descriptive-perch.workers.dev";

let apiBase = () => {
  const host = window.location.hostname;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".workers.dev")
  ) {
    return `${window.location.origin}/api`;
  }
  return `${HOSTED_API_ORIGIN}/api`;
};

const States = Object.freeze({
  Question: "question",
  Answer: "answer"
});
let currentState = States.Answer;

document.addEventListener("DOMContentLoaded", function() {
  nextState();
});

document.onkeyup = e => {
  if (disableNextState !== true) {
    e = e || window.event;

    // right arrow or 'l'
    if (e.keyCode === 39 || e.keyCode === 76) {
      nextState();
    }
  }
};

let showQuestion = () => {
  document.querySelector("#question").classList.remove("hidden");
  document.querySelector("#answer").classList.add("hidden");
};

let showAnswer = () => {
  document.querySelector("#question").classList.add("hidden");
  document.querySelector("#answer").classList.remove("hidden");
};

let nextState = () => {
  if (currentState === States.Question) {
    showAnswer();
    currentState = States.Answer;
  } else {
    nextQuestion();
    currentState = States.Question;
  }
};

/*
 * Changes escaped apostrophes from Ben\'s to Ben's
 */
let removeEscapeFromQuote = text => text.replace(/\\'/g, "'");

let setQuestionText = questionText => {
  document.querySelector("#question > .box").innerHTML = removeEscapeFromQuote(
    questionText
  );
};

let setAnswerText = answerText => {
  document.querySelector("#answer > .box").innerHTML = removeEscapeFromQuote(
    answerText
  );
};

let setCategoryText = categoryTitle => {
  document.querySelector("#category").innerHTML = removeEscapeFromQuote(
    categoryTitle
  );
};

let readJson = async (response) => {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
};

let getRandomClue = async () => {
  const response = await fetch(`${apiBase()}/random?count=1`);
  const clueArr = await readJson(response);
  return clueArr[0];
};

let getRandomCategoryClues = async () => {
  const randomClue = await getRandomClue();
  const categoryId = randomClue.category.id;
  const response = await fetch(`${apiBase()}/clues?category=${categoryId}`);
  let categoryClues = await readJson(response);
  categoryClues = categoryClues.slice(0, 5);
  return categoryClues;
};

let nextQuestion = async () => {
  if (disableNextState === true) {
    return;
  }

  disableNextState = true;

  try {
    let clue = currentClues.shift();
    if (!clue) {
      currentClues = await getRandomCategoryClues();
      clue = currentClues.shift();
    }
    if (!clue || !clue.category) {
      throw new Error("empty clue");
    }

    setQuestionText(clue.question);
    setAnswerText(clue.answer);
    setCategoryText(clue.category.title);
    showQuestion();
  } catch (error) {
    currentClues = [];
    setCategoryText("connection problem");
    setQuestionText("Could not load a clue. Try again.");
    setAnswerText("");
    showQuestion();
  } finally {
    disableNextState = false;
  }
};

let nextAnswer = async () => {};
