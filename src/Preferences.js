import React, { Component } from "react";
//import Loading from "./Loading";
import Chrome from "./lib/Chrome";
import { DEFAULT_PREFERENCES } from "./lib/Constants";
import "./Preferences.css";

export default class Preferences extends Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false
    };
  }

  componentWillMount() {
    this.loadPrefs();
  }

  toggleOptions = () => {
    const { open } = this.state;
    this.setState({ open: !open });
  };

  loadPrefs = () => {
    //console.log(`ref=preferences.load at=start`);
    Chrome.storage.sync.get(DEFAULT_PREFERENCES, items => {
      if (Chrome.runtime.lastError) {
        console.warn(Chrome.runtime.lastError);
      } else {
        this.setState(items);
      }
    });
  };

  updatePref = e => {
    const target = e.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const name = target.name;
    const pref = { [name]: value };
    console.log(`ref=preferences.update at=start name=${name} value=${value}`);
    Chrome.storage.sync.set(pref, () => {
      if (Chrome.runtime.lastError) {
        console.warn(Chrome.runtime.lastError);
      } else {
        this.setState(pref);
      }
    });
  };

  render() {
    const { state } = this;
    return (
      <div id="polish-options-wrapper">
        <button
          type="button"
          className={`btn btn-sm btn-link ${state.open && "button-open"}`}
          onClick={this.toggleOptions}
        >
          Options
        </button>
        {state.open && (
          <div id="polish-options">
            <div className="button-close-align">
              <button
                className="btn btn-link btn-sm close-button"
                type="button"
                onClick={this.toggleOptions}
              >
                Close
              </button>
            </div>
            {Object.keys(DEFAULT_PREFERENCES).map(option => {
              const loading = state[option] === undefined;
              return (
                <label key={option}>
                  <input
                    disabled={loading}
                    type="checkbox"
                    name={option}
                    onChange={this.updatePref}
                    checked={
                      loading ? DEFAULT_PREFERENCES[option] : state[option]
                    }
                  />{" "}
                  {option.replace(/-/g, " ")}
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  }
}
