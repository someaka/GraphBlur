function hasInvalidContent(article) {
  return !article.article || typeof article.article.title !== 'string' || typeof article.article.text !== 'string';
}

function isEmptyString(article) {
  return !`${article.article.title} ${article.article.text}`.trim();
}

function isValidArticle(article) {
  return !hasInvalidContent(article) && !isEmptyString(article);
}

export {
  isValidArticle,
  isEmptyString,
  hasInvalidContent
}