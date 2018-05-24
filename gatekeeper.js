"use strict";

import {getURLHost, getPropString, getDateKey, setValueIfNotExists, isWikipediaDomain, 
        getNextMidnightTime, arrayElemsToString} from "./basics.js";

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
