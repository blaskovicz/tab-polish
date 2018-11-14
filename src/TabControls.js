import React, { Component } from "react";
import {
  WINDOW_TYPE_NORMAL,
  DEFAULT_PREFERENCES,
  TAB_STATUS_COMPLETE,
  PREFERENCE_TREAT_TAB_URL_PATHS_AS_UNIQUE,
  PREFERENCE_TREAT_TAB_URL_FRAGMENTS_AS_UNIQUE,
  PREFERENCE_TREAT_TAB_URL_SEARCH_PARAMS_AS_UNIQUE,
  PREFERENCE_CLOSE_OLD_TABS
} from "./lib/Constants";
import { searchParamsMatch } from "./lib/Utils";
import Chrome from "./lib/Chrome";
import "./TabControls.css";

export default class TabControls extends Component {
  static windowCreateDate = { focused: true, type: WINDOW_TYPE_NORMAL };
  static windowQuery = { populate: true, windowTypes: [WINDOW_TYPE_NORMAL] };
  static NEW_TAB = {
    title: "-- new window --",
    windowId: -1000
  };
  static SORT_OPTIONS = [
    { title: "By Title, Asc", value: "title_asc" },
    { title: "By Title, Desc", value: "title_desc" },
    { title: "By URL, Asc", value: "url_asc" },
    { title: "By URL, Desc", value: "url_desc" }
  ];
  constructor(props) {
    super(props);
    this.polishing = false;
    this.state = {
      selectedTabs: new Set(),
      currentWindow: null,
      nextTabs: [],
      nextWindowTab: null,
      sortTabsBy: this.constructor.SORT_OPTIONS[0].value
    };
  }
  componentWillMount() {
    this.loadCurrentWindow();
    this.attachListeners();
  }
  attachListeners = () => {
    Chrome.tabs.onUpdated.addListener(this.polishTabs);
    Chrome.tabs.onDetached.addListener(this.loadCurrentWindow);
    Chrome.tabs.onAttached.addListener(this.loadCurrentWindow);
    Chrome.tabs.onRemoved.addListener(this.loadCurrentWindow);
  };
  polishTabs = (tabId, changeInfo, tab) => {
    // TODO we may want to close a tab before it's 'complete' so we don't
    // waste the cycles/memory/time loading it only to close it...
    if (this.polishing || changeInfo.status !== TAB_STATUS_COMPLETE) {
      return;
    }
    console.log(
      `ref=tab-controls.polish-tabs at=start polishing=${this.polishing} tab=`,
      tab,
      "changeInfo=",
      changeInfo
    );
    this.polishing = true;
    const preferencesP = new Promise((resolve, reject) => {
      Chrome.storage.sync.get(DEFAULT_PREFERENCES, items => {
        if (Chrome.runtime.lastError) {
          reject(Chrome.runtime.lastError);
        } else {
          resolve(items);
        }
      });
    });
    const tabsP = new Promise((resolve, reject) => {
      Chrome.tabs.query(
        {
          status: TAB_STATUS_COMPLETE,
          windowType: WINDOW_TYPE_NORMAL,
          windowId: tab.windowId
          // note we can't use the 'url' param here because it won't
          // filter against some chrome:// special urls
        },
        tabs => {
          resolve(tabs);
        }
      );
    });
    Promise.all([preferencesP, tabsP])
      .then(values => {
        let [preferences, tabs] = values;

        if (!tabs || tabs.length < 2) return; // less than 2 tabs matching, bail.

        const closeOldTabs = preferences[PREFERENCE_CLOSE_OLD_TABS];
        const uniquePaths =
          preferences[PREFERENCE_TREAT_TAB_URL_PATHS_AS_UNIQUE];
        const uniqueFragments =
          preferences[PREFERENCE_TREAT_TAB_URL_FRAGMENTS_AS_UNIQUE];
        const uniqueSearchParams =
          preferences[PREFERENCE_TREAT_TAB_URL_SEARCH_PARAMS_AS_UNIQUE];
        const tabURL = new URL(tab.url);

        // filter us down to only tabs in the window matching the updated tab
        tabs = tabs.filter(matchingTab => {
          const matchingTabURL = new URL(matchingTab.url);
          return (
            matchingTabURL.hostname === tabURL.hostname &&
            matchingTabURL.port === tabURL.port &&
            (!uniquePaths || matchingTabURL.pathname === tabURL.pathname) &&
            (!uniqueFragments || matchingTabURL.hash === tabURL.hash) &&
            (!uniqueSearchParams ||
              searchParamsMatch(
                matchingTabURL.searchParams,
                tabURL.searchParams
              ))
          );
        });

        let tabToActivate;
        let tabsToClose;
        if (closeOldTabs) {
          // active the newest updated tab, close all others
          tabToActivate = tab;
          tabsToClose = tabs.filter(matchingTab => matchingTab.id !== tab.id);
        } else {
          // activate the first tab that's not us, close all others
          tabToActivate = tabs.find(matchingTab => matchingTab.id !== tab.id);
          if (!tabToActivate) {
            console.log(
              `ref=tab-controls.polish-tabs at=missing-tab-to-activate tab.url=${
                tab.url
              } tab.status=${changeInfo.status} tab.id=${tabId} tabs=`,
              tabs
            );
          } else {
            tabsToClose = tabs.filter(
              matchingTab => matchingTab.id !== tabToActivate.id
            );
          }
        }

        const haveTabsToClose = tabsToClose && tabsToClose.length !== 0;
        const closingActiveTabs =
          haveTabsToClose &&
          tabsToClose.some(matchingTab => matchingTab.active);
        const actions = [];

        if (tabToActivate && !tabToActivate.active && closingActiveTabs) {
          console.log(
            `ref=tab-controls.polish-tabs at=activate-tab tab=`,
            tabToActivate
          );
          actions.push(
            new Promise((resolve, reject) => {
              Chrome.tabs.update(tabToActivate.id, { active: true }, () => {
                resolve();
              });
            })
          );
        }

        if (haveTabsToClose) {
          console.log(
            `ref=tab-controls.polish-tabs at=remove-tabs tabs=`,
            tabsToClose
          );
          actions.push(
            new Promise((resolve, reject) => {
              Chrome.tabs.remove(
                tabsToClose.map(matchingTab => matchingTab.id),
                () => {
                  resolve();
                }
              );
            })
          );
        }

        // TODO focus window?
        return Promise.all(actions);
      })
      .then(() => {
        this.polishing = false;
      })
      .catch(e => {
        console.warn(`ref=tab-controls.polish-tabs at=error`, e);
        this.polishing = false;
      });
  };
  loadCurrentWindow = () => {
    console.log("ref=tab-controls.load-current-window at=start");
    const currentWindowP = new Promise((resolve, reject) => {
      Chrome.windows.getCurrent(this.constructor.windowQuery, currentWindow => {
        resolve(currentWindow);
      });
    });
    const allWindowsP = new Promise((resolve, reject) => {
      Chrome.windows.getAll(this.constructor.windowQuery, allWindows => {
        resolve(allWindows);
      });
    });
    Promise.all([currentWindowP, allWindowsP]).then(values => {
      const [currentWindow, allWindows] = values;
      const nextTabs = [];
      for (let win of allWindows) {
        if (win.id === currentWindow.id) continue;
        const activeWindowTab = win.tabs.find(tab => tab.active);
        if (activeWindowTab === undefined) continue;
        nextTabs.push(activeWindowTab);
      }
      nextTabs.push(this.constructor.NEW_TAB);
      const nextWindowTab = nextTabs[0];
      this.setState({ nextTabs, currentWindow, nextWindowTab });
    });
  };
  moveSelectedTabs = () => {
    const { nextWindowTab, selectedTabs } = this.state;
    console.log(
      "ref=tab-controls.move-selected-tabs at=start next-window-tab=",
      nextWindowTab,
      "selectedTabs=",
      selectedTabs
    );

    let nextWindowP;
    const selectedTabsArray = Array.from(selectedTabs.values());
    if (nextWindowTab.windowId === this.constructor.NEW_TAB.windowId) {
      // create a new window with the first tab
      const tabId = selectedTabsArray.splice(0, 1)[0];
      nextWindowP = new Promise((resolve, reject) => {
        Chrome.windows.create(
          Object.assign({}, this.constructor.windowCreateDate, { tabId }),
          newWindow => {
            resolve(newWindow.id);
          }
        );
      });
    } else {
      // move to existing window
      nextWindowP = Promise.resolve(nextWindowTab.windowId);
    }

    nextWindowP.then(windowId => {
      selectedTabs.clear();
      this.setState({ selectedTabs });
      if (selectedTabsArray.length === 0) {
        return;
      }
      Chrome.tabs.move(selectedTabsArray, { windowId, index: -1 }, () => {
        this.loadCurrentWindow();
      });
    });
  };
  updateNextWindow = e => {
    const { nextTabs } = this.state;
    const targetWindowId = +e.target.value;
    const nextWindowTab = nextTabs.find(tab => tab.windowId === targetWindowId);
    if (nextWindowTab === undefined) return;
    this.setState({ nextWindowTab });
  };
  toggleSelect = tab => {
    const { selectedTabs } = this.state;
    if (selectedTabs.has(tab.id)) {
      selectedTabs.delete(tab.id);
    } else {
      selectedTabs.add(tab.id);
    }
    this.setState({ selectedTabs });
  };
  changeSort = e => {
    this.setState({ sortTabsBy: e.target.value });
  };
  sortTabs = async () => {
    const { sortTabsBy, selectedTabs, currentWindow } = this.state;
    if (
      selectedTabs.size < 0 ||
      !currentWindow ||
      !currentWindow.tabs ||
      this.polishing
    )
      return;
    console.log(`ref=tab-controls.sort-tabs at=start`);
    this.polishing = true;

    const selectedTabsFull = currentWindow.tabs.filter(t =>
      selectedTabs.has(t.id)
    );
    if (selectedTabsFull.length !== selectedTabs.size) {
      throw new Error(
        `Failed to locate all tabs; selected=${selectedTabs.size}, found=${
          selectedTabsFull.length
        }`
      );
    }
    const [field, direction] = sortTabsBy.split("_", 2);
    const originalTabLocations = selectedTabsFull
      .sort((a, b) => {
        // sort by tab index, asc
        return a.index - b.index;
      })
      .map(t => ({ id: t.id, index: t.index }));
    const newTabLocations = selectedTabsFull.sort((a, b) => {
      // sort by field as requested
      const aVal = a[field].toLocaleLowerCase();
      const bVal = b[field].toLocaleLowerCase();
      let result = aVal.localeCompare(bVal);
      if (result === 0) {
        result = a.id - b.id;
      }
      if (direction === "desc") {
        return -1 * result;
      }
      return result;
    });

    // schedule one move for each tab since we may not be sorting all tabs in the window
    // move the lowest new index tab first so we don't incorrectly adjust indicies
    for (let i = 0; i < newTabLocations.length; i++) {
      const tabToSwap = newTabLocations[i];
      const newTabLocation = originalTabLocations[i];
      console.log(
        `ref=tab-controls.sort-tabs at=swap tab.id=${tabToSwap.id} tab.src=${
          tabToSwap.index
        } tab.dest=${newTabLocation.index}`
      );
      try {
        await new Promise((resolve, reject) => {
          Chrome.tabs.move(
            tabToSwap.id,
            { index: newTabLocation.index },
            () => {
              resolve();
            }
          );
        });
      } catch (e) {
        console.warn(`ref=tab-controls.sort-tabs at=error`, e);
        break;
      }
    }

    this.polishing = false;
    this.loadCurrentWindow();
  };

