/** 
 * Extract the host part of a url.
 */
function getURLHost(url) {
    if (url === undefined)
        return "";

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
    return getURLHost(url).endsWith("wikipedia.org");
};

// Set an object property to the given value, if it doesn't exist already. If
// the object is undefined however, it's a nop
function setValueIfNotExists(obj, key, val) {
    if (obj === undefined)
        return;
    if (!(key in obj))
        obj[key] = val;
};

// Returns a string containing full year, month and day. Such strings can be used as keys
// for storing daywise browsing data in local storage.
function getDateKey() {
    var now = new Date();
    return now.getFullYear() + ":" + now.getMonth() + ":" + now.getDate();
}

// Return the time of next midnight.
// when time = May 21, 11:59:59 PM -> return May 22, 12:00:00 AM
// when time = May 21, 12:00:00 AM -> return May 22, 12:00:00 AM
function getNextMidnightTime() {
    var now = new Date();
    // Clear out the hours, minutes and seconds fields.
    now.setHours(0);
    now.setMinutes(0);
    now.setSeconds(0);

    // Increment the day by 1(this will automatically increment the month, year
    // fields if necessary)
    now.setDate(now.getDate() + 1);
    return now;
};

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

// Return a string concatenating all the given array elements with the given delimiter.
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

// Clear entries of browsingData object with keys older than dateKey.
function clearOlderEntries(browsingData, dateKey) {
    for (var key in browsingData) {
        if (key !== dateKey) {
            delete browsingData[key];
        }
    }
};

// Read data from local storage and use it to initialize extension state.
function initialize(storedData) {
    var DAILY_TIME_LIMIT_MS = 10000 * 30;
    var dkey = getDateKey();
    var browsingData = storedData.browsingData || {};
    clearOlderEntries(browsingData, dkey);

    setValueIfNotExists(browsingData, dkey, {
        currentUrl: undefined,
        browseStart: undefined,
        timeSpentMs: 0
    });
    browsingData = browsingData[dkey];

    function storeBrowsingData() {
        var store = {};
        store[getDateKey()] = browsingData;
        chrome.storage.local.set({browsingData:store});
    };

    var redirectUrl = "chrome://newtab";
    // All the browsing data logic is in here.
    function processTabEvent(newTab) {
        // First, update browsing data.
        var oldurl = browsingData.currentUrl;
        var newurl = newTab && newTab.url;
        browsingData.currentUrl = newurl;

        var f = isWikipediaDomain;

        // Cancel the closer alarm.
        chrome.alarms.clear("closer");

        // update time spent so far.
        if (f(oldurl) && !f(newurl)) {
            var spent = new Date().getTime() - browsingData.browseStart;
            browsingData.timeSpentMs += spent;
        } else if (f(newurl) && !f(oldurl)) {
            browsingData.browseStart = new Date().getTime();
        }

        if (f(newurl)) {
            if (browsingData.timeSpentMs >= DAILY_TIME_LIMIT_MS) {
                chrome.tabs.update(newTab.id, {url:redirectUrl});
                alert("quota over, redirecting to " + redirectUrl);
            } else {
                // Create an alarm for the remaining time.
                var timeRemainingMs = DAILY_TIME_LIMIT_MS - browsingData.timeSpentMs;
                chrome.alarms.create("closer", {
                    when: new Date().getTime() + timeRemainingMs
                });
            }
        } else {
            browsingData.browseStart = undefined;
        }

        // Sync browsing data to local storage.
        storeBrowsingData();
    };

    // Listen for tab events like create/update/remove and update user browsing info.
    addTabEventListeners(processTabEvent);

    // Consider the cases of window going out and coming into focus.
    chrome.windows.onFocusChanged.addListener(function(window) {
        if (window == chrome.windows.WINDOW_ID_NONE) {
            processTabEvent();
        } else {
            chrome.tabs.query({active:true, currentWindow:true}, function(tabs) {
                if (tabs[0] !== undefined) {
                    processTabEvent(tabs[0]);
                }
            });
        }
    });

    // Set a recurring alarm for midnight handling and register a handler for it.
    var nextMidNightTime = getNextMidnightTime();
    chrome.alarms.create("midnighter", {
        when: nextMidNightTime.getTime(),
        periodInMinutes: 24 * 60
    });

    chrome.alarms.onAlarm.addListener(function(alarm) {
        if (alarm.name === "midnighter") {
            // Reset the daily limit.
            browsingData.timeSpentMs = 0;
            browsingData.currentUrl = undefined;
            browsingData.browseStart = undefined;
            // Sync browsing data to local storage.
            storeBrowsingData();
        } else if (alarm.name === "closer")  {
            // Redirect the user to redirect page.
            chrome.tabs.update({url:redirectUrl});
        }
    });
};

chrome.storage.local.get(['browsingData'], initialize);
