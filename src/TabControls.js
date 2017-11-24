import React, { Component } from "react";
import {
  WINDOW_TYPE_NORMAL,
  DEFAULT_PREFERENCES,
  TAB_STATUS_COMPLETE,
  PREFERENCE_CLOSE_OLD_TABS
} from "./lib/Constants";
import Chrome from "./lib/Chrome";
import "./TabControls.css";

export default class TabControls extends Component {
  static windowCreateDate = { focused: true, type: WINDOW_TYPE_NORMAL };
  static windowQuery = { populate: true, windowTypes: [WINDOW_TYPE_NORMAL] };
  static NEW_TAB = {
    title: "-- new window --",
    windowId: -1000
  };
  constructor(props) {
    super(props);
    this.polishing = false;
    this.state = {
      selectedTabs: new Set(),
      currentWindow: null,
      nextTabs: [],
      nextWindowTab: null
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
    if (this.polishing || changeInfo.status !== TAB_STATUS_COMPLETE) {
      return;
    }
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
      console.log("polishTabs", tab.url);
      Chrome.tabs.query(
        {
          status: TAB_STATUS_COMPLETE,
          windowType: WINDOW_TYPE_NORMAL,
          windowId: Chrome.windows.WINDOW_ID_CURRENT
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
        const tabURL = new URL(tab.url);

        // filter us down to only tabs in the window matching the updated tab
        tabs = tabs.filter(matchingTab => {
          const matchingTabURL = new URL(matchingTab.url);
          return matchingTabURL.hostname === tabURL.hostname;
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
            console.warn("polishTabs: no tabToActivate", tabs, tab);
          } else {
            tabsToClose = tabs.filter(
              matchingTab => matchingTab.id !== tabToActivate.id
            );
          }
        }

        const actions = [];
        if (tabsToClose && tabsToClose.length !== 0) {
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
        if (tabToActivate && !tabToActivate.active) {
          actions.push(
            new Promise((resolve, reject) => {
              Chrome.tabs.update(tabToActivate.id, { active: true }, () => {
                resolve();
              });
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
        console.warn("polishTabs", e);
        this.polishing = false;
      });
  };
  loadCurrentWindow = () => {
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
  setSelectionAll = () => {
    const { selectedTabs, currentWindow } = this.state;
    if (!currentWindow) return;
    const select = !this.allSelected();
    if (select) {
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
    return (
      currentWindow && currentWindow.tabs.every(tab => selectedTabs.has(tab.id))
    );
  };
  render() {
    const { nextTabs, currentWindow, selectedTabs, nextWindowTab } = this.state;
    const allSelected = this.allSelected();
    const anySelected = allSelected || this.anySelected();
    return (
      <div>
        <h3>Move Tabs to Window</h3>
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
                  {tab.favIconUrl &&
                    tab.favIconUrl !== "" && (
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
                        {"<pinned>"}
                      </small>
                    )}
                    {tab.title}
                    <small className="subtext">{tab.url}</small>
                  </span>
                </label>
              ))}
          </form>
        </div>
        <div id="active-windows">
          {nextWindowTab &&
            nextTabs && (
              <select
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
            className="btn btn-default"
            type="button"
            disabled={!currentWindow}
            onClick={this.setSelectionAll}
          >
            {allSelected ? "Deselect" : "Select"} All Tabs
          </button>
          <button
            className="btn btn-primary"
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
        </div>
      </div>
    );
  }
}
