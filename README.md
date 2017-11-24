# TabPolish ![](https://github.com/blaskovicz/tabpolish/raw/master/magic-10-icon-16.png)  [![Build Status](https://travis-ci.org/blaskovicz/tab-polish.svg?branch=master)](https://travis-ci.org/blaskovicz/TabPolish)

>A Chrome Extension to keep your tabs shiny (and organized)!

### Developing

0. Make sure you have [Google Chrome](https://www.google.com/chrome/) and [NodeJS](https://nodejs.org/) installed.
1. `$ git clone https://github.com/blaskovicz/tab-polish && cd tab-polish`
2. `$ yarn install # install node dependencies`
3. `$ yarn # start webpack and development server; uses ChromeMock for ui`
4. `$ yarn build # build tab-polish.zip; needs to be done each time you load extension for next step`
5. To load the extension:
    1. open [chrome://extensions](chrome://extensions)
    2. enable developer mode
    3. browse to the build folder and click open

