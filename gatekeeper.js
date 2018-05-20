/**
 * Extract the domain part of a url.
 */
function getURLDomain(url) {
    if (url === undefined)
        return false;

    if (url.startsWith("http://"))
        url = url.substring(7);
    if (url.startsWith("https://"))
        url = url.substring(8);

    var domain = url;
    if (url.indexOf("/") >= 0) {
        domain = url.substring(0, url.indexOf("/"));
    }
    return domain;
};

// Check if the url is of wikipedia.org domain.
function isWikipediaDomain(url) {
    retunr getURLDomain(url).endsWith("wikipedia.org");
};

// Returns a string containing full year, month and day. Such strings can be used as keys
// for storing daywise browsing data in local storage.
function getUTCDateKey() {
    var now = new Date();
    return now.getUTCFullYear() + ":" + now.getUTCMonth() + ":" +
        now.getUTCDate();
}

// Return a string describing the contents(key/values) of the passed object. Useful
// for debugging purposes.
function getPropString(obj) {
    if (obj === undefined) {
        return "undefined";
    }
    var ret = "";
    for (var key in obj) {
        ret += key + ": " + obj[key] + ",";
    }

    if (ret.length > 0) {
        ret = ret.substring(0, ret.length - 1);
    }

    return ret;
}

function arrayElemsToString(arr, delim) {
    if (delim === undefined)
        delim = " ";
    var ret = "";
    for (var i = 0;i < arr.length; ++i) {
        ret += arr[i];
        if (i < arr.length - 1)
            ret += delim;
    }
    return ret;
}

// Add event listeners for url updates, tab switching, close etc...
function addTabEventListeners(processTabEvent) {
    // When tab url is updated
    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        if ("url" in changeInfo) {
            processTabEvent(tab);
        }
    });

    // When the active tab changes - either when a new tab with blank page is 
    // created or when user switches to another tab.
    chrome.tabs.onActivated.addListener(function (obj) {
        chrome.tabs.get(obj.tabId, function(tab) {
            processTabEvent(tab);
        });
    });

    // When a tab is closed.
    chrome.tabs.onRemoved.addListener(function(tabId, isWindowClosing) {
        // Only process if the window is closing.
        if (isWindowClosing) {
            processTabEvent();
        } 
    });
};

function initialize(storedData) {
    var DAILY_TIME_LIMIT_MS = 300000;
    var browsingData = storedData.browsingData || {
        currentUrl: undefined,
        browseStart: undefined,
        dateKey: getUTCDateKey(),
        timeSpentMs: 0
    };
    
    if (!('dateKey' in browsingData)) {
        browsingData.dateKey = getUTCDateKey();
    }

    if (!('browseStart' in browsingData)) {
        browsingData.browseStart = undefined;
    }
    if (!('timeSpentMs' in browsingData)) {
        browsingData.timeSpentMs = 0;
    }

    // All the browsing data logic is in here.
    function processTabEvent(newTab) {
        // First, update browsing data.
        var oldurl = browsingData.currentUrl;
        var newurl = newTab && newTab.url;
        browsingData.currentUrl = newurl;

        var f = isWikipediaDomain;

        // update time spent so far.
        if (f(oldurl) && !f(newurl)) {
            var spent = new Date().getTime() - browsingData.browseStart;
            browsingData.timeSpentMs += spent;
        } else if (f(newurl) && !f(oldurl)) {
            browsingData.browseStart = new Date().getTime();
        }

        if (f(newurl)) {
            if (browsingData.timeSpentMs >= DAILY_TIME_LIMIT_MS) {
                var redirectUrl = "chrome://newtab";
                chrome.tabs.update(newTab.id, {url:redirectUrl});
                alert("quota over, redirecting to " + redirectUrl);
            } else {
                // Create an alarm for the remaining time.
                var timeRemainingMs = DAILY_TIME_LIMIT_MS - browsingData.timeSpentMs;
            }
        }

        chrome.storage.local.set({'browsingData':browsingData});
    };

    // Listen for tab events like create/update/remove and update user browsing info
    // accordingly.
    addTabEventListeners(processTabEvent);
};

chrome.storage.local.get(['browsingData'], initialize);
