let historyMap = new Map();
let disableNextState = false;
let currentClues = [];
let baseUrl = "https://yacdn.org/proxy/http://jservice.io/api";

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

let getRandomClue = async () => {
  const response = await fetch(
    "{baseUrl}/random?count=1",
    {
      headers: {
        Origin: "https://benhamilto.github.io/jeopardy-in-a-flash/"
      }
    }
  );
  const clueArr = await response.json();
  const clue = clueArr[0];

  return clue;
};

let getRandomCategoryClues = async () => {
  const randomClue = await getRandomClue();
  const categoryId = randomClue.category.id;
  const response = await fetch(
    `{baseUrl}/clues?category=${categoryId}`,
    {
      headers: {
        Origin: "https://benhamilto.github.io/jeopardy-in-a-flash/"
      }
    }
  );

  let categoryClues = await response.json();
  categoryClues = categoryClues.slice(0, 5);
  return categoryClues;
};

let nextQuestion = async () => {
  if (disableNextState === true) {
    return;
  }

  disableNextState = true;

  let clue = currentClues.shift();
  if (!clue) {
    currentClues = await getRandomCategoryClues();
    clue = currentClues.shift();
  }

  disableNextState = false;

  setQuestionText(clue.question);
  setAnswerText(clue.answer);
  setCategoryText(clue.category.title);
  showQuestion();
};

let nextAnswer = async () => {};
