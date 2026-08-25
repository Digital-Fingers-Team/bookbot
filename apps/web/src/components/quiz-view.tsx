"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/quiz";

export function QuizView({
  questions,
  selectedAnswers,
  onSelect
}: {
  questions: QuizQuestion[];
  selectedAnswers: Record<number, string>;
  onSelect: (index: number, answer: string) => void;
}) {
  return (
    <div className="space-y-4">
      {questions.map((question, index) => {
        if (question.type === "essay") {
          return <EssayQuestion key={index} question={question} index={index} />;
        }
        const selected = selectedAnswers[index];
        const correctIndex = ["A", "B", "C", "D"].indexOf(question.answer);
        return (
          <div key={index} className="rounded-xl border border-line bg-paper/70 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="mb-3 text-sm font-semibold text-ink dark:text-white">{index + 1}. {question.question}</p>
            <div className="space-y-2">
              {question.options.map((option, optionIndex) => {
                const letter = String.fromCharCode(65 + optionIndex);
                const isSelected = selected === letter;
                const isCorrect = Boolean(selected) && optionIndex === correctIndex;
                const isWrong = isSelected && !isCorrect;
                const stateClass = isCorrect
                  ? " border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : isWrong
                    ? " border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300"
                    : " border-line hover:border-moss/50 dark:border-white/10 dark:hover:border-sea/50";
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => onSelect(index, letter)}
                    className={"flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-start text-sm transition" + stateClass}
                  >
                    <span className="font-semibold">{letter}.</span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
            {selected ? (
              <p className="mt-3 text-xs leading-5 text-ink/70 dark:text-white/70">
                {selected === question.answer ? "Correct. " : "The correct answer is " + question.answer + ". "}
                {question.explanation}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EssayQuestion({ question, index }: { question: Extract<QuizQuestion, { type: "essay" }>; index: number }) {
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-paper/70 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-sm font-semibold text-ink dark:text-white">{index + 1}. {question.question}</p>
      <button
        type="button"
        onClick={() => setShowAnswer((visible) => !visible)}
        className="mt-3 rounded-full border border-moss/30 px-3 py-1.5 text-xs font-semibold text-moss dark:border-sea/30 dark:text-sea"
      >
        {showAnswer ? "Hide sample answer" : "Show sample answer"}
      </button>
      {showAnswer ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/80 dark:text-white/80">{question.sampleAnswer}</p> : null}
    </div>
  );
}
