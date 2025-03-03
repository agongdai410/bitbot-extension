// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', function() {
  // Get the button element
  const openSidePanelButton = document.getElementById('open-side-panel');
  
  // Add click event listener
  openSidePanelButton.addEventListener('click', function() {
    try {
      // Use the standard Chrome API call without additional options
      // Different Chrome versions may support different options
      chrome.sidePanel.open({}, function() {
        // Removed window.close() to keep the popup open
      });
    } catch (error) {
      console.error('Error opening side panel:', error);
      // Show error message if needed
    }
  });
}); 