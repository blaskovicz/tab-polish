export const WINDOW_TYPE_NORMAL = "normal";
export const TAB_STATUS_COMPLETE = "complete";
export const PREFERENCE_CLOSE_OLD_TABS = "close-old-tabs";
export const PREFERENCE_SORT_TABS_BY = "sort-tabs-by";
export const PREFERENCE_TREAT_TAB_URL_PATHS_AS_UNIQUE =
  "treat-tab-url-paths-as-unique";
export const PREFERENCE_TREAT_TAB_URL_FRAGMENTS_AS_UNIQUE =
  "treat-tab-url-fragments-as-unique";
export const PREFERENCE_TREAT_TAB_URL_SEARCH_PARAMS_AS_UNIQUE =
  "treat-tab-url-search-params-as-unique";
export const DEFAULT_PREFERENCES = {
  [PREFERENCE_CLOSE_OLD_TABS]: false,
  [PREFERENCE_TREAT_TAB_URL_PATHS_AS_UNIQUE]: true,
  [PREFERENCE_TREAT_TAB_URL_FRAGMENTS_AS_UNIQUE]: true,
  [PREFERENCE_TREAT_TAB_URL_SEARCH_PARAMS_AS_UNIQUE]: true
};
