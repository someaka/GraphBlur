import { toggleMainContent } from "../ui/FeedUI";

let isSameFeedClickedBool = false;
let currentFeed = null;

function isSameFeedClicked(feedData) {
    return feedData === currentFeed;
}

function isCurrentDisplayedFeed(feedData) {
    return currentFeed && currentFeed.id === feedData.id;
}

function isSelectedButNotDisplayed(feedElement) {
    return feedElement.classList.contains('clicked');
}

function unselectCurrentFeed() {
    if (!currentFeed) return;
    const currentFeedElement = document.querySelector(`.feed[data-id="${currentFeed.id}"]`);
    if (currentFeedElement) {
        toggleFeedElement(currentFeedElement, currentFeedElement.dataset.originalColor);
    }
}

function retractMainContent() {
    toggleMainContent(false); // Move the panel back to the right
    currentFeed = null;
}

function expandMainContent(feedData) {
    currentFeed = feedData;
    toggleMainContent(true); // Move the panel to the left
}

export {
  isSameFeedClickedBool,
  currentFeed,
  isSameFeedClicked,
  isSelectedButNotDisplayed,
  isCurrentDisplayedFeed,
  unselectCurrentFeed,
  retractMainContent,
  expandMainContent
};