  setSelectionAll = e => {
    const { selectedTabs, currentWindow } = this.state;
    if (!currentWindow) return;
    if (e.target.checked) {
      for (let tab of currentWindow.tabs) {
        selectedTabs.add(tab.id);
      }
    } else {
      selectedTabs.clear();
    }
    this.setState({ selectedTabs });
  };
  anySelected = () => {
    const { currentWindow, selectedTabs } = this.state;
    return (
      currentWindow && currentWindow.tabs.some(tab => selectedTabs.has(tab.id))
    );
  };
  allSelected = () => {
    const { currentWindow, selectedTabs } = this.state;
    return !!(
      currentWindow && currentWindow.tabs.every(tab => selectedTabs.has(tab.id))
    );
  };
  static MAX_URL = 120;
  static shortUrl(tabUrl) {
    if (tabUrl.length <= this.MAX_URL) return tabUrl;
    return `${tabUrl.substring(0, this.MAX_URL)}...`;
  }
  render() {
    const {
      nextTabs,
      currentWindow,
      selectedTabs,
      nextWindowTab,
      sortTabsBy
    } = this.state;
    const allSelected = this.allSelected();
    const anySelected = allSelected || this.anySelected();
    return (
      <div id="tab-controls">
        <label htmlFor="select-all-tabs">
          <input
            disabled={!currentWindow}
            type="checkbox"
            id="select-all-tabs"
            onChange={this.setSelectionAll}
            value={allSelected}
          />
          Select All
        </label>
        <div id="active-tabs">
          <form>
            {currentWindow &&
              currentWindow.tabs.map(tab => (
                <label key={tab.id} className="tab-description">
                  <input
                    type="checkbox"
                    checked={selectedTabs.has(tab.id)}
                    onChange={() => this.toggleSelect(tab)}
                  />{" "}
                  {tab.favIconUrl && tab.favIconUrl !== "" && (
                    <img
                      className="favicon"
                      src={tab.favIconUrl}
                      alt="favicon"
                    />
                  )}
                  <span>
                    {tab.pinned && (
                      <small
                        title="this tab is pinned"
                        /* TODO: className="glyphicon glyphicon-pushpin" */
                        aria-hidden="true"
                      >
                        <i>pinned </i>
                      </small>
                    )}
                    {tab.title}
                    <small className="subtext" title={tab.url}>
                      {this.constructor.shortUrl(tab.url)}
                    </small>
                  </span>
                </label>
              ))}
          </form>
        </div>
        <div id="active-windows">
          <button
            className="btn btn-outline-dark"
            disabled={
              !anySelected ||
              (allSelected &&
                nextWindowTab.windowId === this.constructor.NEW_TAB.windowId)
            }
            onClick={this.moveSelectedTabs}
            type="button"
            id="move-to-window"
          >
            Move to Window
          </button>
          {nextWindowTab && nextTabs && (
            <select
              id="select-window"
              className="form-control input-sm"
              value={nextWindowTab.windowId}
              onChange={this.updateNextWindow}
            >
              {nextTabs.map(tab => (
                <option key={tab.windowId} value={tab.windowId}>
                  {tab.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <div id="tab-control-buttons">
          <button
            id="sort-tabs"
            disabled={!anySelected}
            className="btn btn-outline-dark"
            onClick={this.sortTabs}
          >
            Sort
          </button>
          <select
            id="sort-tabs-by"
            className="form-control input-sm"
            value={sortTabsBy}
            onChange={this.changeSort}
          >
            {this.constructor.SORT_OPTIONS.map(sortOption => (
              <option key={sortOption.value} value={sortOption.value}>
                {sortOption.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }
}
