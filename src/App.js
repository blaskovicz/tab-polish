import React, { Component } from "react";
import Preferences from "./Preferences";
import TabControls from "./TabControls";
import "bootstrap/dist/css/bootstrap.min.css";
import logo from "./img/magic-10-icon-48.png";
import "./App.css";

class App extends Component {
  componentWillMount() {
    /* bootstrap setup */
    window.$ = require("jquery");
    window.jQuery = window.$;
    window.Popper = require("popper.js");
    require("bootstrap");
  }
  render() {
    return (
      <div className="app">
        <h2 className="title">
          <img className="logo" src={logo} alt="logo" />
          TabPolish
          <Preferences />
        </h2>
        <TabControls />
      </div>
    );
  }
}

export default App;
