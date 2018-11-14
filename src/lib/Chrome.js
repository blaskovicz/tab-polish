import { WINDOW_TYPE_NORMAL } from "./Constants";
class MockChrome {
  constructor() {
    this._tabid = 34;
    this._windowid = 3;
    this._windows = [
      {
        id: 1,
        type: WINDOW_TYPE_NORMAL,
        tabs: [
          {
            index: 0,
            active: true,
            id: 9,
            windowId: 1,
            pinned: false,
            title: "hello",
            url: "http://hello.com",
            favIconUrl: "https://www.google.com/favicon.ico"
          },
          {
            index: 1,
            active: false,
            id: 33,
            windowId: 1,
            pinned: true,
            title: "goodbye",
            url: "http://goodbye.com",
            favIconUrl: "https://www.google.com/favicon.ico"
          }
        ]
      },
      {
        id: 2,
        type: WINDOW_TYPE_NORMAL,
        tabs: [
          {
            index: 0,
            active: true,
            id: 23,
            windowId: 2,
            pinned: true,
            title: "google",
            url: "https://google.com",
            favIconUrl: "https://www.google.com/favicon.ico"
          }
        ]
      }
    ];
  }
  // simulate moving a tab
  _moveTab(tabId, { windowId = this._windows[0].id, index = -1 }) {
    let foundTab;
    const foundWindow = this._windows.find(w => w.id === windowId);
    if (foundWindow === undefined) {
      throw new Error(`could not find window ${windowId}`);
    }
    for (let i = 0; i < this._windows.length; i++) {
      const w = this._windows[i];
      foundTab = w.tabs.findIndex(t => t.id === tabId);
      if (foundTab === -1) {
        continue;
      }
      const lastTab = w.tabs.length === 1;
      foundTab = w.tabs.splice(foundTab, 1)[0]; // remove tab from old window index
      if (foundTab.active) {
        if (lastTab) {
          if (foundTab.windowId !== windowId) {
            w.tombstone = true; // for anyone that has a reference
            this._windows.splice(i, 1);
          }
        } else {
          w.tabs[0].active = true;
        }
        foundTab.active = false;
      }

      // add tab to new window/location
      foundTab.windowId = windowId;
      foundWindow.tabs.splice(
        index === -1 ? foundWindow.tabs.length - 1 : index,
        0,
        foundTab
      );
      break;
    }
    if (foundTab === undefined) {
      throw new Error("couldn't find tab");
    }
    this._orderTabs();
  }
  _orderTabs() {
    for (const w of this._windows) {
      let index = 0;
      for (const t of w.tabs) {
        t.index = index;
        index++;
      }
    }
  }
  get tabs() {
    const self = this;
    return {
      get onUpdated() {
        return { addListener() {} };
      },
      get onDetached() {
        return { addListener() {} };
      },
      get onAttached() {
        return { addListener() {} };
      },
      get onRemoved() {
        return { addListener() {} };
      },
      remove(tabIDs, cb) {
        console.log("tabs.remove", tabIDs);
        if (cb) cb();
      },
      update(tabID, options, cb) {
        console.log("tabs.update", tabID, options);
        if (cb) cb();
      },
      move(tabs, options, cb) {
        if (typeof tabs === "number") {
          tabs = [tabs];
        }
        if (!(tabs instanceof Array) || tabs.some(t => typeof t !== "number"))
          throw new Error("invalid tabs must be array of numbers");
        console.log("tabs.move", tabs, options);
        for (let tab of tabs) {
          self._moveTab(tab, options);
        }
        cb();
      },
      query(query, cb) {
        console.log("tabs.query", query);
        const { windowId } = query;
        let tabs = [];
        if (windowId) {
          const w = self._windows.find(w => w.id === windowId);
          if (w) {
            tabs = w.tabs;
          }
        }
        cb(tabs);
      }
    };
  }
  get windows() {
    const self = this;
    return {
      WINDOW_ID_CURRENT: -2,
      getAll(query, cb) {
        console.log("windows.getAll", query);
        cb(self._windows);
      },
      getCurrent(query, cb) {
        console.log("windows.getCurrent", query);
        cb(self._windows[0]);
      },
      create(createData, cb) {
        console.log("windows.create", createData);
        const newWindow = {
          id: self._windowid++,
          tabs: []
        };
        self._windows.push(newWindow);
        if (createData.tabId) {
          self._moveTab(createData.tabId, newWindow.id);
        } else {
          newWindow.tabs.push({
            id: self._tabid++,
            windowId: newWindow.id,
            url: "chrome://newtab",
            title: "newtab",
            favIconUrl: "https://www.google.com/favicon.ico",
            active: true
          });
        }
        cb(newWindow);
      }
    };
  }
  get storage() {
    return {
      get sync() {
        return {
          get(options, cb) {
            console.log("storage.sync.get", options);
            cb(options);
          },
          set(options, cb) {
            console.log("storage.sync.set", options);
            cb();
          }
        };
      }
    };
  }
  get runtime() {
    console.log("runtime");
    return { lastError: null };
  }
}

const Chrome =
  window.chrome && window.chrome.storage ? window.chrome : new MockChrome();
export default Chrome;
