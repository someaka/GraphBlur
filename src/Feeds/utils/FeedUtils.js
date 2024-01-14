// FeedUtils.js

// Utility function to sanitize and format text
function formatArticleText(text) {
    // Remove HTML tags and unwanted characters
    const sanitizedText = text.replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/g, ' ').trim();
    // Perform any additional formatting you need
    // ...
    return sanitizedText;
}



export { formatArticleText };