document.addEventListener("DOMContentLoaded", function() {
    var button = document.getElementById("popupSettingsBtn");
    button.addEventListener("click", function() {
        chrome.tabs.create({url:"mainpage.html"});
    });
});
