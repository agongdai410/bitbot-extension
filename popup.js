// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', function() {
  // Get the button element
  const openSidePanelButton = document.getElementById('open-side-panel');
  
  // Add click event listener
  openSidePanelButton.addEventListener('click', function() {
    try {
      // Get the current window and open the side panel
      chrome.windows.getCurrent(function(currentWindow) {
        chrome.sidePanel.open({
          windowId: currentWindow.id
        }).then(() => {
          // Close the popup after successfully opening the side panel
          window.close();
        }).catch((error) => {
          console.error('Error opening side panel:', error);
        });
      });
    } catch (error) {
      console.error('Error opening side panel:', error);
      // Try fallback method if the first attempt fails
      try {
        chrome.sidePanel.open({}, () => {
          // Close the popup after the fallback attempt
          window.close();
        });
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
      }
    }
  });
}); 