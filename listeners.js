var polishing = false;
function normalizeUrl(url){
	if(url == null) return "";
	//console.log("parsing " + url);
	url = url.toUpperCase();
	//TODO allow domain specific regexs, configurable by user
	if(url.match(/rpd\/summary.aspx/i)) url = url.replace(/#.*$/,'').replace(/&?commentid=\d+/i,'');
	//console.log("... to " + url);
	return url;
}
function polishTabs(tabId, changeInfo, tab){
	// load all prefs each time
	var windowId = chrome.windows.WINDOW_ID_CURRENT;
	chrome.storage.sync.get(null, function(prefs){
		var closeOldTabs = prefs != null && prefs['close-old-tabs'];
		var currentTabNormalizedUrl = normalizeUrl(tab.url);
		console.log("window/" + windowId + "/tab/" + tab.id + " update: " + tab.url + " [ "+currentTabNormalizedUrl+" ]");
		chrome.tabs.query({windowId: windowId}, function(tabs){
			if(polishing) return;
			polishing = true;
			console.log("window/" + windowId + " has " + tabs.length + " tabs");
			if(!tabs || tabs.length < 1) return;
			var tabLookup = {};
			if(closeOldTabs){
				console.log("window/"+ windowId + "/tab/" + tab.id + " saving due to old tab pref");
				tabLookup[currentTabNormalizedUrl] = tab;
			}
			// for every tab in the current window, save the first tab we find and close any others with the same url.
			// if the close-old-tabs option is set, treat the current tab as highest priority for remaining open
			for(var i = 0; i < tabs.length; i++){
				var iterTab = tabs[i];
				var url = normalizeUrl(iterTab.url);
				if(!tabLookup[url]){
					tabLookup[url] = iterTab;
				}
				else {
					if(iterTab.id == tab.id && closeOldTabs) continue;
					if(iterTab.highlighted){
						console.log("window/" + tabLookup[url].windowId + "/tab/" + tabLookup[url].id + " getting focused");
						chrome.tabs.update(tabLookup[url].id, {"active":true});
					}
					try {
						console.log("window/" + iterTab.windowId + "/tab/" + iterTab.id + " being closed");
						chrome.tabs.remove(iterTab.id);
					}
					catch(e){
						console.log("window/" + iterTab.windowId + "/tab/" + iterTab.id + " error on close...");
						console.log(e);
					}
				}
			}
			polishing = false;
		});
	});
}
chrome.tabs.onUpdated.addListener(polishTabs);