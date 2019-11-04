document.addEventListener("DOMContentLoaded", function() {
  getRandomClue();
});

let showQuestion = () => {
  document.querySelector("#question").classList.remove("hidden");
  document.querySelector("#answer").classList.add("hidden");
};

let showAnswer = () => {
  document.querySelector("#question").classList.add("hidden");
  document.querySelector("#answer").classList.remove("hidden");
};

let setQuestion = questionText => {
  document.querySelector("#question > .box").innerHTML = questionText;
};

let setAnswer = answerText => {
  document.querySelector("#answer > .box").innerHTML = answerText;
};

let setCategory = categoryTitle => {
  document.querySelector("#category").innerHTML = categoryTitle;
};

let getRandomClue = async () => {
  const response = await fetch("http://jservice.io/api/random?count=1");
  const clueArr = await response.json();
  const clue = clueArr[0];

  setQuestion(clue.question);
  setAnswer(clue.answer);
  setCategory(clue.category.title);
  showQuestion();
};
