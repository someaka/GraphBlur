export function updateFeedElementStyles(feedElement, isSelected) {
    if (!feedElement || !feedElement.classList) {
        logger.error('Invalid feedElement passed to updateFeedElementStyles:', feedElement);
        return; // Exit the function if feedElement is not valid
      }
    if (isSelected) {
        feedElement.classList.add('clicked');
        feedElement.style.backgroundColor = feedElement.dataset.originalColor + '80';
        feedElement.style.boxShadow = 'inset 0 0 5px rgba(0,0,0,0.3)';
    } else {
        feedElement.classList.remove('clicked');
        feedElement.style.backgroundColor = feedElement.dataset.originalColor;
        feedElement.style.boxShadow = '';
    }
}