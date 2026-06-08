export function buildRoadmapTree(questions) {
  const categoryMap = new Map();

  questions.forEach((question) => {
    if (!categoryMap.has(question.majorCategory)) {
      categoryMap.set(question.majorCategory, new Map());
    }

    const subcategoryMap = categoryMap.get(question.majorCategory);
    if (!subcategoryMap.has(question.subcategory)) {
      subcategoryMap.set(question.subcategory, []);
    }

    subcategoryMap.get(question.subcategory).push(question);
  });

  const categories = Array.from(categoryMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoryName, subcategoryMap]) => ({
      id: `category-${categoryName}`,
      name: categoryName,
      type: "category",
      children: Array.from(subcategoryMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([subcategoryName, categoryQuestions]) => ({
          id: `subcategory-${categoryName}-${subcategoryName}`,
          name: subcategoryName,
          type: "subcategory",
          children: categoryQuestions
            .slice()
            .sort((a, b) => a.questionTitle.localeCompare(b.questionTitle))
            .map((question) => ({
              id: question.id,
              name: question.questionTitle,
              type: "question",
              question,
            })),
        })),
    }));

  return {
    id: "root",
    name: "IfDT Research Roadmap",
    type: "root",
    children: categories,
  };
}

export function getRoadmapStats(questions) {
  const categoryNames = new Set();
  const subcategoryNames = new Set();

  questions.forEach((question) => {
    categoryNames.add(question.majorCategory);
    subcategoryNames.add(`${question.majorCategory}::${question.subcategory}`);
  });

  return {
    categories: categoryNames.size,
    subcategories: subcategoryNames.size,
    questions: questions.length,
  };
}
